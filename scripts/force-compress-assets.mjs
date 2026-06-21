#!/usr/bin/env node
// force-compress-assets.mjs — headless equivalent of the settings page
// "Force-recompress every asset" button (runCompression(true)).
//
// 1. Discover all game_assets source paths from export-all-tts-json.
// 2. POST them in chunks of 10 to compress-pending-assets (no pending/stale
//    filtering — force means recompress everything).
//
// Reads PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY from .env / .env.local.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  for (const f of ['.env', '.env.local']) {
    try {
      const txt = readFileSync(resolve(ROOT, f), 'utf8');
      for (const line of txt.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* file optional */ }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const ANON_KEY = env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const SOURCE_BUCKET = 'game_assets';
// Smaller chunks keep each edge-function invocation under the ~256 MB worker
// memory cap (large categories like spirit_world decode at 4096px).
// Override with CHUNK_SIZE env. Retry pass for failed paths uses CHUNK_SIZE=1.
const CHUNK = Number(process.env.CHUNK_SIZE) || 4;
// Optional file of explicit source paths (one per line). When set, discovery
// is skipped — used to reprocess only the paths that failed a prior run.
const PATHS_FILE = process.env.PATHS_FILE || '';
const MAX_RETRIES = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL_RE = /https?:\/\/[^\s"'<>)\\]+/g;
const SOURCE_URL_RE = new RegExp(
  `https?://[a-z0-9-]+\\.supabase\\.co/storage/v1/(?:object|render/image)/public/${SOURCE_BUCKET}/([^?\\s"'<>]+)`,
  'i'
);

function* walkStrings(o) {
  if (o == null) return;
  if (typeof o === 'string') { yield o; return; }
  if (Array.isArray(o)) { for (const v of o) yield* walkStrings(v); return; }
  if (typeof o === 'object') { for (const v of Object.values(o)) yield* walkStrings(v); }
}

async function discoverAllSourcePaths() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/export-all-tts-json`, {
    headers: { apikey: ANON_KEY }
  });
  if (!res.ok) throw new Error(`export-all-tts-json: HTTP ${res.status}`);
  const data = await res.json();
  const paths = new Set();
  for (const s of walkStrings(data)) {
    const matches = s.match(URL_RE);
    if (!matches) continue;
    for (const u of matches) {
      const m = u.replace(/[",\\;]+$/, '').match(SOURCE_URL_RE);
      if (m) paths.add(decodeURIComponent(m[1]).split('?')[0]);
    }
  }
  return [...paths];
}

async function callCompressOnce(paths) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/compress-pending-assets`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      authorization: `Bearer ${ANON_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ paths })
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Retries transient worker failures (resource limit / 5xx) with backoff.
async function callCompress(paths) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callCompressOnce(paths);
    } catch (e) {
      lastErr = e;
      const retriable = !e.status || e.status >= 500;
      if (!retriable || attempt === MAX_RETRIES) break;
      const backoff = 1500 * attempt;
      log(`  ⚠ ${e.message.slice(0, 80)} — retry ${attempt}/${MAX_RETRIES - 1} in ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

const stamp = () => new Date().toLocaleTimeString();
const log = (m) => console.log(`[${stamp()}] ${m}`);

(async () => {
  let allPaths;
  if (PATHS_FILE) {
    allPaths = readFileSync(resolve(ROOT, PATHS_FILE), 'utf8')
      .split('\n').map((l) => l.trim()).filter(Boolean);
    log(`Reprocessing ${allPaths.length} explicit paths from ${PATHS_FILE} (chunk=${CHUNK})…`);
  } else {
    log(`Force-recompressing all assets (chunk=${CHUNK})…`);
    allPaths = await discoverAllSourcePaths();
    log(`Discovered ${allPaths.length} source assets in ${SOURCE_BUCKET}/`);
  }
  if (allPaths.length === 0) { log('Nothing to do — aborting.'); return; }

  let done = 0, errors = 0;
  const failedPaths = [];
  const total = Math.ceil(allPaths.length / CHUNK);
  for (let i = 0; i < allPaths.length; i += CHUNK) {
    const chunk = allPaths.slice(i, i + CHUNK);
    const n = Math.floor(i / CHUNK) + 1;
    try {
      const res = await callCompress(chunk);
      done += res.processed;
      errors += res.errors.length;
      log(`chunk ${n}/${total}: ${res.processed}/${chunk.length} ok, ${res.errors.length} err, ${res.durationMs} ms  (${done}/${allPaths.length} total)`);
      for (const err of res.errors.slice(0, 3)) {
        log(`  ✗ ${err.source_path}: ${err.error}`);
        failedPaths.push(err.source_path);
      }
    } catch (e) {
      // Whole chunk failed even after retries — record paths, keep going.
      errors += chunk.length;
      failedPaths.push(...chunk);
      log(`chunk ${n}/${total}: FAILED (${chunk.length} paths) — ${e.message.slice(0, 100)}`);
    }
  }
  log(`Done. Processed ${done}/${allPaths.length}, errors ${errors}.`);
  if (failedPaths.length) {
    log(`Failed paths (${failedPaths.length}):`);
    for (const p of failedPaths) log(`  - ${p}`);
  }
  process.exit(errors > 0 ? 1 : 0);
})().catch((e) => { log(`✗ ${e.message}`); process.exit(1); });
