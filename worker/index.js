import { market } from './market.js';
// AIX ALPHA cloud backend (Cloudflare Worker). Always on, no machine needed.
// Holds YOUR Anthropic key as a secret; meters users in credits; Stripe-ready.
const CREDIT_USD = 0.0014;
const PRICE = { in: 0.10, out: 0.50, cr: 0.01, cw: 0.125 };           // USD per million tokens (Haiku 5.5)
const PACKS = { 9.99: 100 };   // the only way to get credits: $9.99 = 100 credits via the Stripe Payment Link
const MODEL = 'claude-haiku-5-5';
const enc = new TextEncoder();

const cors = (env, req) => {
  const allow = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const o = req.headers.get('origin') || '';
  const ok = allow.includes('*') ? '*' : allow.includes(o) ? o : '';
  return { 'access-control-allow-origin': ok, 'access-control-allow-headers': 'content-type, authorization, x-admin-token, x-meter, x-node-secret', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS', vary: 'Origin' };
};
const json = (env, req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(env, req) } });
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const owners = (env) => (env.OWNER_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const view = (a) => ({ free_claimed: !!a.free_claimed, username: a.username || null, email: a.email, credits: +Number(a.credits).toFixed(2), tokens: a.tokens, requests: a.requests });
const vw = (env, a) => ({ ...view(a), owner: owners(env).includes(a.email) });
const getUser = (env, email) => env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
// One account per person: emails are normalised so +tags and Gmail dots can't make a second account.
const normId = (x) => { let v = String(x || '').trim().toLowerCase(); if (v.includes('@')) { let [l, d] = v.split('@'); l = l.split('+')[0]; if (d === 'gmail.com' || d === 'googlemail.com') { l = l.replace(/\./g, ''); d = 'gmail.com'; } v = l + '@' + d; } return v; };
const validId = (v) => v.includes('@') ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && v.length <= 64 : /^[a-z0-9_.-]{3,24}$/.test(v);
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const pbk = async (pw, salt) => hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']), 256)));
const newToken = () => 'aix_' + hex(crypto.getRandomValues(new Uint8Array(24)));
async function startSession(env, email) { const t = newToken(); await env.DB.prepare('INSERT INTO sessions(token_hash,email,created) VALUES(?,?,?)').bind(await sha(t), email, new Date().toISOString()).run(); return t; }
async function authed(env, req) {
  const a = await authed0(env, req);
  if (a && req.headers.get('x-meter') === '1') a.meter = true;   // owner opted to be charged like a member (for testing credits)
  return a;
}
const AUTH_C = new Map();   // short isolate cache of sign-in lookups; balances are re-read where money moves
async function authed0(env, req) {
  const h = req.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!t) return null;
  const th = await sha(t);
  const hit = AUTH_C.get(th); if (hit && Date.now() - hit.t < 20000) return { ...hit.a };
  const u = (await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.email=s.email WHERE s.token_hash=?').bind(th).first()) || (await env.DB.prepare('SELECT * FROM users WHERE token_hash=?').bind(th).first());
  if (u) { if (AUTH_C.size > 200) AUTH_C.clear(); AUTH_C.set(th, { t: Date.now(), a: u }); }
  return u;
}
const SEARCH_USD = 0.01;            // Anthropic web search: $10 per 1,000 searches (~7 credits each)
const SEARCH_MIN_CREDITS = 8;       // a user needs at least this balance to allow live search on a reply
const costUsd = (u) => (u.searches || 0) * SEARCH_USD + ((u.input || 0) * PRICE.in + (u.output || 0) * PRICE.out + (u.cacheRead || 0) * PRICE.cr + (u.cacheWrite || 0) * PRICE.cw) / 1e6;

// Atomic in SQL: no lost updates when requests overlap.
async function charge(env, a, usage) {
  const cr = costUsd(usage) / CREDIT_USD, now = new Date().toISOString(), tok = (usage.input || 0) + (usage.output || 0);
  const owner = owners(env).includes(a.email) && !a.meter;
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET credits=' + (owner ? 'credits' : 'MAX(0,credits-?)') + ', tokens=tokens+?, requests=requests+1, last=? WHERE email=?').bind(...(owner ? [tok, now, a.email] : [cr, tok, now, a.email])),
    env.DB.prepare('INSERT INTO usage(email,at,input,output,credits) VALUES(?,?,?,?,?)').bind(a.email, now, usage.input || 0, usage.output || 0, owner ? 0 : cr),
  ]);
  const f = await getUser(env, a.email);
  return { credits: +Number(f.credits).toFixed(2), spentCredits: +cr.toFixed(3), searches: usage.searches || 0 };
}


// ---- Mac/Ollama node registered with this Worker: ECO/BALANCED replies run there, billed like Haiku, falling back to Haiku if the node is down ----
let NODE_C = null, NODE_T = 0;   // isolate cache: spares D1 reads on every poll
async function nodeGet(env) {
  try { if (Date.now() - NODE_T < 30000) return NODE_C; const r = await env.DB.prepare("SELECT v FROM settings WHERE k='node'").first(); let n = null; if (r) { n = JSON.parse(r.v); if (Date.now() - n.at >= 420000) n = null; } NODE_C = n; NODE_T = Date.now(); return n; } catch { return null; }
}
async function viaNode(env, req, a, nd, prompt, stream, maxTok) {
  let up;
  try {
    up = await nfetch(nd.url.replace(/\/+$/, '') + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + nd.token, 'x-aix-user': a.email, 'x-aix-src': 'chat' }, body: JSON.stringify({ model: nd.model, stream, max_tokens: maxTok, messages: [{ role: 'user', content: prompt }] }) }, stream ? 20000 : 90000);
  } catch { return null; }
  if (!up.ok) return null;
  const inTok = Math.ceil(prompt.length / 4);
  if (!stream) {
    const j = await up.json().catch(() => null); if (!j) return null; const ch = (j.choices || [])[0] || {}; const text = (ch.message && ch.message.content) || '';
    const bill = await charge(env, a, { input: j.usage?.prompt_tokens || inTok, output: j.usage?.completion_tokens || Math.ceil(text.length / 4) });
    return json(env, req, { text, truncated: ch.finish_reason === 'length', engine: 'node', ...bill });
  }
  let buf = '', outChars = 0; const dec = new TextDecoder();
  const ts = new TransformStream({
    transform(chunk, ctl) {
      buf += dec.decode(chunk, { stream: true }); const lines = buf.split('\n'); buf = lines.pop();
      for (const ln of lines) if (ln.startsWith('data:') && !ln.includes('[DONE]')) { try { const e = JSON.parse(ln.slice(5)); const t = e.choices?.[0]?.delta?.content; if (t) { outChars += t.length; ctl.enqueue(enc.encode('data: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: t } }) + '\n\n')); } } catch {} }
    },
    async flush(ctl) { const bill = await charge(env, a, { input: inTok, output: Math.ceil(outChars / 4) }); ctl.enqueue(enc.encode('data: ' + JSON.stringify({ type: 'aix_balance', engine: 'node', ...bill }) + '\n\n')); },
  });
  return new Response(up.body.pipeThrough(ts), { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', ...cors(env, req) } });
}

async function sample(env, req) {
  const a = await authed(env, req);
  if (!a) return json(env, req, { error: 'Sign in to use AIX.' }, 401);
  if (a.credits <= 0 && !(owners(env).includes(a.email) && !a.meter)) return json(env, req, { error: 'Out of credits. Top up to continue.' }, 402);
  if (!(owners(env).includes(a.email) && !a.meter) && rateLimited(env, a)) return json(env, req, { error: 'Slow down: too many requests this minute. Try again in a few seconds.' }, 429);
  const b = await req.json().catch(() => ({}));
  const prompt = String(b.prompt || ''); if (!prompt) return json(env, req, { error: 'prompt required' }, 400);
  const stream = !!b.stream;
  const owner = owners(env).includes(a.email) && !a.meter;
  const search = !!b.search && (owner || a.credits >= SEARCH_MIN_CREDITS);
  const content = (Array.isArray(b.images) ? b.images.slice(0, 4) : []).map((i) => ({ type: 'image', source: { type: 'base64', media_type: String(i.media_type || 'image/png'), data: String(i.data || '') } }));
  content.push({ type: 'text', text: prompt });
  if (!(Array.isArray(b.images) && b.images.length) && !b.search && ['eco', 'balanced'].includes(String(b.mode || ''))) { const nd = await nodeGet(env); if (nd) { const r = await viaNode(env, req, a, nd, prompt, stream, Math.min(Number(b.max_tokens) || 4096, 8192)); if (r) return r; } }
  const call = (withSearch) => fetch(env.UPSTREAM_URL || 'https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: MODEL, max_tokens: Math.min(Number(b.max_tokens) || 4096, 8192), stream, ...(withSearch ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] } : {}), messages: [{ role: 'user', content }] }) });
  let up = await call(search);
  if (!up.ok && search && up.status === 400) up = await call(false);       // search not available: answer without it
  if (!up.ok) {
    const bad = up.status === 401 || up.status === 403;
    return json(env, req, { error: bad ? 'The owner API key was rejected by Anthropic. The owner must update the ANTHROPIC_API_KEY secret.' : 'Model request failed (' + up.status + ').' }, up.status === 429 ? 429 : 502);
  }
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 };
  if (!stream) {
    const j = await up.json(); usage.input = j.usage?.input_tokens || 0; usage.output = j.usage?.output_tokens || 0; usage.searches = j.usage?.server_tool_use?.web_search_requests || 0;
    const bill = await charge(env, a, usage);
    return json(env, req, { text: (j.content || []).map((c) => c.text || '').join(''), truncated: j.stop_reason === 'max_tokens', ...bill });
  }
  let buf = ''; const dec = new TextDecoder();
  const ts = new TransformStream({
    transform(chunk, ctl) {
      ctl.enqueue(chunk); buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const ln of lines) if (ln.startsWith('data:')) { try { const e = JSON.parse(ln.slice(5)); if (e.type === 'message_start') usage.input = e.message?.usage?.input_tokens || 0; if (e.type === 'message_delta') { usage.output = e.usage?.output_tokens || usage.output; usage.searches = e.usage?.server_tool_use?.web_search_requests || usage.searches; } } catch {} }
    },
    async flush(ctl) { const bill = await charge(env, a, usage); ctl.enqueue(enc.encode('data: ' + JSON.stringify({ type: 'aix_balance', ...bill }) + '\n\n')); },
  });
  return new Response(up.body.pipeThrough(ts), { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', ...cors(env, req) } });
}

async function stripe(env, req) {
  const raw = await req.text(); const sig = req.headers.get('stripe-signature') || '';
  const p = Object.fromEntries(sig.split(',').map((x) => x.split('=')));
  const key = await crypto.subtle.importKey('raw', enc.encode(env.STRIPE_WEBHOOK_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${p.t}.${raw}`)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (!env.STRIPE_WEBHOOK_SECRET || mac !== p.v1) return new Response('bad signature', { status: 400 });
  const ev = JSON.parse(raw);
  if (ev.type === 'checkout.session.completed') {
    const o = ev.data.object, usd = (o.amount_total || 0) / 100, credits = (o.payment_link === 'plink_1UXx949X5nbnHzOgDiBZGcEO' && o.payment_status === 'paid') ? PACKS[usd] : 0;   // only the $9.99 credits link
    const email = String(o.client_reference_id || o.customer_details?.email || '').toLowerCase();
    if (credits && (await getUser(env, email))) {
      const ins = await env.DB.prepare('INSERT OR IGNORE INTO purchases(email,at,usd,credits,ref) VALUES(?,?,?,?,?)').bind(email, new Date().toISOString(), usd, credits, o.id).run();
      if (ins.meta?.changes > 0) await env.DB.prepare('UPDATE users SET credits=credits+? WHERE email=?').bind(credits, email).run();
    }
  }
  return new Response('{"received":true}', { headers: { 'content-type': 'application/json' } });
}

// ---- Scheduled tasks: run on time via a Cron Trigger even when no page is open ----
let JOBS_READY = true;
async function ensureJobs(env) {
  if (JOBS_READY) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, email TEXT NOT NULL, title TEXT, prompt TEXT, due INTEGER, repeat TEXT DEFAULT \'none\', status TEXT DEFAULT \'pending\', last INTEGER, result TEXT, engine TEXT, created INTEGER)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS job_runs(id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, at INTEGER, result TEXT, engine TEXT)').run();
  JOBS_READY = true;
}
const JOB_STEP = { hourly: 3600e3, daily: 86400e3, weekly: 604800e3 };
const stepOf = (r) => JOB_STEP[r] || (/^every:\d+$/.test(r || '') ? Math.max(5, Math.min(+r.slice(6), 10080)) * 60e3 : 0);
async function runPrompt(env, a, prompt) {
  const nd = await nodeGet(env);
  if (nd) {
    try {
      const up = await fetch(nd.url.replace(/\/+$/, '') + '/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(90000), headers: { 'content-type': 'application/json', authorization: 'Bearer ' + nd.token, 'x-aix-user': a.email, 'x-aix-src': 'task' }, body: JSON.stringify({ model: nd.model, stream: false, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }) });
      if (up.ok) { const j = await up.json(); const t = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''; if (t) { await charge(env, a, { input: (j.usage && j.usage.prompt_tokens) || Math.ceil(prompt.length / 4), output: (j.usage && j.usage.completion_tokens) || Math.ceil(t.length / 4) }); return { text: t, engine: 'node' }; } }
    } catch (e) { /* fall through to cloud */ }
  }
  const r = await fetch(env.UPSTREAM_URL || 'https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: MODEL, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }) });
  if (!r.ok) throw new Error('model error ' + r.status);
  const j = await r.json(); const t = (j.content || []).map((c) => c.text || '').join('');
  await charge(env, a, { input: (j.usage && j.usage.input_tokens) || 0, output: (j.usage && j.usage.output_tokens) || 0 });
  return { text: t, engine: 'cloud' };
}
async function runJob(env, j) {
  const now = Date.now(); let result = '', engine = '';
  try {
    if (!j.prompt) { result = 'Reminder: ' + (j.title || ''); engine = 'reminder'; }
    else {
      const a = await getUser(env, j.email);
      if (!a) result = 'Skipped: account not found.';
      else if (a.credits <= 0 && !owners(env).includes(a.email)) result = 'Skipped: out of credits. Top up and run it again.';
      else { const r = await runPrompt(env, a, j.prompt); result = r.text; engine = r.engine; }
    }
  } catch (e) { result = 'Failed: ' + (e && e.message ? e.message : e); }
  const step = stepOf(j.repeat);
  let nextDue = j.due, status = 'done';
  if (step) { nextDue = j.due + step; while (nextDue <= now) nextDue += step; status = 'pending'; }
  await env.DB.prepare('INSERT INTO job_runs(job_id,at,result,engine) VALUES(?,?,?,?)').bind(j.id, now, String(result).slice(0, 8000), engine).run();
  await env.DB.prepare('DELETE FROM job_runs WHERE job_id=? AND id NOT IN (SELECT id FROM job_runs WHERE job_id=? ORDER BY id DESC LIMIT 30)').bind(j.id, j.id).run();
  await env.DB.prepare('UPDATE jobs SET status=?, due=?, last=?, result=?, engine=? WHERE id=?').bind(status, nextDue, now, String(result).slice(0, 6000), engine, j.id).run();
}
async function runDueJobs(env) {
  await ensureJobs(env);
  const rows = (await env.DB.prepare("SELECT * FROM jobs WHERE status='pending' AND due<=? ORDER BY due LIMIT 5").bind(Date.now()).all()).results || [];
  for (const j of rows) { await env.DB.prepare("UPDATE jobs SET status='running' WHERE id=? AND status='pending'").bind(j.id).run(); await runJob(env, j); }
  // un-stick anything left 'running' for over 10 minutes
  await env.DB.prepare("UPDATE jobs SET status='pending' WHERE status='running' AND (last IS NULL OR last<?)").bind(Date.now() - 600e3).run();
}
let SYNC_READY = true;
const SYNC_KEYS = ['aix3_chats', 'aix3_ws', 'aix3_memory', 'aix3_personas', 'aix3_remind'];
async function ensureSync(env) {
  if (SYNC_READY) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS sync(email TEXT NOT NULL, k TEXT NOT NULL, v TEXT, updated INTEGER, PRIMARY KEY(email,k))').run();
  SYNC_READY = true;
}
// Per-account cloud sync: GET returns everything; PUT stores each key (newest write wins).
async function syncApi(env, req) {
  const a = await authed(env, req);
  if (!a) return json(env, req, { error: 'Sign in to sync.' }, 401);
  await ensureSync(env);
  if (req.method === 'GET') {
    const rows = (await env.DB.prepare('SELECT k,v,updated FROM sync WHERE email=?').bind(a.email).all()).results || [];
    const items = {}; rows.forEach((r) => { items[r.k] = { v: r.v, updated: r.updated }; });
    return json(env, req, { items });
  }
  if (req.method === 'PUT') {
    const b = await req.json().catch(() => ({})); const items = b.items || {}; const saved = [];
    for (const k of Object.keys(items)) {
      if (!SYNC_KEYS.includes(k)) continue;
      const v = String(items[k].v == null ? '' : items[k].v); if (v.length > 1500000) continue;
      const upd = Math.min(+items[k].updated || Date.now(), Date.now() + 60000);
      await env.DB.prepare('INSERT INTO sync(email,k,v,updated) VALUES(?,?,?,?) ON CONFLICT(email,k) DO UPDATE SET v=excluded.v, updated=excluded.updated WHERE excluded.updated>=sync.updated').bind(a.email, k, v, upd).run();
      saved.push(k);
    }
    return json(env, req, { ok: true, saved });
  }
  return json(env, req, { error: 'method' }, 405);
}
// Best-effort per-account rate limit (per Worker isolate): RATE_PER_MIN requests/minute, owner exempt.
const RL = new Map();
function rateLimited(env, a) {
  const cap = +(env.RATE_PER_MIN || 20); const m = Math.floor(Date.now() / 60000), key = a.email;
  const e = RL.get(key); if (!e || e.m !== m) { RL.set(key, { m, n: 1 }); if (RL.size > 5000) RL.clear(); return false; }
  e.n++; return e.n > cap;
}
async function jobsApi(env, req, path) {
  const a = await authed(env, req);
  if (!a) return json(env, req, { error: 'Sign in to schedule tasks.' }, 401);
  await ensureJobs(env);
  const view = (r) => ({ id: r.id, title: r.title, prompt: r.prompt, due: r.due, repeat: r.repeat, status: r.status, last: r.last, result: r.result, engine: r.engine });
  if (path === '/api/jobs' && req.method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM jobs WHERE email=? ORDER BY due LIMIT 100').bind(a.email).all()).results || [];
    return json(env, req, { jobs: rows.map(view), cron: true });
  }
  const b = await req.json().catch(() => ({}));
  if (path === '/api/jobs' && req.method === 'POST') {
    const title = String(b.title || '').trim().slice(0, 200), prompt = String(b.prompt || '').trim().slice(0, 4000), due = Number(b.due) || 0;
    if (!title || !due) return json(env, req, { error: 'title and due time required' }, 400);
    const repeat = stepOf(b.repeat) ? b.repeat : 'none';
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM jobs WHERE email=?').bind(a.email).first()).n;
    if (n >= 50) return json(env, req, { error: 'Limit of 50 scheduled tasks. Delete some first.' }, 400);
    const id = 'j_' + [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare('INSERT INTO jobs(id,email,title,prompt,due,repeat,status,created) VALUES(?,?,?,?,?,?,?,?)').bind(id, a.email, title, prompt, due, repeat, 'pending', Date.now()).run();
    return json(env, req, { id });
  }
  const id = String(b.id || '');
  const j = await env.DB.prepare('SELECT * FROM jobs WHERE id=? AND email=?').bind(id, a.email).first();
  if (!j) return json(env, req, { error: 'not found' }, 404);
  if (path === '/api/jobs/runs') { const rr = (await env.DB.prepare('SELECT at,result,engine FROM job_runs WHERE job_id=? ORDER BY id DESC LIMIT 30').bind(id).all()).results || []; return json(env, req, { runs: rr }); }
  if (path === '/api/jobs/delete') { await env.DB.prepare('DELETE FROM jobs WHERE id=?').bind(id).run(); await env.DB.prepare('DELETE FROM job_runs WHERE job_id=?').bind(id).run(); return json(env, req, { ok: true }); }
  if (path === '/api/jobs/run') { await env.DB.prepare("UPDATE jobs SET status='running', last=? WHERE id=?").bind(Date.now(), id).run(); await runJob(env, { ...j, due: Date.now() }); const r = await env.DB.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first(); return json(env, req, { job: view(r) }); }
  return json(env, req, { error: 'unknown' }, 404);
}

// ---- Public API: user-created keys, OpenAI-compatible endpoint, credits billed per request ----
async function nfetch(url, init, ms) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...init, signal: ac.signal }); } finally { clearTimeout(t); }
}
let KEYS_READY = true;
async function ensureKeys(env) {
  if (KEYS_READY) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS api_keys(key_hash TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT, prefix TEXT, created INTEGER, last INTEGER, requests INTEGER DEFAULT 0)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS api_keys_email ON api_keys(email)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS api_usage(id INTEGER PRIMARY KEY AUTOINCREMENT, key_hash TEXT NOT NULL, email TEXT NOT NULL, at INTEGER, input INTEGER, output INTEGER, credits REAL, engine TEXT)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS api_usage_email ON api_usage(email, at)').run();
  for (const col of ['tokens INTEGER DEFAULT 0', 'credits REAL DEFAULT 0']) { try { await env.DB.prepare('ALTER TABLE api_keys ADD COLUMN ' + col).run(); } catch (e) { /* already there */ } }
  KEYS_READY = true;
}
async function chargeKey(env, a, kr, engine, u) {
  const bill = await charge(env, a, u);
  const tok = (u.input || 0) + (u.output || 0);
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO api_usage(key_hash,email,at,input,output,credits,engine) VALUES(?,?,?,?,?,?,?)').bind(kr.key_hash, a.email, Date.now(), u.input || 0, u.output || 0, bill.spentCredits || 0, engine),
      env.DB.prepare('UPDATE api_keys SET tokens=COALESCE(tokens,0)+?, credits=COALESCE(credits,0)+? WHERE key_hash=?').bind(tok, bill.spentCredits || 0, kr.key_hash),
    ]);
  } catch (e) { /* tracking must never break a reply */ }
  return bill;
}
async function keysApi(env, req, path) {
  const a = await authed(env, req);
  if (!a) return json(env, req, { error: 'Sign in first.' }, 401);
  await ensureKeys(env);
  if (path === '/api/keys' && req.method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM api_keys WHERE email=? ORDER BY created DESC').bind(a.email).all()).results || [];
    return json(env, req, { keys: rows.map((r) => ({ id: r.key_hash.slice(0, 12), name: r.name, prefix: r.prefix, created: r.created, last: r.last, requests: r.requests, tokens: r.tokens || 0, credits: +(r.credits || 0).toFixed(3) })), base: new URL(req.url).origin + '/v1' });
  }
  if (path === '/api/keys/stats' && req.method === 'GET') {
    const now = Date.now(), q = async (sql, ...p) => ((await env.DB.prepare(sql).bind(...p).all()).results || []);
    const tot = async (since) => (await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(input),0) AS i, COALESCE(SUM(output),0) AS o, COALESCE(SUM(credits),0) AS c FROM api_usage WHERE email=? AND at>?').bind(a.email, since).first());
    const [all, d1, d7, d30] = await Promise.all([tot(0), tot(now - 86400e3), tot(now - 7 * 86400e3), tot(now - 30 * 86400e3)]);
    const fm = (r) => ({ requests: r.n, input: r.i, output: r.o, tokens: r.i + r.o, credits: +Number(r.c).toFixed(3) });
    const byKey = await q('SELECT k.key_hash AS h, k.name AS name, k.prefix AS prefix, COUNT(u.id) AS n, COALESCE(SUM(u.input+u.output),0) AS t, COALESCE(SUM(u.credits),0) AS c, MAX(u.at) AS last FROM api_keys k LEFT JOIN api_usage u ON u.key_hash=k.key_hash WHERE k.email=? GROUP BY k.key_hash ORDER BY c DESC', a.email);
    const byEngine = await q('SELECT engine, COUNT(*) AS n, COALESCE(SUM(input+output),0) AS t, COALESCE(SUM(credits),0) AS c FROM api_usage WHERE email=? GROUP BY engine', a.email);
    const daily = await q("SELECT strftime('%Y-%m-%d', at/1000, 'unixepoch') AS d, COUNT(*) AS n, COALESCE(SUM(input+output),0) AS t, COALESCE(SUM(credits),0) AS c FROM api_usage WHERE email=? AND at>? GROUP BY d ORDER BY d", a.email, now - 14 * 86400e3);
    const recent = await q('SELECT u.at AS at, k.name AS name, u.engine AS engine, u.input AS i, u.output AS o, u.credits AS c FROM api_usage u LEFT JOIN api_keys k ON k.key_hash=u.key_hash WHERE u.email=? ORDER BY u.id DESC LIMIT 25', a.email);
    const f = await getUser(env, a.email);
    return json(env, req, { balance: +Number(f.credits).toFixed(2), unlimited: owners(env).includes(a.email), all: fm(all), d1: fm(d1), d7: fm(d7), d30: fm(d30), byKey: byKey.map((r) => ({ id: r.h.slice(0, 12), name: r.name, prefix: r.prefix, requests: r.n, tokens: r.t, credits: +Number(r.c).toFixed(3), last: r.last })), byEngine: byEngine.map((r) => ({ engine: r.engine, requests: r.n, tokens: r.t, credits: +Number(r.c).toFixed(3) })), daily: daily.map((r) => ({ day: r.d, requests: r.n, tokens: r.t, credits: +Number(r.c).toFixed(3) })), recent: recent.map((r) => ({ at: r.at, key: r.name, engine: r.engine, input: r.i, output: r.o, credits: +Number(r.c).toFixed(3) })) });
  }
  const b = await req.json().catch(() => ({}));
  if (path === '/api/keys' && req.method === 'POST') {
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM api_keys WHERE email=?').bind(a.email).first()).n;
    if (n >= 10) return json(env, req, { error: 'Limit of 10 keys. Revoke one first.' }, 400);
    const key = 'aixk_' + hex(crypto.getRandomValues(new Uint8Array(24)));
    const kh = await sha(key);
    await env.DB.prepare('INSERT INTO api_keys(key_hash,email,name,prefix,created,requests) VALUES(?,?,?,?,?,0)').bind(kh, a.email, String(b.name || 'My key').slice(0, 60), key.slice(0, 11) + '…' + key.slice(-4), Date.now()).run();
    return json(env, req, { key, id: kh.slice(0, 12) });
  }
  if (path === '/api/keys/delete') {
    const id = String(b.id || '').replace(/[^0-9a-f]/g, '').slice(0, 12); if (id.length < 12) return json(env, req, { error: 'bad id' }, 400);
    await env.DB.prepare("DELETE FROM api_keys WHERE email=? AND key_hash LIKE ?").bind(a.email, id + '%').run();
    return json(env, req, { ok: true });
  }
  return json(env, req, { error: 'unknown' }, 404);
}
const oaiErr = (env, req, status, msg, code) => json(env, req, { error: { message: msg, type: status === 401 ? 'invalid_request_error' : status === 402 ? 'insufficient_credits' : 'api_error', code: code || null } }, status);
const oaiId = () => 'chatcmpl-' + hex(crypto.getRandomValues(new Uint8Array(10)));
function anthropicToOai(env, a, kr, id, inTok0) {
  let buf = '', inTok = inTok0, outTok = 0; const dec = new TextDecoder();
  const chunk = (delta, fin) => enc.encode('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'aix-alpha', choices: [{ index: 0, delta, finish_reason: fin || null }] }) + '\n\n');
  return new TransformStream({
    transform(c, ctl) {
      buf += dec.decode(c, { stream: true }); const lines = buf.split('\n'); buf = lines.pop();
      for (const ln of lines) {
        if (!ln.startsWith('data:')) continue; let e; try { e = JSON.parse(ln.slice(5)); } catch { continue; }
        if (e.type === 'message_start') { inTok = (e.message && e.message.usage && e.message.usage.input_tokens) || inTok; ctl.enqueue(chunk({ role: 'assistant', content: '' })); }
        else if (e.type === 'content_block_delta' && e.delta && e.delta.text) ctl.enqueue(chunk({ content: e.delta.text }));
        else if (e.type === 'message_delta') { outTok = (e.usage && e.usage.output_tokens) || outTok; ctl.enqueue(chunk({}, e.delta && e.delta.stop_reason === 'max_tokens' ? 'length' : 'stop')); }
      }
    },
    async flush(ctl) { ctl.enqueue(enc.encode('data: [DONE]\n\n')); await chargeKey(env, a, kr, 'cloud', { input: inTok, output: outTok }); },
  });
}
async function v1Api(env, req, path) {
  if (path === '/v1/models' && req.method === 'GET') return json(env, req, { object: 'list', data: [{ id: 'aix-alpha', object: 'model', owned_by: 'aix' }, { id: 'aix-alpha-cloud', object: 'model', owned_by: 'aix' }] });
  if (path !== '/v1/chat/completions' || req.method !== 'POST') return oaiErr(env, req, 404, 'Unknown endpoint. Use POST /v1/chat/completions.');
  const h = req.headers.get('authorization') || ''; const key = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!/^aixk_[0-9a-f]{48}$/.test(key)) return oaiErr(env, req, 401, 'Invalid API key. Create one on the API page of AIX Alpha.', 'invalid_api_key');
  await ensureKeys(env);
  const kr = await env.DB.prepare('SELECT * FROM api_keys WHERE key_hash=?').bind(await sha(key)).first();
  if (!kr) return oaiErr(env, req, 401, 'Invalid or revoked API key.', 'invalid_api_key');
  const a = await getUser(env, kr.email);
  if (!a) return oaiErr(env, req, 401, 'Account not found.', 'invalid_api_key');
  if (a.credits <= 0 && !owners(env).includes(a.email)) return oaiErr(env, req, 402, 'Out of credits. Add credits to your AIX account.', 'insufficient_credits');
  return v1Run(env, req, kr, a, await req.json().catch(() => null));
}
async function v1Run(env, req, kr, a, b) {
  if (!b || !Array.isArray(b.messages) || !b.messages.length) return oaiErr(env, req, 400, 'messages array required');
  const txt = (c) => typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => (p && p.type === 'text' ? p.text : '')).join('') : '';
  const msgs = b.messages.slice(-100).map((m) => ({ role: ['system', 'assistant'].includes(m.role) ? m.role : 'user', content: txt(m.content) })).filter((m) => m.content);
  const total = msgs.reduce((n, m) => n + m.content.length, 0);
  if (!msgs.length || total > 400000) return oaiErr(env, req, 400, 'messages empty or too long (limit about 100k tokens)');
  const maxTok = Math.max(1, Math.min(Number(b.max_tokens || b.max_completion_tokens) || 1024, 4096)), stream = !!b.stream, id = oaiId();
  const temp = typeof b.temperature === 'number' ? Math.max(0, Math.min(b.temperature, 2)) : undefined;
  await env.DB.prepare('UPDATE api_keys SET last=?, requests=requests+1 WHERE key_hash=?').bind(Date.now(), kr.key_hash).run();
  const sse = { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', ...cors(env, req) };
  const inTok = Math.ceil(total / 4);
  // 1) your Mac node, when online (unless the cloud model was asked for)
  const nd = b.model === 'aix-alpha-cloud' ? null : await nodeGet(env);
  if (nd) {
    try {
      const up = await nfetch(nd.url.replace(/\/+$/, '') + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + nd.token, 'x-aix-user': a.email, 'x-aix-src': 'api' }, body: JSON.stringify({ model: nd.model, stream, max_tokens: maxTok, temperature: temp, messages: msgs }) }, stream ? 20000 : 110000);
      if (up.ok) {
        if (!stream) {
          const j = await up.json(); const ch = (j.choices || [])[0] || {}; const t = (ch.message && ch.message.content) || '';
          const u = { prompt_tokens: (j.usage && j.usage.prompt_tokens) || inTok, completion_tokens: (j.usage && j.usage.completion_tokens) || Math.ceil(t.length / 4) };
          await chargeKey(env, a, kr, 'node', { input: u.prompt_tokens, output: u.completion_tokens });
          return json(env, req, { id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'aix-alpha', choices: [{ index: 0, message: { role: 'assistant', content: t }, finish_reason: ch.finish_reason === 'length' ? 'length' : 'stop' }], usage: { ...u, total_tokens: u.prompt_tokens + u.completion_tokens } });
        }
        let buf = '', outChars = 0; const dec = new TextDecoder();
        const ts = new TransformStream({
          transform(c, ctl) { ctl.enqueue(c); buf += dec.decode(c, { stream: true }); const lines = buf.split('\n'); buf = lines.pop(); for (const ln of lines) if (ln.startsWith('data:') && !ln.includes('[DONE]')) { try { const e = JSON.parse(ln.slice(5)); const t = e.choices && e.choices[0] && e.choices[0].delta && e.choices[0].delta.content; if (t) outChars += t.length; } catch { /* ignore */ } } },
          async flush() { await chargeKey(env, a, kr, 'node', { input: inTok, output: Math.ceil(outChars / 4) }); },
        });
        return new Response(up.body.pipeThrough(ts), { headers: sse });
      }
    } catch (e) { /* node unreachable: fall back to cloud */ }
  }
  // 2) cloud model
  const sys = msgs.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  let conv = msgs.filter((m) => m.role !== 'system'); if (!conv.length) conv = [{ role: 'user', content: sys }];
  const merged = []; for (const m of conv) { const l = merged[merged.length - 1]; if (l && l.role === m.role) l.content += '\n\n' + m.content; else merged.push({ ...m }); }
  if (merged[0].role !== 'user') merged.unshift({ role: 'user', content: '(continue)' });
  const up = await fetch(env.UPSTREAM_URL || 'https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: MODEL, max_tokens: maxTok, stream, ...(sys ? { system: sys } : {}), ...(temp !== undefined ? { temperature: Math.min(temp, 1) } : {}), messages: merged }) });
  if (!up.ok) return oaiErr(env, req, 502, 'Upstream model error (' + up.status + '). Try again.');
  if (stream) return new Response(up.body.pipeThrough(anthropicToOai(env, a, kr, id, inTok)), { headers: sse });
  const j = await up.json(); const t = (j.content || []).map((c) => c.text || '').join(''); const u = { prompt_tokens: (j.usage && j.usage.input_tokens) || inTok, completion_tokens: (j.usage && j.usage.output_tokens) || Math.ceil(t.length / 4) };
  await chargeKey(env, a, kr, 'cloud', { input: u.prompt_tokens, output: u.completion_tokens });
  return json(env, req, { id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'aix-alpha', choices: [{ index: 0, message: { role: 'assistant', content: t }, finish_reason: j.stop_reason === 'max_tokens' ? 'length' : 'stop' }], usage: { ...u, total_tokens: u.prompt_tokens + u.completion_tokens } });
}

// ---- Automatic backups: compact gzipped JSON of all important tables, once every 24h, last 14 kept in D1 ----
let BK_READY = true;
async function ensureBackups(env) {
  if (BK_READY) return; BK_READY = true;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS backups(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, rows INTEGER, bytes INTEGER, kind TEXT, data TEXT)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS grants(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, at INTEGER, credits REAL, note TEXT)').run();
}
async function makeBackup(env, kind) {
  await ensureBackups(env); await ensureKeys(env); await ensureJobs(env);
  const now = Date.now(), d30 = new Date(now - 30 * 86400e3).toISOString();
  const spec = [['users', 'SELECT * FROM users'], ['purchases', 'SELECT * FROM purchases'], ['grants', 'SELECT * FROM grants'], ['api_keys', 'SELECT * FROM api_keys'], ['jobs', 'SELECT * FROM jobs'], ['apps', 'SELECT * FROM apps'], ['app_sales', 'SELECT * FROM app_sales'], ['settings', 'SELECT * FROM settings'],
    ['usage', 'SELECT * FROM usage WHERE at>=? ORDER BY id DESC LIMIT 20000', d30], ['api_usage', 'SELECT * FROM api_usage WHERE at>=? ORDER BY id DESC LIMIT 20000', now - 30 * 86400e3], ['job_runs', 'SELECT * FROM job_runs ORDER BY id DESC LIMIT 500']];
  const out = { v: 1, at: new Date(now).toISOString(), tables: {} }; let rows = 0;
  for (const [t, sql, ...p] of spec) { try { const r = (await env.DB.prepare(sql).bind(...p).all()).results || []; out.tables[t] = r; rows += r.length; } catch (e) { out.tables[t] = { error: String(e.message || e).slice(0, 120) }; } }
  const gz = await new Response(new Blob([JSON.stringify(out)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const u8 = new Uint8Array(gz); let bin = ''; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  const b64 = btoa(bin), keep = b64.length < 1.8e6;
  const ins = await env.DB.prepare('INSERT INTO backups(at,rows,bytes,kind,data) VALUES(?,?,?,?,?)').bind(now, rows, u8.length, kind, keep ? b64 : '').run();
  await env.DB.prepare('DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY id DESC LIMIT 14)').run();
  return { id: ins.meta && ins.meta.last_row_id, at: now, rows, bytes: u8.length, stored: keep, data: b64 };
}
async function autoBackup(env) {
  try { await ensureBackups(env); const l = await env.DB.prepare('SELECT MAX(at) AS at FROM backups').first(); if (!l || !l.at || Date.now() - l.at > 23.5 * 3600e3) await makeBackup(env, 'auto'); } catch (e) { /* retry next cron */ }
}

// ---- Node control panel feed: read-only overview of the whole service, guarded by the node secret ----
const NA_C = new Map();
async function nodeAdmin(env, req, url) {
  if (!env.NODE_SECRET || req.headers.get('x-node-secret') !== env.NODE_SECRET) return json(env, req, { error: 'bad node secret' }, 401);
  const ck = 'na:' + url.search, GETQ = req.method === 'GET', hit = NA_C.get(ck);
  if (GETQ && hit && Date.now() - hit.t < 90000) return new Response(hit.b, { headers: { 'content-type': 'application/json', ...cors(env, req) } });   // panel polls: serve cached stats
  await ensureKeys(env); await ensureJobs(env);
  const what = url.searchParams.get('what') || 'overview', now = Date.now();
  const iso = (ms) => new Date(now - ms).toISOString();
  const q = async (sql, ...p) => ((await env.DB.prepare(sql).bind(...p).all()).results || []);
  const one = async (sql, ...p) => (await env.DB.prepare(sql).bind(...p).first()) || {};
  const R = (o) => { const s = JSON.stringify(o); if (GETQ) { if (NA_C.size > 40) NA_C.clear(); NA_C.set(ck, { t: Date.now(), b: s }); } return new Response(s, { headers: { 'content-type': 'application/json', ...cors(env, req) } }); };
  if (what === 'overview') {
    const us = await one('SELECT COUNT(*) AS n, COALESCE(SUM(credits),0) AS cr FROM users');
    const n24 = await one('SELECT COUNT(*) AS n FROM users WHERE created>=?', iso(86400e3));
    const a24 = await one('SELECT COUNT(*) AS n FROM users WHERE last>=?', iso(86400e3));
    const use = async (ms) => one('SELECT COUNT(*) AS n, COALESCE(SUM(input),0) AS i, COALESCE(SUM(output),0) AS o, COALESCE(SUM(credits),0) AS c FROM usage WHERE at>=?', iso(ms));
    const [u1, u7, u30] = await Promise.all([use(86400e3), use(7 * 86400e3), use(30 * 86400e3)]);
    const pu = await one('SELECT COUNT(*) AS n, COALESCE(SUM(usd),0) AS usd, COALESCE(SUM(credits),0) AS cr FROM purchases');
    const pu30 = await one('SELECT COALESCE(SUM(usd),0) AS usd FROM purchases WHERE at>=?', iso(30 * 86400e3));
    const ak = await one('SELECT COUNT(*) AS n FROM api_keys');
    const au = await one('SELECT COUNT(*) AS n, COALESCE(SUM(input+output),0) AS t, COALESCE(SUM(credits),0) AS c FROM api_usage WHERE at>=?', now - 86400e3);
    const jb = await q('SELECT status, COUNT(*) AS n FROM jobs GROUP BY status');
    const jr = await one('SELECT COUNT(*) AS n FROM job_runs WHERE at>=?', now - 86400e3);
    const ap = await one('SELECT COUNT(*) AS n FROM apps');
    const nd = await nodeGet(env);
    const f = (r) => ({ requests: r.n, tokens: (r.i || 0) + (r.o || 0), credits: +Number(r.c || 0).toFixed(2) });
    return R({ users: { total: us.n, creditsOutstanding: +Number(us.cr).toFixed(1), new24h: n24.n, active24h: a24.n }, usage: { d1: f(u1), d7: f(u7), d30: f(u30) }, money: { purchases: pu.n, usd: +Number(pu.usd).toFixed(2), credits: +Number(pu.cr).toFixed(0), usd30: +Number(pu30.usd).toFixed(2) }, api: { keys: ak.n, calls24h: au.n, tokens24h: au.t, credits24h: +Number(au.c).toFixed(3) }, jobs: { byStatus: jb, runs24h: jr.n }, apps: ap.n, node: nd ? { model: nd.model, ageSec: Math.round((now - nd.at) / 1000) } : null });
  }
  if (what === 'users') {
    const rows = await q('SELECT email, username, credits, tokens, requests, created, last, free_claimed FROM users ORDER BY last DESC, created DESC LIMIT 300');
    return R({ users: rows.map((r) => ({ email: r.email, username: r.username, credits: +Number(r.credits).toFixed(2), tokens: r.tokens, requests: r.requests, created: r.created, last: r.last, owner: owners(env).includes(r.email) })) });
  }
  if (what === 'usage') {
    const daily = await q("SELECT substr(at,1,10) AS d, COUNT(*) AS n, COALESCE(SUM(input+output),0) AS t, COALESCE(SUM(credits),0) AS c FROM usage WHERE at>=? GROUP BY d ORDER BY d", iso(14 * 86400e3));
    const top = await q('SELECT email, COUNT(*) AS n, COALESCE(SUM(input+output),0) AS t, COALESCE(SUM(credits),0) AS c FROM usage WHERE at>=? GROUP BY email ORDER BY c DESC LIMIT 15', iso(7 * 86400e3));
    return R({ daily: daily.map((r) => ({ day: r.d, requests: r.n, tokens: r.t, credits: +Number(r.c).toFixed(3) })), top: top.map((r) => ({ email: r.email, requests: r.n, tokens: r.t, credits: +Number(r.c).toFixed(3) })) });
  }
  if (what === 'api') {
    const keys = await q('SELECT k.key_hash AS h, k.email AS email, k.name AS name, k.prefix AS prefix, k.created AS created, k.last AS last, k.requests AS requests, COALESCE(k.tokens,0) AS tokens, COALESCE(k.credits,0) AS credits FROM api_keys k ORDER BY k.last DESC LIMIT 200');
    const recent = await q('SELECT u.at AS at, u.email AS email, k.name AS name, u.engine AS engine, u.input AS i, u.output AS o, u.credits AS c FROM api_usage u LEFT JOIN api_keys k ON k.key_hash=u.key_hash ORDER BY u.id DESC LIMIT 60');
    const daily = await q("SELECT strftime('%Y-%m-%d', at/1000, 'unixepoch') AS d, COUNT(*) AS n, COALESCE(SUM(input+output),0) AS t, COALESCE(SUM(credits),0) AS c FROM api_usage WHERE at>=? GROUP BY d ORDER BY d", now - 14 * 86400e3);
    return R({ keys: keys.map((r) => ({ id: r.h.slice(0, 12), email: r.email, name: r.name, prefix: r.prefix, created: r.created, last: r.last, requests: r.requests, tokens: r.tokens, credits: +Number(r.credits).toFixed(3) })), recent: recent.map((r) => ({ at: r.at, email: r.email, key: r.name, engine: r.engine, input: r.i, output: r.o, credits: +Number(r.c).toFixed(3) })), daily: daily.map((r) => ({ day: r.d, requests: r.n, tokens: r.t, credits: +Number(r.c).toFixed(3) })) });
  }
  if (what === 'jobs') {
    const jobs = await q('SELECT id, email, title, prompt, due, repeat, status, last, engine, substr(result,1,400) AS result FROM jobs ORDER BY due LIMIT 150');
    const runs = await q('SELECT r.at AS at, j.title AS title, j.email AS email, r.engine AS engine, substr(r.result,1,300) AS result FROM job_runs r LEFT JOIN jobs j ON j.id=r.job_id ORDER BY r.id DESC LIMIT 40');
    return R({ jobs, runs });
  }
  if (what === 'money') {
    const rows = await q('SELECT email, at, usd, credits, ref FROM purchases ORDER BY id DESC LIMIT 60');
    const apps = await q("SELECT id, owner, title, price, status, downloads, sales, earned FROM apps ORDER BY sales DESC LIMIT 30");
    return R({ purchases: rows, apps });
  }
  if (what === 'analytics') {
    const d30 = iso(30 * 86400e3);
    const dau = await q("SELECT substr(at,1,10) AS d, COUNT(DISTINCT email) AS u, COUNT(*) AS n, COALESCE(SUM(input),0) AS i, COALESCE(SUM(output),0) AS o, COALESCE(SUM(credits),0) AS c FROM usage WHERE at>=? GROUP BY d ORDER BY d", d30);
    const heat = await q("SELECT CAST(strftime('%w',at) AS INTEGER) AS w, CAST(strftime('%H',at) AS INTEGER) AS h, COUNT(*) AS n FROM usage WHERE at>=? GROUP BY w,h", d30);
    const spenders = await q('SELECT email, COUNT(*) AS n, COALESCE(SUM(credits),0) AS c, COALESCE(SUM(input+output),0) AS t FROM usage GROUP BY email ORDER BY c DESC LIMIT 10');
    const buyers = await one('SELECT COUNT(DISTINCT email) AS n, COALESCE(SUM(usd),0) AS usd, COUNT(*) AS orders FROM purchases');
    const users = await one('SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN requests>0 THEN 1 ELSE 0 END),0) AS active, COALESCE(SUM(credits),0) AS cr FROM users');
    const apiDaily = await q("SELECT strftime('%Y-%m-%d', at/1000,'unixepoch') AS d, COUNT(*) AS n, COALESCE(SUM(credits),0) AS c FROM api_usage WHERE at>=? GROUP BY d ORDER BY d", now - 30 * 86400e3);
    const tot = await one('SELECT COUNT(*) AS n, COALESCE(SUM(input),0) AS i, COALESCE(SUM(output),0) AS o, COALESCE(SUM(credits),0) AS c FROM usage');
    const wau = await one('SELECT COUNT(DISTINCT email) AS n FROM usage WHERE at>=?', iso(7 * 86400e3));
    const mau = await one('SELECT COUNT(DISTINCT email) AS n FROM usage WHERE at>=?', d30);
    const ret = await one("SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN julianday(last)-julianday(created)>=1 THEN 1 ELSE 0 END),0) AS r1, COALESCE(SUM(CASE WHEN julianday(last)-julianday(created)>=7 THEN 1 ELSE 0 END),0) AS r7 FROM users WHERE created<=? AND created>=?", iso(86400e3), d30);
    const sizes = await one('SELECT COALESCE(AVG(input),0) AS i, COALESCE(AVG(output),0) AS o FROM usage WHERE at>=?', d30);
    return R({ dau: dau.map((r) => ({ day: r.d, users: r.u, requests: r.n, input: r.i, output: r.o, credits: +Number(r.c).toFixed(3) })), heat, spenders: spenders.map((r) => ({ email: r.email, requests: r.n, tokens: r.t, credits: +Number(r.c).toFixed(2) })), funnel: { users: users.n, activated: users.active, buyers: buyers.n, orders: buyers.orders, revenue: +Number(buyers.usd).toFixed(2), creditsHeld: +Number(users.cr).toFixed(1) }, apiDaily: apiDaily.map((r) => ({ day: r.d, requests: r.n, credits: +Number(r.c).toFixed(3) })), totals: { requests: tot.n, input: tot.i, output: tot.o, credits: +Number(tot.c).toFixed(2) }, wau: wau.n, mau: mau.n, retention: { cohort: ret.n, d1: ret.r1, d7: ret.r7 }, avgTokens: { input: Math.round(sizes.i), output: Math.round(sizes.o) } });
  }
  if (what === 'backups') {
    await ensureBackups(env);
    return R({ backups: await q("SELECT id, at, rows, bytes, kind, (length(data)>0) AS stored FROM backups ORDER BY id DESC LIMIT 20"), nextAuto: 'every 24 hours (checked each 5 minutes)' });
  }
  if (what === 'backup_now') {
    if (req.method !== 'POST') return json(env, req, { error: 'POST required' }, 405);
    return R(await makeBackup(env, url.searchParams.get('kind') === 'node' ? 'node' : 'manual'));
  }
  if (what === 'backup_get') {
    await ensureBackups(env);
    const r = await one('SELECT id, at, data FROM backups WHERE id=?', Number(url.searchParams.get('id')) || 0);
    if (!r.id || !r.data) return json(env, req, { error: 'not stored in the cloud (too large) — run Backup now' }, 404);
    return R({ id: r.id, at: r.at, data: r.data });
  }
  if (what === 'grant') {
    if (req.method !== 'POST') return json(env, req, { error: 'POST required' }, 405);
    const b = await req.json().catch(() => ({}));
    const email = String(b.email || '').toLowerCase().trim(), amt = Number(b.credits);
    if (!email || !isFinite(amt) || amt === 0 || Math.abs(amt) > 100000) return json(env, req, { error: 'Need email and a non-zero credits amount (max 100,000).' }, 400);
    if (!(await getUser(env, email))) return json(env, req, { error: 'No such user: ' + email }, 404);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS grants(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, at INTEGER, credits REAL, note TEXT)').run();
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET credits=MAX(0,credits+?) WHERE email=?').bind(amt, email),
      env.DB.prepare('INSERT INTO grants(email,at,credits,note) VALUES(?,?,?,?)').bind(email, now, amt, String(b.note || '').slice(0, 200)),
    ]);
    const f = await one('SELECT credits FROM users WHERE email=?', email);
    return R({ ok: true, email, credits: +Number(f.credits).toFixed(2) });
  }
  if (what === 'grants') {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS grants(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, at INTEGER, credits REAL, note TEXT)').run();
    return R({ grants: await q('SELECT email, at, credits, note FROM grants ORDER BY id DESC LIMIT 100') });
  }
  if (what === 'user') {
    const email = String(url.searchParams.get('email') || '').toLowerCase().trim();
    const u = await one('SELECT email, username, credits, tokens, requests, created, last FROM users WHERE email=?', email);
    if (!u.email) return json(env, req, { error: 'No such user' }, 404);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS grants(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, at INTEGER, credits REAL, note TEXT)').run();
    return R({
      user: { ...u, credits: +Number(u.credits).toFixed(2), owner: owners(env).includes(u.email) },
      usage: await q('SELECT at, input, output, credits FROM usage WHERE email=? ORDER BY rowid DESC LIMIT 25', email),
      purchases: await q('SELECT at, usd, credits FROM purchases WHERE email=? ORDER BY id DESC LIMIT 20', email),
      grants: await q('SELECT at, credits, note FROM grants WHERE email=? ORDER BY id DESC LIMIT 20', email),
      keys: await q('SELECT name, prefix, created, last, requests, COALESCE(tokens,0) AS tokens, COALESCE(credits,0) AS credits FROM api_keys WHERE email=?', email),
      jobs: await q('SELECT title, repeat, status, due, last FROM jobs WHERE email=? ORDER BY due LIMIT 20', email),
    });
  }
  if (what === 'growth') {
    const su = await q('SELECT substr(created,1,10) AS d, COUNT(*) AS n FROM users WHERE created>=? GROUP BY d ORDER BY d', iso(30 * 86400e3));
    const hr = await q("SELECT substr(at,1,13) AS h, COUNT(*) AS n, COALESCE(SUM(credits),0) AS c FROM usage WHERE at>=? GROUP BY h ORDER BY h", iso(86400e3));
    const rev = await q('SELECT substr(at,1,10) AS d, COUNT(*) AS n, COALESCE(SUM(usd),0) AS usd FROM purchases WHERE at>=? GROUP BY d ORDER BY d', iso(30 * 86400e3));
    const eng = await q('SELECT engine, COUNT(*) AS n, COALESCE(SUM(input+output),0) AS t, COALESCE(SUM(credits),0) AS c FROM api_usage GROUP BY engine');
    const bal = await q("SELECT CASE WHEN credits<=0 THEN 'empty' WHEN credits<10 THEN 'under 10' WHEN credits<50 THEN '10-50' ELSE '50+' END AS b, COUNT(*) AS n FROM users GROUP BY b");
    return R({ signups: su, hourly: hr, revenue: rev, engines: eng, balances: bal });
  }
  if (what === 'health') {
    const cnt = {};
    for (const t of ['users', 'usage', 'purchases', 'api_keys', 'api_usage', 'jobs', 'job_runs', 'apps', 'grants']) { try { cnt[t] = (await one('SELECT COUNT(*) AS n FROM ' + t)).n; } catch (e) { cnt[t] = null; } }
    const nd = await nodeGet(env);
    const overdue = await one("SELECT COUNT(*) AS n, MIN(due) AS oldest FROM jobs WHERE status='pending' AND due<?", now - 10 * 60e3);
    const lastRun = await one('SELECT MAX(at) AS at FROM job_runs');
    const lastUse = await one('SELECT MAX(at) AS at FROM usage');
    const lastApi = await one('SELECT MAX(at) AS at FROM api_usage');
    const lastBuy = await one('SELECT MAX(at) AS at FROM purchases');
    const fail = await one("SELECT COUNT(*) AS n FROM job_runs WHERE at>=? AND (result LIKE 'Skipped%' OR result LIKE 'Failed%' OR result LIKE '%error%')", now - 86400e3);
    let dbMs = 0; { const t0 = Date.now(); await env.DB.prepare('SELECT 1').first(); dbMs = Date.now() - t0; }
    const neg = await one('SELECT COUNT(*) AS n FROM users WHERE credits<0');
    return R({
      now, dbMs, tables: cnt, bindings: { anthropicKey: !!env.ANTHROPIC_API_KEY, stripeWebhook: !!env.STRIPE_WEBHOOK_SECRET, nodeSecret: !!env.NODE_SECRET, adminToken: !!env.ADMIN_TOKEN, workersAI: !!env.AI, owners: owners(env).length, signupCredits: env.SIGNUP_CREDITS || null },
      node: nd ? { model: nd.model, ageSec: Math.round((now - nd.at) / 1000), url: String(nd.url || '').replace(/^(https?:\/\/[^/]{0,40}).*$/, '$1') } : null,
      jobs: { overdue: overdue.n, oldestOverdueMin: overdue.oldest ? Math.round((now - overdue.oldest) / 60e3) : 0, lastRun: lastRun.at || null, failed24h: fail.n },
      last: { usage: lastUse.at || null, api: lastApi.at || null, purchase: lastBuy.at || null },
      problems: neg.n ? ['users with negative credits: ' + neg.n] : [],
    });
  }
  return json(env, req, { error: 'unknown view' }, 404);
}

// ---- Shareable chat pages: a mini AIX chat bound to one of the owner's API keys; visitors spend the owner's credits ----
let PAGES_READY = true;
async function ensurePages(env) {
  if (PAGES_READY) return; await ensureKeys(env);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS chat_pages(slug TEXT PRIMARY KEY, email TEXT NOT NULL, key_hash TEXT NOT NULL, name TEXT, welcome TEXT, system TEXT, color TEXT, model TEXT, day_cap INTEGER DEFAULT 200, ip_cap INTEGER DEFAULT 20, enabled INTEGER DEFAULT 1, created INTEGER, hits INTEGER DEFAULT 0)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS chat_pages_email ON chat_pages(email)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS page_hits(id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, ip TEXT, at INTEGER)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS page_hits_s ON page_hits(slug, at)').run();
  PAGES_READY = true;
}
const pageView = (r) => ({ slug: r.slug, name: r.name, welcome: r.welcome, system: r.system, color: r.color, model: r.model, day_cap: r.day_cap, ip_cap: r.ip_cap, enabled: !!r.enabled, hits: r.hits || 0, created: r.created, key: r.key_hash.slice(0, 12) });
async function pagesApi(env, req, path) {
  await ensurePages(env);
  const m = path.match(/^\/api\/page\/([a-z0-9-]{3,40})(\/chat)?$/);
  if (m) {
    const r = await env.DB.prepare('SELECT * FROM chat_pages WHERE slug=?').bind(m[1]).first();
    if (!r || !r.enabled) return json(env, req, { error: 'This chat page is not available.' }, 404);
    if (!m[2]) return json(env, req, { name: r.name, welcome: r.welcome, color: r.color });
    if (req.method !== 'POST') return json(env, req, { error: 'POST only' }, 405);
    const b = await req.json().catch(() => null);
    if (!b || !Array.isArray(b.messages)) return json(env, req, { error: 'messages required' }, 400);
    const ip = req.headers.get('cf-connecting-ip') || 'x', now = Date.now();
    const day = (await env.DB.prepare('SELECT COUNT(*) AS n FROM page_hits WHERE slug=? AND at>?').bind(r.slug, now - 86400000).first()).n;
    if (day >= (r.day_cap || 200)) return json(env, req, { error: 'This chat has reached its daily limit. Try again tomorrow.' }, 429);
    const iph = (await sha(ip)).slice(0, 16);
    const ipn = (await env.DB.prepare('SELECT COUNT(*) AS n FROM page_hits WHERE slug=? AND ip=? AND at>?').bind(r.slug, iph, now - 3600000).first()).n;
    if (ipn >= (r.ip_cap || 20)) return json(env, req, { error: 'Slow down: too many messages from you this hour.' }, 429);
    const kr = await env.DB.prepare('SELECT * FROM api_keys WHERE key_hash=?').bind(r.key_hash).first();
    if (!kr) return json(env, req, { error: 'This chat page lost its API key.' }, 410);
    const a = await getUser(env, kr.email);
    if (!a || (a.credits <= 0 && !owners(env).includes(a.email))) return json(env, req, { error: 'This chat is out of credits. Let the owner know.' }, 402);
    const msgs = b.messages.slice(-20).filter((x) => x && ['user', 'assistant'].includes(x.role) && typeof x.content === 'string' && x.content.trim()).map((x) => ({ role: x.role, content: x.content.slice(0, 4000) }));
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json(env, req, { error: 'empty message' }, 400);
    await env.DB.batch([env.DB.prepare('INSERT INTO page_hits(slug,ip,at) VALUES(?,?,?)').bind(r.slug, iph, now), env.DB.prepare('UPDATE chat_pages SET hits=COALESCE(hits,0)+1 WHERE slug=?').bind(r.slug)]);
    if (Math.random() < 0.02) { try { await env.DB.prepare('DELETE FROM page_hits WHERE at<?').bind(now - 172800000).run(); } catch (e) {} }
    const sys = (r.system || '').slice(0, 4000) + '\n\nYou are the assistant of the chat page "' + (r.name || 'Chat') + '". Stay helpful and concise.';
    return v1Run(env, req, kr, a, { model: r.model === 'aix-alpha-cloud' ? 'aix-alpha-cloud' : 'aix-alpha', stream: true, max_tokens: 900, messages: [{ role: 'system', content: sys }, ...msgs] });
  }
  const a = await authed(env, req);
  if (!a) return json(env, req, { error: 'Sign in first.' }, 401);
  if (path === '/api/pages' && req.method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM chat_pages WHERE email=? ORDER BY created DESC').bind(a.email).all()).results || [];
    return json(env, req, { pages: rows.map(pageView) });
  }
  const b = await req.json().catch(() => ({}));
  if (path === '/api/pages' && req.method === 'POST') {
    const clamp = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Math.round(Number(v)) || d));
    const kid = String(b.key || '').replace(/[^0-9a-f]/g, '').slice(0, 12);
    const kr = kid.length === 12 ? await env.DB.prepare('SELECT key_hash FROM api_keys WHERE email=? AND key_hash LIKE ?').bind(a.email, kid + '%').first() : null;
    if (!kr) return json(env, req, { error: 'Pick one of your API keys for this page.' }, 400);
    const f = { name: String(b.name || 'My chat').slice(0, 60), welcome: String(b.welcome || 'Hi! How can I help?').slice(0, 300), system: String(b.system || '').slice(0, 4000), color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#8b5cf6', model: b.model === 'aix-alpha-cloud' ? 'aix-alpha-cloud' : 'aix-alpha', day: clamp(b.day_cap, 10, 5000, 200), ip: clamp(b.ip_cap, 3, 200, 20), en: b.enabled === false ? 0 : 1 };
    let slug = String(b.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (slug) {
      const ex = await env.DB.prepare('SELECT email FROM chat_pages WHERE slug=?').bind(slug).first();
      if (!ex || ex.email !== a.email) return json(env, req, { error: 'Page not found.' }, 404);
      await env.DB.prepare('UPDATE chat_pages SET key_hash=?,name=?,welcome=?,system=?,color=?,model=?,day_cap=?,ip_cap=?,enabled=? WHERE slug=?').bind(kr.key_hash, f.name, f.welcome, f.system, f.color, f.model, f.day, f.ip, f.en, slug).run();
      return json(env, req, { slug });
    }
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM chat_pages WHERE email=?').bind(a.email).first()).n;
    if (n >= 10) return json(env, req, { error: 'Limit of 10 chat pages.' }, 400);
    slug = (f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'chat') + '-' + hex(crypto.getRandomValues(new Uint8Array(3)));
    await env.DB.prepare('INSERT INTO chat_pages(slug,email,key_hash,name,welcome,system,color,model,day_cap,ip_cap,enabled,created,hits) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0)').bind(slug, a.email, kr.key_hash, f.name, f.welcome, f.system, f.color, f.model, f.day, f.ip, f.en, Date.now()).run();
    return json(env, req, { slug });
  }
  if (path === '/api/pages/delete' && req.method === 'POST') {
    await env.DB.prepare('DELETE FROM chat_pages WHERE slug=? AND email=?').bind(String(b.slug || ''), a.email).run();
    return json(env, req, { ok: true });
  }
  return json(env, req, { error: 'Unknown page endpoint' }, 404);
}

export default {
  async scheduled(ev, env, ctx) { ctx.waitUntil(runDueJobs(env).then(() => autoBackup(env))); },
  async fetch(req, env, ctx) {
    try { return await this._h(req, env, ctx); }
    catch (e) { console.log('worker error', req.method, new URL(req.url).pathname, e && e.stack || e); return json(env, req, { error: 'Server error: ' + (e && e.message || e) }, 500); }
  },
  async _h(req, env) {
    const url = new URL(req.url), path = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
    if (path === '/api/node/admin' && (req.method === 'GET' || req.method === 'POST')) return nodeAdmin(env, req, url);
    if (path.startsWith('/api/keys')) return keysApi(env, req, path);
    if (path.startsWith('/api/page')) return pagesApi(env, req, path);
    if (path.startsWith('/v1/')) return v1Api(env, req, path);
    if (path === '/api/sync') return syncApi(env, req);
    if (path.startsWith('/api/jobs')) return jobsApi(env, req, path);
    if (path === '/api/health') return json(env, req, { status: 'ok', engine: 'aix-alpha-cloud', model: MODEL, hasApiKey: !!env.ANTHROPIC_API_KEY });
    if (path === '/api/account/signup' && req.method === 'POST') {
      const b = await req.json().catch(() => ({})); const email = String(b.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(env, req, { error: 'valid email required' }, 400);
      if (await getUser(env, email)) return json(env, req, { error: 'account exists; use your saved token' }, 409);
      const token = 'aix_' + [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, '0')).join('');
      const a = { email, credits: Number(env.SIGNUP_CREDITS || 0), tokens: 0, requests: 0 };
      await env.DB.prepare('INSERT INTO users(email,token_hash,credits,tokens,requests,created,last) VALUES(?,?,?,?,0,?,?)').bind(email, await sha(token), a.credits, 0, new Date().toISOString(), '').run();
      return json(env, req, { token, account: vw(env, a) });
    }
    if (path === '/api/account/register' && req.method === 'POST') {
      const b = await req.json().catch(() => ({})); const un = normId(b.username), pw = String(b.password || '');
      if (!validId(un)) return json(env, req, { error: 'Enter a valid email, or a username of 3-24 letters, numbers, _ . -' }, 400);
      if (pw.length < 6) return json(env, req, { error: 'Password must be at least 6 characters' }, 400);
      if (await env.DB.prepare('SELECT 1 AS x FROM users WHERE username=?').bind(un).first()) return json(env, req, { error: 'That email/username already has an account. Sign in instead.' }, 409);
      const salt = hex(crypto.getRandomValues(new Uint8Array(16))), ph = await pbk(pw, salt), cur = await authed(env, req);
      let email;
      if (cur && !cur.username) { email = cur.email; await env.DB.prepare('UPDATE users SET username=?,pw_hash=?,pw_salt=? WHERE email=?').bind(un, ph, salt, email).run(); }   // upgrade the guest in place: credits stay
      else { email = un + '@user.aix'; await env.DB.prepare('INSERT INTO users(email,token_hash,credits,tokens,requests,created,last,username,pw_hash,pw_salt) VALUES(?,?,?,0,0,?,?,?,?,?)').bind(email, await sha(newToken()), Number(env.SIGNUP_CREDITS || 0), new Date().toISOString(), '', un, ph, salt).run(); }
      const token = await startSession(env, email);
      return json(env, req, { token, account: vw(env, await getUser(env, email)) });
    }
    if (path === '/api/account/login' && req.method === 'POST') {
      const b = await req.json().catch(() => ({})); const un = normId(b.username);
      const u = await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(un).first();
      const ok = u && u.pw_hash && (await pbk(String(b.password || ''), u.pw_salt)) === u.pw_hash;
      if (!ok) return json(env, req, { error: 'Wrong username or password' }, 401);
      return json(env, req, { token: await startSession(env, u.email), account: vw(env, u) });
    }
    if (path === '/api/account/claim-free' && req.method === 'POST') return json(env, req, { error: 'Credits are only available by purchase.' }, 403);
    if (false) {      // 1 free credit per username account, 1 per network
      const a = await authed(env, req);
      if (!a) return json(env, req, { error: 'sign in' }, 401);
      if (!a.username) return json(env, req, { error: 'Create an account first (username + password) to claim your free credit' }, 403);
      if (a.free_claimed) return json(env, req, { error: 'Free credit already claimed' }, 409);
      const ip = req.headers.get('cf-connecting-ip') || 'unknown';
      if (await env.DB.prepare('SELECT 1 AS x FROM claims WHERE ip=?').bind(ip).first()) return json(env, req, { error: 'A free credit was already claimed from this network' }, 429);
      await env.DB.batch([
        env.DB.prepare('INSERT INTO claims(ip,email,at) VALUES(?,?,?)').bind(ip, a.email, new Date().toISOString()),
        env.DB.prepare('UPDATE users SET credits=credits+1, free_claimed=1 WHERE email=? AND free_claimed=0').bind(a.email),
        env.DB.prepare('INSERT INTO purchases(email,at,usd,credits,ref) VALUES(?,?,0,1,?)').bind(a.email, new Date().toISOString(), 'free-claim-' + a.email),
      ]);
      return json(env, req, vw(env, await getUser(env, a.email)));
    }
    if (path === '/api/config' && req.method === 'GET') {            // public: pack payment links set by the owner
      const r = await env.DB.prepare("SELECT v FROM settings WHERE k='links'").first();
      return json(env, req, { links: r ? JSON.parse(r.v) : {} });
    }
    if (path === '/api/account/me') { const a = await authed(env, req); return a ? json(env, req, vw(env, a)) : json(env, req, { error: 'sign in' }, 401); }
    if (path.startsWith('/api/market/')) return market(env, req, path, { json, authed, owners });
    if (path === '/api/node/register' && req.method === 'POST') {
      if (!env.NODE_SECRET || req.headers.get('x-node-secret') !== env.NODE_SECRET) return json(env, req, { error: 'bad node secret' }, 401);
      const b = await req.json().catch(() => ({})); const url = String(b.url || '');
      if (!/^https:\/\//.test(url) || !b.token || !b.model) return json(env, req, { error: 'https url, token and model required' }, 400);
      await env.DB.prepare("INSERT INTO settings(k,v) VALUES('node',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify({ url, token: String(b.token), model: String(b.model), at: Date.now() })).run();
      return json(env, req, { ok: true });
    }
    if (path === '/api/node/status') { const n = await nodeGet(env); return json(env, req, { online: !!n, model: n ? n.model : '' }); }
    if (path === '/api/node/charge' && req.method === 'POST') {          // replies served by a local Ollama node: same credit scaling as the cloud model
      const a = await authed(env, req); if (!a) return json(env, req, { error: 'sign in' }, 401);
      const b = await req.json().catch(() => ({})); const inp = Math.min(400000, Math.max(0, Number(b.input) || 0)), out = Math.min(200000, Math.max(0, Number(b.output) || 0));
      return json(env, req, await charge(env, a, { input: inp, output: out }));
    }
    if (path === '/api/account/host-charge' && req.method === 'POST') {   // site hosting: 50 credits ($5.00) per 30 days; owners host free
      const a = await authed(env, req); if (!a) return json(env, req, { error: 'sign in' }, 401);
      const HOST_CR = 50, owner = owners(env).includes(a.email) && !a.meter; const f0 = await getUser(env, a.email);
      if (!owner && Number(f0.credits) < HOST_CR) return json(env, req, { error: 'Not enough credits: hosting is ' + HOST_CR + ' credits per 30 days', credits: +Number(f0.credits).toFixed(2) }, 402);
      const now = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET credits=' + (owner ? 'credits' : 'MAX(0,credits-?)') + ', last=? WHERE email=?').bind(...(owner ? [now, a.email] : [HOST_CR, now, a.email])),
        env.DB.prepare('INSERT INTO usage(email,at,input,output,credits) VALUES(?,?,?,?,?)').bind(a.email, now, 0, 0, owner ? 0 : HOST_CR),
      ]);
      const f = await getUser(env, a.email);
      return json(env, req, { ok: true, charged: owner ? 0 : HOST_CR, credits: +Number(f.credits).toFixed(2) });
    }
    if (path === '/api/image' && req.method === 'POST') return image(env, req);
    if (path === '/api/video' && req.method === 'POST') return video(env, req);
    if (path === '/api/sample' && req.method === 'POST') return sample(env, req);
    if (path === '/api/stripe/webhook' && req.method === 'POST') return stripe(env, req);
    if (path.startsWith('/api/admin/')) {
      if (!env.ADMIN_TOKEN || req.headers.get('x-admin-token') !== env.ADMIN_TOKEN) return json(env, req, { error: 'admin token required' }, 401);
      if (path === '/api/admin/grant' && req.method === 'POST') {
        const b = await req.json().catch(() => ({})); const q0 = String(b.email || b.username || '').toLowerCase(); const row = await env.DB.prepare('SELECT email FROM users WHERE email=? OR username=?').bind(q0, q0).first(); const email = row ? row.email : ''; const n = Number(b.credits);
        if (!row || !(n > 0)) return json(env, req, { error: 'email + credits required' }, 400);
        await env.DB.batch([env.DB.prepare('UPDATE users SET credits=credits+? WHERE email=?').bind(n, email), env.DB.prepare('INSERT INTO purchases(email,at,usd,credits,ref) VALUES(?,?,0,?,?)').bind(email, new Date().toISOString(), n, 'admin-grant-' + Date.now())]);
        return json(env, req, vw(env, await getUser(env, email)));
      }
      if (path === '/api/admin/config' && req.method === 'POST') {
        const b = await req.json().catch(() => ({})); const L = {};
        for (const k of ['starter', 'topup', 'enterprise']) { const u = String((b.links || {})[k] || '').trim(); if (u && !/^https:\/\/(buy|checkout)\.stripe\.com\//.test(u)) return json(env, req, { error: k + ': must be a Stripe Payment Link (https://buy.stripe.com/...)' }, 400); if (u) L[k] = u; }
        await env.DB.prepare("INSERT INTO settings(k,v) VALUES('links',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(L)).run();
        return json(env, req, { links: L });
      }
      if (path === '/api/admin/users.md') {
        const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY last DESC').all();
        const rows = results.map((a) => `| ${a.username || a.email} | ${Number(a.credits).toFixed(1)} | ${a.tokens} | ${a.requests} | ${a.last || '-'} |`);
        return new Response(`# AIX ALPHA users\n\n| Email | Credits | Tokens | Requests | Last active |\n|---|---|---|---|---|\n${rows.join('\n')}\n`, { headers: { 'content-type': 'text/markdown', ...cors(env, req) } });
      }
      if (path === '/api/admin/adjust' && req.method === 'POST') {       // add or remove credits (negative n deducts, floor 0)
        const b = await req.json().catch(() => ({})); const q0 = String(b.email || '').toLowerCase(); const n = Number(b.credits);
        const row = await env.DB.prepare('SELECT email FROM users WHERE email=? OR username=?').bind(q0, q0).first();
        if (!row || !isFinite(n) || n === 0) return json(env, req, { error: 'email + nonzero credits required' }, 400);
        await env.DB.prepare('UPDATE users SET credits=MAX(0,credits+?) WHERE email=?').bind(n, row.email).run();
        if (n > 0) await env.DB.prepare('INSERT INTO purchases(email,at,usd,credits,ref) VALUES(?,?,0,?,?)').bind(row.email, new Date().toISOString(), n, 'admin-grant-' + Date.now()).run();
        return json(env, req, vw(env, await getUser(env, row.email)));
      }
      if (path === '/api/admin/app' && req.method === 'POST') {          // moderate marketplace apps
        const b = await req.json().catch(() => ({})); const id = String(b.id || '');
        if (b.action === 'unpublish') await env.DB.prepare("UPDATE apps SET status='draft' WHERE id=?").bind(id).run();
        else if (b.action === 'delete') await env.DB.prepare('DELETE FROM apps WHERE id=?').bind(id).run();
        else return json(env, req, { error: 'action must be unpublish or delete' }, 400);
        return json(env, req, { ok: true });
      }
      if (path === '/api/admin/sql' && req.method === 'POST') {          // owner-only read queries
        const b = await req.json().catch(() => ({})); const q = String(b.query || '');
        if (!/^\s*select\b/i.test(q) || /;\s*\S/.test(q)) return json(env, req, { error: 'single SELECT only' }, 400);
        return json(env, req, (await env.DB.prepare(q).all()).results);
      }
    }
    return json(env, req, { error: 'not found' }, 404);
  },
};


// Free FLUX.1 [schnell] images on Workers AI (shared free allowance); per-user daily cap, no credits charged.
const IMG_MODELS = {
  flux:  { cr: 1, label: 'FLUX.1 schnell' },
  flux2: { cr: 3, label: 'FLUX.2' },
};
async function genImage(env, kind, prompt, steps) {
  if (kind === 'flux2') {
    const form = new FormData(); form.append('prompt', prompt); form.append('width', '1024'); form.append('height', '1024');
    const fr = new Response(form);
    const out = await env.AI.run('@cf/black-forest-labs/flux-2-dev', { multipart: { body: fr.body, contentType: fr.headers.get('content-type') } });
    if (!out || !out.image) throw new Error('no image returned');
    return 'data:image/jpeg;base64,' + out.image;
  }
  const out = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps });
  if (!out || !out.image) throw new Error('no image returned');
  return 'data:image/jpeg;base64,' + out.image;
}
async function image(env, req) {
  const a = await authed(env, req);
  if (!a) return json(env, req, { error: 'Sign in to generate images.' }, 401);
  if (!env.AI) return json(env, req, { error: 'Image generation is not enabled on this server' }, 501);
  let b; try { b = await req.json(); } catch { return json(env, req, { error: 'bad request' }, 400); }
  const prompt = String(b.prompt || '').slice(0, 1000).trim();
  if (!prompt) return json(env, req, { error: 'Describe the image' }, 400);
  const kind = IMG_MODELS[b.model] ? b.model : 'flux', cost = IMG_MODELS[kind].cr;
  const owner = owners(env).includes(a.email) && !a.meter;
  if (!owner) {
    const up = await env.DB.prepare('UPDATE users SET credits=credits-? WHERE email=? AND credits>=?').bind(cost, a.email, cost).run();
    if (!(up.meta && up.meta.changes > 0)) return json(env, req, { error: 'Out of credits. ' + IMG_MODELS[kind].label + ' costs ' + cost + ' credit' + (cost > 1 ? 's' : '') + '.' }, 402);
  }
  try {
    const image = await genImage(env, kind, prompt, Math.min(8, Math.max(1, +b.steps || 4)));
    if (!owner) await env.DB.prepare('INSERT INTO usage(email,at,input,output,credits) VALUES(?,?,0,0,?)').bind(a.email, new Date().toISOString(), cost).run();
    const f = await getUser(env, a.email);
    return json(env, req, { image, model: kind, credits: +Number(f.credits).toFixed(2), spentCredits: owner ? 0 : cost });
  } catch (e) {
    if (!owner) await env.DB.prepare('UPDATE users SET credits=credits+? WHERE email=?').bind(cost, a.email).run();
    return json(env, req, { error: 'Image model error: ' + (e.message || e) }, 502);
  }
}

// ---- AI video (beta): free Hugging Face ZeroGPU Space (Lightricks LTX-Video distilled), image -> short clip ----
const VIDEO_CR = 3;
const HF_VIDEO = 'https://lightricks-ltx-video-distilled.hf.space';
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
async function hfVideo(env, prompt, imageDataUrl) {
  const h = env.HF_TOKEN ? { authorization: 'Bearer ' + env.HF_TOKEN } : {};
  const m = /^data:([^;]+);base64,(.+)$/.exec(imageDataUrl || '');
  if (!m) throw new Error('A start image is required.');
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const form = new FormData(); form.append('files', new Blob([bin], { type: m[1] }), 'start.' + (m[1].split('/')[1] || 'png'));
  const up = await fetch(HF_VIDEO + '/gradio_api/upload', { method: 'POST', headers: h, body: form });
  if (!up.ok) throw new Error('The free video service is not reachable right now (' + up.status + ').');
  const path = (await up.json())[0];
  const data = [prompt || 'The scene comes alive with smooth cinematic motion', 'worst quality, inconsistent motion, blurry, jittery, distorted', { path, meta: { _type: 'gradio.FileData' } }, null, 512, 704, 'image-to-video', 2, 9, 42, true, 1, true];
  const call = await fetch(HF_VIDEO + '/gradio_api/call/image_to_video', { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify({ data }) });
  const cj = await call.json().catch(() => ({}));
  if (!call.ok || !cj.event_id) throw new Error('The free video service refused the job (' + call.status + ').');
  const sse = await fetch(HF_VIDEO + '/gradio_api/call/image_to_video/' + cj.event_id, { headers: h });
  if (!sse.ok || !sse.body) throw new Error('The free video queue is unavailable (' + sse.status + ').');
  const rd = sse.body.getReader(), dec = new TextDecoder(); let buf = '', ev = '', result = null; const t0 = Date.now();
  while (Date.now() - t0 < 170000) {
    const { value, done } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n\n')) >= 0) {
      const blk = buf.slice(0, i); buf = buf.slice(i + 2);
      const e = /event: (\w+)/.exec(blk), d = /data: ([\s\S]*)/.exec(blk);
      if (e) ev = e[1];
      if (ev === 'complete' && d) { try { result = JSON.parse(d[1]); } catch {} }
      if (ev === 'error') throw new Error('The free GPU queue is busy or out of quota right now. Try again in a few minutes.');
    }
    if (result) break;
  }
  try { rd.cancel(); } catch {}
  if (!result) throw new Error('The free video queue took too long. Try again in a few minutes.');
  let v = result[0]; v = (v && v.video) || v;
  const url = v && (v.url || (v.path && HF_VIDEO + '/gradio_api/file=' + v.path));
  if (!url) throw new Error('No video came back.');
  const vr = await fetch(url, { headers: h });
  if (!vr.ok) throw new Error('Could not fetch the finished video (' + vr.status + ').');
  const bytes = new Uint8Array(await vr.arrayBuffer());
  if (bytes.length > 12e6) throw new Error('The video was too large.');
  return 'data:video/mp4;base64,' + b64(bytes);
}
async function video(env, req) {
  const a = await authed(env, req);
  if (!a) return json(env, req, { error: 'Sign in to generate video.' }, 401);
  let b; try { b = await req.json(); } catch { return json(env, req, { error: 'bad request' }, 400); }
  const prompt = String(b.prompt || '').slice(0, 500).trim();
  if (!b.image || String(b.image).length > 6e6) return json(env, req, { error: 'Add a start image (under ~4 MB).' }, 400);
  const owner = owners(env).includes(a.email) && !a.meter;
  if (!owner) {
    const up = await env.DB.prepare('UPDATE users SET credits=credits-? WHERE email=? AND credits>=?').bind(VIDEO_CR, a.email, VIDEO_CR).run();
    if (!(up.meta && up.meta.changes > 0)) return json(env, req, { error: 'Out of credits. A video clip costs ' + VIDEO_CR + ' credits.' }, 402);
  }
  try {
    const vid = await hfVideo(env, prompt, b.image);
    if (!owner) await env.DB.prepare('INSERT INTO usage(email,at,input,output,credits) VALUES(?,?,0,0,?)').bind(a.email, new Date().toISOString(), VIDEO_CR).run();
    const f = await getUser(env, a.email);
    return json(env, req, { video: vid, credits: +Number(f.credits).toFixed(2), spentCredits: owner ? 0 : VIDEO_CR });
  } catch (e) {
    if (!owner) await env.DB.prepare('UPDATE users SET credits=credits+? WHERE email=?').bind(VIDEO_CR, a.email).run();
    return json(env, req, { error: e.message || 'Video failed' }, 502);
  }
}
