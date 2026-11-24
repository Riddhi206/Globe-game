// server.mjs — local analytics dashboard for Borderline (/) and GameKatta (/gk).
//
//   cd tools/dashboard
//   npm install            (first time only)
//   npm start              → http://localhost:4000   (needs .env, see README)
//   npm run demo           → same page on an in-memory demo database, no setup
//
// Connects straight to the Supabase Postgres database with the connection
// string in .env (never committed). Read-only: every query runs inside a
// read-only transaction. All the SQL lives in queries.mjs.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { Q, PLAYER, RANGES } from './queries.mjs';
import { GQ, GK_PLAYER } from './gk-queries.mjs';

// GameKatta's sites (the /gk page's site picker); 'all' is every one of them
const GK_SITES = ['all', 'hub', 'hatke', 'tatva', 'tictacchai', 'cricket', 'pataakha', 'dahi'];

const DIR  = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;
const DEMO = process.argv.includes('--demo');

// ------------------------------------------------------------
// .env loader (tiny, no dependency)
// ------------------------------------------------------------
function loadEnv() {
  const file = path.join(DIR, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ------------------------------------------------------------
// Database: the real one (pg pool) or the demo one (PGlite)
// Both expose run(sql, params) → rows, inside one read-only transaction.
// ------------------------------------------------------------
let pool = null, demoDb = null;

// PGlite hands back bigints, numeric strings and Date objects; make them look like the pg setup below
function tidy(rows, fields) {
  const numeric = new Set((fields || []).filter(f => [20, 1700].includes(f.dataTypeID)).map(f => f.name));
  return rows.map(r => {
    const o = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'bigint') o[k] = Number(v);
      else if (numeric.has(k) && typeof v === 'string') o[k] = Number(v);
      else if (v instanceof Date) o[k] = v.toISOString().endsWith('T00:00:00.000Z') ? v.toISOString().slice(0, 10) : v.toISOString();
      else o[k] = v;
    }
    return o;
  });
}

async function withDb(fn) {
  if (DEMO) {
    return demoDb.transaction(async tx => {
      await tx.query('set transaction read only');
      return fn(async (sql, params = []) => { const r = await tx.query(sql, params); return tidy(r.rows, r.fields); });
    });
  }
  const client = await pool.connect();
  try {
    await client.query('begin read only');
    const out = await fn(async (sql, params = []) => (await client.query(sql, params)).rows);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function getData(rangeKey) {
  const interval = RANGES[rangeKey];
  return withDb(async run => {
    const out = {};
    // Notification numbers need 017_push.sql; before that they're empty, not an error
    const has = (await run(`select to_regclass('public.push_log') is not null as push, to_regclass('public.feedback') is not null as feedback`))[0];
    for (const [key, sql] of Object.entries(Q)) {
      if ((key.startsWith('push') && !has.push) || (key === 'feedback' && !has.feedback)) { out[key] = []; continue; }
      try { out[key] = await run(sql, sql.includes('$1') ? [interval] : []); }
      catch (e) { throw new Error(`query "${key}": ${e.message}`); }
    }
    return out;
  });
}

// GameKatta: every query takes the range and the site
async function getGkData(rangeKey, site) {
  const interval = RANGES[rangeKey];
  return withDb(async run => {
    const out = {};
    for (const [key, sql] of Object.entries(GQ)) {
      try { out[key] = await run(sql, [interval, site]); }
      catch (e) { throw new Error(`query "${key}": ${e.message}`); }
    }
    return out;
  });
}
async function getGkPlayer(q, site) {
  q = String(q || '').trim().toLowerCase().replace(/[^0-9a-f-]/g, '').slice(0, 36);
  if (q.length < 4) return { events: [] };
  return withDb(async run => ({ events: await run(GK_PLAYER.events, ['1 day', site, q]) }));
}

async function getPlayer(q) {
  q = String(q || '').trim().slice(0, 40);
  if (q.length < 2) return { matches: [] };
  return withDb(async run => {
    const matches = await run(PLAYER.find, [q]);
    if (matches.length !== 1) return { matches };
    const id = matches[0].id;
    return { matches, events: await run(PLAYER.events, [id]), first: (await run(PLAYER.first, [id]))[0] || null };
  });
}

// ------------------------------------------------------------
// Server
// ------------------------------------------------------------
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(DIR, 'index.html')));
    } else if (url.pathname === '/api/data') {
      const range = RANGES[url.searchParams.get('range')] ? url.searchParams.get('range') : '7d';
      json(res, 200, { range, demo: DEMO, generatedAt: new Date().toISOString(), data: await getData(range) });
    } else if (url.pathname === '/gk') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(DIR, 'gk.html')));
    } else if (url.pathname === '/api/gk-data') {
      const range = RANGES[url.searchParams.get('range')] ? url.searchParams.get('range') : '7d';
      const site = GK_SITES.includes(url.searchParams.get('site')) ? url.searchParams.get('site') : 'all';
      json(res, 200, { range, site, sites: GK_SITES, demo: DEMO, generatedAt: new Date().toISOString(), data: await getGkData(range, site) });
    } else if (url.pathname === '/api/gk-player') {
      const site = GK_SITES.includes(url.searchParams.get('site')) ? url.searchParams.get('site') : 'all';
      json(res, 200, await getGkPlayer(url.searchParams.get('q'), site));
    } else if (url.pathname === '/api/player') {
      json(res, 200, await getPlayer(url.searchParams.get('q')));
    } else { res.writeHead(404); res.end('Not found'); }
  } catch (e) {
    console.error(e);
    json(res, 500, { error: e.message });
  }
});

async function main() {
  if (DEMO) {
    const { makeDemoDb } = await import('./demo-db.mjs');
    console.log('Building the demo database…');
    demoDb = await makeDemoDb();
  } else {
    loadEnv();
    if (!process.env.DATABASE_URL) {
      console.error('\nMissing DATABASE_URL. Create tools/dashboard/.env — see README.md — or run `npm run demo`.\n');
      process.exit(1);
    }
    const { default: pg } = await import('pg');
    pg.types.setTypeParser(1082, v => v);                 // date    → '2026-09-30' (no time-zone shift)
    pg.types.setTypeParser(20, v => parseInt(v, 10));     // bigint  → number (counts)
    pg.types.setTypeParser(1700, v => parseFloat(v));     // numeric → number (rounded averages)
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
    await pool.query('select 1');   // fail fast on a bad password / URL
  }
  server.listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\nBorderline dashboard ${DEMO ? '(DEMO DATA) ' : ''}→ ${url}\nGameKatta dashboard  → ${url}/gk\n`);
    if (!process.argv.includes('--no-open')) exec(`${process.platform === 'darwin' ? 'open' : 'xdg-open'} ${url}`);
  });
}

main().catch(e => { console.error('\nCould not start:', e.message, '\n'); process.exit(1); });
