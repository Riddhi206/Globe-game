// tools/push/vapid-keys.mjs — makes the keys push notifications need. Run once:
//
//   node tools/push/vapid-keys.mjs
//
// Prints a VAPID key pair and a cron secret, with exactly where each one goes
// (docs/PUSH.md walks through it). Keep the private key and the secret out of git.
// Making new keys later signs everyone out of notifications until the app re-subscribes
// them on their next visit, so do this once.

const b64u = buf => Buffer.from(buf).toString('base64url');
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
const priv = (await crypto.subtle.exportKey('jwk', kp.privateKey)).d;
const secret = b64u(crypto.getRandomValues(new Uint8Array(32)));

console.log(`
1) Supabase → Edge Functions → Secrets (Add new secret), one per line:

   VAPID_PUBLIC_KEY   ${pub}
   VAPID_PRIVATE_KEY  ${priv}
   VAPID_SUBJECT      mailto:YOUR-EMAIL
   PUSH_CRON_SECRET   ${secret}

2) Supabase → SQL editor (the public key only — the app reads it from here):

   insert into public.push_config (id, vapid_public) values (1, '${pub}')
   on conflict (id) do update set vapid_public = excluded.vapid_public;

3) In supabase/018_push_cron.sql, use this same PUSH_CRON_SECRET:

   ${secret}
`);
