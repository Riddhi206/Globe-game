// supabase/functions/push/index.ts — sends Borderline's push notifications.
//
// pg_cron calls this every minute (see docs/PUSH.md). It asks the database what
// is due right now (push_due), sends each one with Web Push, and reports the
// results (push_report), so dead devices are forgotten.
//
// Web Push is implemented here with the Web Crypto API only, no libraries:
//   · RFC 8291 message encryption (aes128gcm, RFC 8188)
//   · RFC 8292 VAPID (an ES256 JWT that proves the push comes from us)
// Works with every push service: Google (Android, Chrome), Apple (iPhone home-screen
// apps, Safari), Mozilla (Firefox), Microsoft (Edge).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   base64url, 65-byte uncompressed P-256 key (also in push_config)
//   VAPID_PRIVATE_KEY  base64url, 32-byte private scalar
//   VAPID_SUBJECT      mailto:you@example.com (push services contact this if something's wrong)
//   PUSH_CRON_SECRET   any long random string; pg_cron sends it in x-cron-secret
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Deploy with "Verify JWT" off: the cron secret is the check.

const enc = new TextEncoder();

export function b64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

// A P-256 key pair from raw parts: public = 65 bytes (0x04 || x || y), private = 32 bytes
async function importPrivate(pub: Uint8Array, priv: Uint8Array, alg: 'ECDH' | 'ECDSA') {
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: b64u(priv), ext: true };
  return crypto.subtle.importKey('jwk', jwk, alg === 'ECDH' ? { name: 'ECDH', namedCurve: 'P-256' } : { name: 'ECDSA', namedCurve: 'P-256' },
    false, alg === 'ECDH' ? ['deriveBits'] : ['sign']);
}

// RFC 8291: encrypt `plaintext` for a subscription. `local` and `salt` are for tests only.
export async function encrypt(plaintext: Uint8Array, uaPublicB64: string, authB64: string,
                              local?: { pub: Uint8Array; priv: Uint8Array }, salt?: Uint8Array): Promise<Uint8Array> {
  const uaPublic = unb64u(uaPublicB64), authSecret = unb64u(authB64);
  let asPublic: Uint8Array, asPrivate: CryptoKey;
  if (local) {
    asPublic = local.pub;
    asPrivate = await importPrivate(local.pub, local.priv, 'ECDH');
  } else {
    const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    asPrivate = kp.privateKey;
  }
  salt = salt || crypto.getRandomValues(new Uint8Array(16));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256));

  // HKDF (single block each time, as the RFC's lengths are ≤ 32)
  const prkKey = await hmac(authSecret, ecdh);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const record = concat(plaintext, new Uint8Array([2]));               // 0x02: the last (only) record, no padding
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, record));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);                       // record size
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

// RFC 8292: Authorization header for a push service origin
const _jwtCache = new Map<string, { value: string; exp: number }>();
export async function vapidAuth(endpoint: string, pubB64: string, privB64: string, subject: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const hit = _jwtCache.get(aud);
  if (hit && hit.exp - now > 3600) return `vapid t=${hit.value}, k=${pubB64}`;
  const exp = now + 12 * 3600;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp, sub: subject })));
  const key = await importPrivate(unb64u(pubB64), unb64u(privB64), 'ECDSA');
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`));
  const jwt = `${head}.${body}.${b64u(sig)}`;
  _jwtCache.set(aud, { value: jwt, exp });
  return `vapid t=${jwt}, k=${pubB64}`;
}

export type Sub = { endpoint: string; p256dh: string; auth: string };
export type Vapid = { publicKey: string; privateKey: string; subject: string };

// Send one notification. Returns the push service's HTTP status (0 = network error).
export async function sendPush(sub: Sub, payload: unknown, vapid: Vapid,
                               { ttl = 86400, urgency = 'normal', topic = '' } = {}): Promise<number> {
  const body = await encrypt(enc.encode(JSON.stringify(payload)), sub.p256dh, sub.auth);
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    'TTL': String(ttl),
    'Urgency': urgency,
    'Authorization': await vapidAuth(sub.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject),
  };
  if (topic) headers['Topic'] = topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);   // a newer push replaces an undelivered one
  try {
    const res = await fetch(sub.endpoint, { method: 'POST', headers, body });
    return res.status;
  } catch {
    return 0;
  }
}

// How long a push is worth delivering, and how urgently
const DELIVERY: Record<string, { ttl: number; urgency: string }> = {
  daily:     { ttl: 4 * 3600, urgency: 'normal' },
  streak:    { ttl: 2 * 3600, urgency: 'high' },
  comeback:  { ttl: 6 * 3600, urgency: 'low' },
  friend:    { ttl: 24 * 3600, urgency: 'normal' },
  challenge: { ttl: 12 * 3600, urgency: 'normal' },
  night:     { ttl: 15 * 60, urgency: 'high' },
  test:      { ttl: 600, urgency: 'high' },
};

// ---------------------------------------------------------------- the cron entry point
async function rpc(fn: string, args: unknown) {
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function run(): Promise<Response> {
  const vapid = {
    publicKey: Deno.env.get('VAPID_PUBLIC_KEY') || '',
    privateKey: Deno.env.get('VAPID_PRIVATE_KEY') || '',
    subject: Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@gamekatta.com',
  };
  if (!vapid.publicKey || !vapid.privateKey) return Response.json({ error: 'VAPID keys not set' }, { status: 500 });

  const due: Array<Sub & { sub: string; kind: string; payload: Record<string, unknown> }> = await rpc('push_due', {}) || [];
  const results: Array<{ sub: string; kind: string; status: number }> = [];
  // 20 at a time: quick, without opening hundreds of connections at once
  for (let i = 0; i < due.length; i += 20) {
    await Promise.all(due.slice(i, i + 20).map(async d => {
      const opt = DELIVERY[d.kind] || DELIVERY.daily;
      const status = await sendPush(d, { ...d.payload, kind: d.kind }, vapid,
        { ttl: opt.ttl, urgency: opt.urgency, topic: String(d.payload.tag || d.kind) });
      results.push({ sub: d.sub, kind: d.kind, status });
    }));
  }
  if (results.length) await rpc('push_report', { p: results });
  const sent = results.filter(r => r.status >= 200 && r.status < 300).length;
  return Response.json({ due: due.length, sent, failed: results.length - sent });
}

declare const Deno: any;
if (typeof Deno !== 'undefined' && Deno.serve) {
  Deno.serve(async (req: Request) => {
    const secret = Deno.env.get('PUSH_CRON_SECRET');
    if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('Forbidden', { status: 403 });
    try { return await run(); }
    catch (e) { console.error(e); return Response.json({ error: String(e) }, { status: 500 }); }
  });
}
