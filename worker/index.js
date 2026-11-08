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
    if (usd === ENT_USD && o.payment_status === 'paid' && email && (!env.ENT_PLINK || o.payment_link === env.ENT_PLINK) && (await getUser(env, email))) {   // Enterprise via Stripe: +1000 credits (carry over) and 30 days of the Company page
      const ins = await env.DB.prepare('INSERT OR IGNORE INTO purchases(email,at,usd,credits,ref) VALUES(?,?,?,?,?)').bind(email, new Date().toISOString(), usd, ENT_CREDITS, o.id).run();
      if (ins.meta && ins.meta.changes > 0) { await env.DB.prepare('UPDATE users SET credits=credits+? WHERE email=?').bind(ENT_CREDITS, email).run(); await entExtend(env, email, 'stripe'); }
    }
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
  if (GETQ && hit && Date.now() - hit.t < 15000) return new Response(hit.b, { headers: { 'content-type': 'application/json', ...cors(env, req) } });   // panel polls: serve cached stats
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
  if (what === 'referrals') {
    await ensureRef(env);
    const t = await one('SELECT COUNT(*) n, COALESCE(SUM(referee_credits),0) a, COALESCE(SUM(referrer_credits),0) b FROM ref_uses');
    const d7 = await one('SELECT COUNT(*) n FROM ref_uses WHERE at>=?', iso(7 * 86400e3));
    const top = await q('SELECT referrer, COUNT(*) n, SUM(referrer_credits) c FROM ref_uses GROUP BY referrer ORDER BY n DESC LIMIT 15');
    const recent = await q('SELECT id, code, referrer, referee, ip, at, referee_credits, referrer_credits FROM ref_uses ORDER BY id DESC LIMIT 60');
    const ips = await q('SELECT ip, COUNT(*) n FROM ref_fail WHERE at>=? GROUP BY ip HAVING n>=3 ORDER BY n DESC LIMIT 10', iso(7 * 86400e3));
    const fails = await q('SELECT email, ip, code, why, at FROM ref_fail ORDER BY id DESC LIMIT 40');
    const why = await q('SELECT why, COUNT(*) n FROM ref_fail GROUP BY why');
    const codes = await one('SELECT COUNT(*) n FROM ref_codes');
    const daily = await q('SELECT substr(at,1,10) d, COUNT(*) n FROM ref_uses WHERE at>=? GROUP BY d ORDER BY d', iso(30 * 86400e3));
    return R({ uses: t.n, creditsNew: t.a, creditsReferrers: t.b, creditsTotal: (t.a || 0) + (t.b || 0), last7d: d7.n, codes: codes.n, top, recent, suspicious: ips, failures: fails, failReasons: why, daily, rules: { newUser: REF_NEW, referrer: REF_REFERRER, cap: REF_CAP } });
  }
  if (what === 'promos') {
    await ensureRef(env);
    const st = url.searchParams.get('status') || '';
    const rows = await q(st ? 'SELECT * FROM promos WHERE status=? ORDER BY id DESC LIMIT 100' : "SELECT * FROM promos ORDER BY (status='pending') DESC, id DESC LIMIT 100", ...(st ? [st] : []));
    const sm = await q('SELECT status, COUNT(*) n, COALESCE(SUM(credits),0) c FROM promos GROUP BY status');
    return R({ rows, summary: sm, reward: PROMO_CREDITS });
  }
  if (what === 'promo_decide') {
    if (req.method !== 'POST') return json(env, req, { error: 'POST required' }, 405);
    await ensureRef(env);
    const b = await req.json().catch(() => ({})), id = Number(b.id), act = String(b.action || '');
    const credits = Math.min(10000, Math.max(0, Number(b.credits == null ? PROMO_CREDITS : b.credits) || 0)), note = String(b.note || '').slice(0, 300);
    if (!id || !['approve', 'reject'].includes(act)) return json(env, req, { error: 'id and action approve|reject required' }, 400);
    const pr = await env.DB.prepare('SELECT * FROM promos WHERE id=?').bind(id).first();
    if (!pr) return json(env, req, { error: 'not found' }, 404);
    if (pr.status !== 'pending') return json(env, req, { error: 'already ' + pr.status }, 409);
    const iso2 = new Date().toISOString();
    const res = await env.DB.prepare("UPDATE promos SET status=?, credits=?, note=?, decided=? WHERE id=? AND status='pending'").bind(act === 'approve' ? 'approved' : 'rejected', act === 'approve' ? credits : 0, note, iso2, id).run();
    if (!res.meta || !res.meta.changes) return json(env, req, { error: 'already decided' }, 409);
    if (act === 'approve' && credits > 0) {
      await env.DB.batch([env.DB.prepare('UPDATE users SET credits=credits+? WHERE email=?').bind(credits, pr.email), env.DB.prepare('INSERT OR IGNORE INTO purchases(email,at,usd,credits,ref) VALUES(?,?,0,?,?)').bind(pr.email, iso2, credits, 'promo-' + id)]);
      AUTH_C.clear();
    }
    NA_C.clear();
    return R({ ok: true, id, status: act === 'approve' ? 'approved' : 'rejected', credits: act === 'approve' ? credits : 0 });
  }
  if (what === 'enterprise') {
    await ensureEnt(env);
    const rows = await q('SELECT email, until, started, last_pay, via FROM enterprise ORDER BY until DESC'), now2 = Date.now();
    return R({ price: ENT_USD, credits: ENT_CREDITS, active: rows.filter((r) => r.until > now2).length, subscribers: rows.map((r) => ({ ...r, active: r.until > now2 })) });
  }
  if (what === 'storage') {   // per-user storage on the node: images + site files, plans, credits
    await ensureHost(env);
    const files = await q("SELECT email, SUM(CASE WHEN kind='site' THEN bytes ELSE 0 END) sb, SUM(CASE WHEN kind='img' THEN bytes ELSE 0 END) ib, COUNT(*) n, MAX(created) last FROM host_files GROUP BY email");
    const plans = await q('SELECT * FROM host_plan'), pm = new Map(plans.map((p) => [p.email, p])), fm = new Map(files.map((f) => [f.email, f]));
    const emails = [...new Set([...files.map((f) => f.email), ...plans.map((p) => p.email)])];
    const users = await Promise.all(emails.map(async (e) => { const f = fm.get(e) || {}, p = pm.get(e) || { mb: HOST_FREE, paid_until: 0 }, used = (f.sb || 0) + (f.ib || 0); return { email: e, uid: await hostUid(e), planMb: p.mb, paidUntil: p.paid_until, imgBytes: f.ib || 0, siteBytes: f.sb || 0, usedBytes: used, files: f.n || 0, last: f.last || 0, creditsPerMonth: p.mb > HOST_FREE ? p.mb : 0, over: used > p.mb * MB }; }));
    users.sort((a, b) => b.usedBytes - a.usedBytes);
    const top = await q('SELECT email, name, bytes, created FROM host_files ORDER BY bytes DESC LIMIT 15');
    const daily = await q("SELECT strftime('%Y-%m-%d', created/1000, 'unixepoch') AS d, COUNT(*) AS n, SUM(bytes) AS b FROM host_files WHERE created>? GROUP BY d ORDER BY d", now - 14 * 864e5);
    let disk = null; const nd = await nodeGet(env); if (nd) { try { const r = await nfetch(nd.url.replace(/\/+$/, '') + '/host/stats', { headers: { authorization: 'Bearer ' + nd.token } }); if (r.ok) disk = await r.json(); } catch {} }
    const sum = (k) => users.reduce((s, u) => s + u[k], 0);
    return R({ totals: { users: users.length, usedBytes: sum('usedBytes'), imgBytes: sum('imgBytes'), siteBytes: sum('siteBytes'), files: sum('files'), paying: users.filter((u) => u.creditsPerMonth).length, creditsPerMonth: sum('creditsPerMonth'), over: users.filter((u) => u.over).length, freeMb: HOST_FREE }, users, top, daily, disk, nodeOnline: !!nd });
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


// ---- User storage on the Mac node: images + site project files. 5 MB included with hosting; above that 1 credit per MB per 30 days (plan sized in MB) ----
const HOST_FREE = 5, MB = 1048576;
let HOST_READY = false;
async function ensureHost(env) {
  if (HOST_READY) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS host_files(email TEXT NOT NULL, name TEXT NOT NULL, bytes INTEGER, ctype TEXT, kind TEXT, created INTEGER, PRIMARY KEY(email,name))').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS host_plan(email TEXT PRIMARY KEY, mb INTEGER DEFAULT 5, paid_until INTEGER DEFAULT 0)').run();
  HOST_READY = true;
}
const hostUid = async (email) => (await sha('host:' + email)).slice(0, 16);
const hostOwner = (env, a) => owners(env).includes(a.email) && !a.meter;
async function hostSummary(env, a) {
  await ensureHost(env);
  const now = Date.now(), owner = hostOwner(env, a);
  let p = (await env.DB.prepare('SELECT * FROM host_plan WHERE email=?').bind(a.email).first()) || { mb: HOST_FREE, paid_until: 0 }, lapsed = false;
  if (p.mb > HOST_FREE && p.paid_until < now) {   // monthly renewal of the storage plan
    let ok = owner;
    if (!owner) { const up = await env.DB.prepare('UPDATE users SET credits=credits-? WHERE email=? AND credits>=?').bind(p.mb, a.email, p.mb).run(); ok = !!(up.meta && up.meta.changes > 0); if (ok) await env.DB.prepare('INSERT INTO usage(email,at,input,output,credits) VALUES(?,?,0,0,?)').bind(a.email, new Date().toISOString(), p.mb).run(); }
    if (ok) { p.paid_until = now + 30 * 864e5; await env.DB.prepare('INSERT INTO host_plan(email,mb,paid_until) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET mb=excluded.mb, paid_until=excluded.paid_until').bind(a.email, p.mb, p.paid_until).run(); }
    else { lapsed = true; p = { mb: HOST_FREE, paid_until: 0 }; await env.DB.prepare('INSERT INTO host_plan(email,mb,paid_until) VALUES(?,?,0) ON CONFLICT(email) DO UPDATE SET mb=?, paid_until=0').bind(a.email, HOST_FREE, HOST_FREE).run(); }
  }
  const rows = (await env.DB.prepare('SELECT name,bytes,ctype,kind,created FROM host_files WHERE email=? ORDER BY created DESC').bind(a.email).all()).results || [];
  let imgBytes = 0, siteBytes = 0; for (const r of rows) { if (r.kind === 'site') siteBytes += r.bytes; else imgBytes += r.bytes; }
  const used = imgBytes + siteBytes;
  return { uid: await hostUid(a.email), planMb: p.mb, freeMb: HOST_FREE, paidUntil: p.paid_until, creditsPerMonth: owner ? 0 : (p.mb > HOST_FREE ? p.mb : 0), usedBytes: used, imgBytes, siteBytes, over: used > p.mb * MB, lapsed, owner, files: rows.slice(0, 400), credits: +Number(a.credits).toFixed(2) };
}
const hostNodeCall = async (env, nd, path, body) => { const r = await nfetch(nd.url.replace(/\/+$/, '') + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + nd.token }, body: JSON.stringify(body) }); if (!r.ok) throw new Error('node ' + r.status); return r; };
const cleanSeg = (x) => String(x).replace(/[^\w.\-]/g, '_').replace(/^\.+/, '_').slice(-60) || '_';
async function hostApi(env, req, path) {
  const a = await authed(env, req); if (!a) return json(env, req, { error: 'Sign in to use hosted storage.' }, 401);
  if (path === '/api/host/usage') return json(env, req, await hostSummary(env, a));
  const b = await req.json().catch(() => ({}));
  const uid = await hostUid(a.email);
  if (path === '/api/host/put') {
    const kind = b.kind === 'site' ? 'site' : 'img', raw = String(b.name || '').replace(/\\/g, '/').split('/').filter((x) => x && x !== '.' && x !== '..').map(cleanSeg);
    if (!raw.length || raw.length > 6) return json(env, req, { error: 'Bad file name.' }, 400);
    let name = kind + '/' + raw.join('/'); const ctype = String(b.type || '').slice(0, 60);
    if (kind === 'img' && !/^image\/(png|jpe?g|gif|webp|svg\+xml|avif)$/.test(ctype)) return json(env, req, { error: 'Only PNG, JPEG, GIF, WebP, SVG or AVIF images.' }, 400);
    if (kind === 'img' && raw.length > 1) return json(env, req, { error: 'Bad image name.' }, 400);
    const data = String(b.data || ''), bytes = Math.floor(data.length * 3 / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
    if (!data || bytes <= 0) return json(env, req, { error: 'Empty file.' }, 400);
    if (bytes > 4 * MB) return json(env, req, { error: 'One file can be at most 4 MB.' }, 413);
    if (kind === 'img') {   // content-addressed, IPFS style: the same picture always gets the same name and is stored once
      let bin; try { bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)); } catch { return json(env, req, { error: 'Bad image data.' }, 400); }
      const cid = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bin))].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
      name = 'img/' + cid + '.' + ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif' }[ctype] || 'bin');
    }
    const s = await hostSummary(env, a), prev = s.files.find((f) => f.name === name), newUsed = s.usedBytes - (prev ? prev.bytes : 0) + bytes;
    if (newUsed > s.planMb * MB) { const needMb = Math.max(HOST_FREE + 1, Math.ceil(newUsed / MB)); return json(env, req, { error: 'Storage full: this needs ' + (newUsed / MB).toFixed(2) + ' MB and your plan is ' + s.planMb + ' MB.', code: 'quota', usedBytes: s.usedBytes, planMb: s.planMb, needMb, creditsPerMonth: needMb }, 413); }
    const nd = await nodeGet(env); if (!nd) return json(env, req, { error: 'The storage node is offline right now. Try again shortly.' }, 503);
    try {
      if (!s.files.length) await hostNodeCall(env, nd, '/host/put', { uid, name: '_owner.json', data: btoa(JSON.stringify({ email: a.email, since: new Date().toISOString() })) });
      await hostNodeCall(env, nd, '/host/put', { uid, name, data });
    } catch (e) { return json(env, req, { error: 'Could not store the file on the node (' + (e.message || e) + ').' }, 502); }
    await env.DB.prepare('INSERT INTO host_files(email,name,bytes,ctype,kind,created) VALUES(?,?,?,?,?,?) ON CONFLICT(email,name) DO UPDATE SET bytes=excluded.bytes, ctype=excluded.ctype, created=excluded.created').bind(a.email, name, bytes, ctype, kind, Date.now()).run();
    return json(env, req, { ok: true, name, bytes, url: kind === 'img' ? new URL(req.url).origin + '/h/' + uid + '/' + name : null, usedBytes: s.usedBytes - (prev ? prev.bytes : 0) + bytes, planMb: s.planMb });
  }
  if (path === '/api/host/prune') {   // drop a site's files that are no longer in the project
    const pre = 'site/' + cleanSeg(b.slug || '') + '/', keep = new Set((Array.isArray(b.keep) ? b.keep : []).map((x) => pre + String(x).split('/').map(cleanSeg).join('/')));
    await ensureHost(env); const rows = (await env.DB.prepare('SELECT name FROM host_files WHERE email=? AND name LIKE ?').bind(a.email, pre + '%').all()).results || [], nd = await nodeGet(env); let n = 0;
    for (const r of rows) if (!keep.has(r.name)) { if (nd) { try { await hostNodeCall(env, nd, '/host/del', { uid, name: r.name }); } catch {} } await env.DB.prepare('DELETE FROM host_files WHERE email=? AND name=?').bind(a.email, r.name).run(); n++; }
    return json(env, req, { ok: true, removed: n });
  }
  if (path === '/api/host/delete') {
    await ensureHost(env); const nm = String(b.name || ''), prefix = !!b.prefix, nd = await nodeGet(env);
    const rows = prefix ? ((await env.DB.prepare('SELECT name FROM host_files WHERE email=? AND name LIKE ?').bind(a.email, nm.replace(/[%_]/g, '') + '%').all()).results || []) : [{ name: nm }];
    for (const r of rows.slice(0, 300)) { if (nd) { try { await hostNodeCall(env, nd, '/host/del', { uid, name: r.name }); } catch {} } await env.DB.prepare('DELETE FROM host_files WHERE email=? AND name=?').bind(a.email, r.name).run(); }
    return json(env, req, { ok: true, removed: rows.length });
  }
  if (path === '/api/host/plan') {
    const mb = Math.floor(Number(b.mb)); if (!(mb >= HOST_FREE && mb <= 2000)) return json(env, req, { error: 'Pick a size between ' + HOST_FREE + ' and 2000 MB.' }, 400);
    const s = await hostSummary(env, a); if (mb * MB < s.usedBytes) return json(env, req, { error: 'You are using ' + (s.usedBytes / MB).toFixed(2) + ' MB. Delete files first or pick at least ' + Math.ceil(s.usedBytes / MB) + ' MB.' }, 409);
    const owner = hostOwner(env, a), now = Date.now(), left = s.planMb > HOST_FREE && s.paidUntil > now ? Math.ceil(s.planMb * (s.paidUntil - now) / (30 * 864e5)) : 0;
    const charge = mb <= HOST_FREE || owner ? 0 : Math.max(0, mb - left);   // prorated credit for the unused part of the current plan
    if (charge > 0) { const up = await env.DB.prepare('UPDATE users SET credits=credits-? WHERE email=? AND credits>=?').bind(charge, a.email, charge).run(); if (!(up.meta && up.meta.changes > 0)) return json(env, req, { error: 'Not enough credits: this plan needs ' + charge + ' credits now.', code: 'credits', need: charge }, 402); await env.DB.prepare('INSERT INTO usage(email,at,input,output,credits) VALUES(?,?,0,0,?)').bind(a.email, new Date().toISOString(), charge).run(); }
    const pu = mb <= HOST_FREE ? 0 : now + 30 * 864e5;
    await env.DB.prepare('INSERT INTO host_plan(email,mb,paid_until) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET mb=excluded.mb, paid_until=excluded.paid_until').bind(a.email, mb, pu).run();
    const f = await getUser(env, a.email); const out = await hostSummary(env, { ...a, credits: f.credits }); out.charged = charge; return json(env, req, out);
  }
  return json(env, req, { error: 'Unknown storage endpoint' }, 404);
}
async function hostGet(env, req, path) {   // public image URLs for sites: /h/<uid>/img/<file>, served from the node
  const m = path.match(/^\/h\/([a-f0-9]{16})\/(img\/[\w.\-]{1,80})$/); const h = { 'access-control-allow-origin': '*' };
  if (!m) return new Response('not found', { status: 404, headers: h });
  const nd = await nodeGet(env); if (!nd) return new Response('storage node offline', { status: 503, headers: h });
  try {
    const r = await nfetch(nd.url.replace(/\/+$/, '') + '/host/get?uid=' + m[1] + '&name=' + encodeURIComponent(m[2]), { headers: { authorization: 'Bearer ' + nd.token } });
    if (!r.ok) return new Response('not found', { status: r.status === 404 ? 404 : 502, headers: h });
    return new Response(r.body, { headers: { ...h, 'content-type': r.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' } });
  } catch { return new Response('storage node unreachable', { status: 502, headers: h }); }
}

// ---- Enterprise: $99.99 per 30 days through Stripe = 1000 credits (they carry over, never expire) + Company page access; or unlock 30 days with 1000 credits from the balance ----
const ENT_USD = 99.99, ENT_CREDITS = 1000, ENT_DAYS = 30;
let ENT_READY = false;
async function ensureEnt(env) { if (ENT_READY) return; await env.DB.prepare('CREATE TABLE IF NOT EXISTS enterprise(email TEXT PRIMARY KEY, until INTEGER DEFAULT 0, started INTEGER, last_pay TEXT, via TEXT)').run(); ENT_READY = true; }
async function entExtend(env, email, via) { await ensureEnt(env); const now = Date.now(), r = await env.DB.prepare('SELECT until FROM enterprise WHERE email=?').bind(email).first(), until = Math.max(now, (r && r.until) || 0) + ENT_DAYS * 864e5; await env.DB.prepare('INSERT INTO enterprise(email,until,started,last_pay,via) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET until=excluded.until, last_pay=excluded.last_pay, via=excluded.via').bind(email, until, now, new Date().toISOString(), via).run(); return until; }
async function entStatus(env, a) { await ensureEnt(env); const r = await env.DB.prepare('SELECT until, via FROM enterprise WHERE email=?').bind(a.email).first(), owner = owners(env).includes(a.email) && !a.meter, until = (r && r.until) || 0; return { active: owner || until > Date.now(), until, via: (r && r.via) || '', owner, priceUsd: ENT_USD, credits: ENT_CREDITS, days: ENT_DAYS }; }
async function entApi(env, req, path) {
  const a = await authed(env, req); if (!a) return json(env, req, { error: 'Sign in first.' }, 401);
  if (path === '/api/enterprise/status') return json(env, req, { ...(await entStatus(env, a)), balance: +Number((await getUser(env, a.email)).credits).toFixed(2) });
  if (path === '/api/enterprise/activate' && req.method === 'POST') {   // pay with credits: 1000 credits unlock 30 days (no new grant)
    const owner = owners(env).includes(a.email) && !a.meter;
    if (!owner) {
      const up = await env.DB.prepare('UPDATE users SET credits=credits-? WHERE email=? AND credits>=?').bind(ENT_CREDITS, a.email, ENT_CREDITS).run();
      if (!(up.meta && up.meta.changes > 0)) { const f = await getUser(env, a.email), have = Number(f.credits); return json(env, req, { error: 'Enterprise needs ' + ENT_CREDITS + ' credits. You have ' + have.toFixed(1) + '.', code: 'credits', need: Math.ceil(ENT_CREDITS - have), packs: Math.ceil((ENT_CREDITS - have) / 100) }, 402); }
      await env.DB.prepare('INSERT INTO usage(email,at,input,output,credits) VALUES(?,?,0,0,?)').bind(a.email, new Date().toISOString(), ENT_CREDITS).run();
    }
    await entExtend(env, a.email, owner ? 'owner' : 'credits'); const f = await getUser(env, a.email);
    return json(env, req, { ...(await entStatus(env, a)), balance: +Number(f.credits).toFixed(2) });
  }
  return json(env, req, { error: 'Unknown enterprise endpoint' }, 404);
}


// ---- Referral + affiliate promo program ----
const REF_NEW = 10, REF_REFERRER = 10, REF_CAP = 100, PROMO_CREDITS = 100, PROMO_MAX_PENDING = 3, PROMO_MAX_APPROVED = 5;
let REF_READY = false;
async function ensureRef(env) {
  if (REF_READY) return;
  const st = [
    'CREATE TABLE IF NOT EXISTS ref_codes(email TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, created TEXT)',
    'CREATE TABLE IF NOT EXISTS ref_uses(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, referrer TEXT NOT NULL, referee TEXT UNIQUE NOT NULL, ip TEXT, at TEXT, referee_credits REAL, referrer_credits REAL)',
    'CREATE INDEX IF NOT EXISTS ref_uses_ref ON ref_uses(referrer)', 'CREATE INDEX IF NOT EXISTS ref_uses_ip ON ref_uses(ip)',
    'CREATE TABLE IF NOT EXISTS ref_fail(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, ip TEXT, code TEXT, why TEXT, at TEXT)',
    'CREATE TABLE IF NOT EXISTS promos(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, url TEXT, vid TEXT UNIQUE, status TEXT DEFAULT \'pending\', credits REAL DEFAULT 0, note TEXT, created TEXT, decided TEXT)',
    'CREATE INDEX IF NOT EXISTS promos_email ON promos(email)', 'CREATE INDEX IF NOT EXISTS promos_status ON promos(status)',
  ];
  for (const x of st) await env.DB.prepare(x).run();
  REF_READY = true;
}
const REF_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
async function refCode(env, email) {
  await ensureRef(env);
  const r = await env.DB.prepare('SELECT code FROM ref_codes WHERE email=?').bind(email).first();
  if (r) return r.code;
  for (let i = 0; i < 6; i++) {
    const code = 'AIX-' + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => REF_ABC[b % REF_ABC.length]).join('');
    try { await env.DB.prepare('INSERT INTO ref_codes(email,code,created) VALUES(?,?,?)').bind(email, code, new Date().toISOString()).run(); return code; }
    catch (e) { const again = await env.DB.prepare('SELECT code FROM ref_codes WHERE email=?').bind(email).first(); if (again) return again.code; }
  }
  throw new Error('could not make a referral code');
}
function ytId(u) {
  let x; try { x = new URL(String(u || '').trim()); } catch (e) { return ''; }
  if (x.protocol !== 'https:' && x.protocol !== 'http:') return '';
  const h = x.hostname.replace(/^www\.|^m\./, ''); let id = '';
  if (h === 'youtu.be') id = x.pathname.slice(1).split('/')[0];
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    if (x.pathname === '/watch') id = x.searchParams.get('v') || '';
    else { const m = x.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/); if (m) id = m[2]; }
  }
  return /^[\w-]{11}$/.test(id) ? id : '';
}
async function refApi(env, req, path) {
  await ensureRef(env);
  const a = await authed(env, req);
  if (!a) return json(env, req, { error: 'sign in' }, 401);
  const now = new Date().toISOString(), ip = req.headers.get('cf-connecting-ip') || 'unknown';
  const myPromos = async () => (await env.DB.prepare('SELECT id,url,vid,status,credits,note,created,decided FROM promos WHERE email=? ORDER BY id DESC LIMIT 30').bind(a.email).all()).results || [];
  if (path === '/api/ref/me') {
    const code = await refCode(env, a.email);
    const st = (await env.DB.prepare('SELECT COUNT(*) n, COALESCE(SUM(referrer_credits),0) c FROM ref_uses WHERE referrer=?').bind(a.email).first()) || {};
    const recent = (await env.DB.prepare('SELECT referee, at, referrer_credits c FROM ref_uses WHERE referrer=? ORDER BY id DESC LIMIT 20').bind(a.email).all()).results || [];
    const used = await env.DB.prepare('SELECT code, referee_credits c, at FROM ref_uses WHERE referee=?').bind(a.email).first();
    return json(env, req, { code, invited: st.n || 0, earned: st.c || 0, cap: REF_CAP, newUserCredits: REF_NEW, referrerCredits: REF_REFERRER,
      recent: recent.map((r) => ({ who: String(r.referee).replace(/^(.{2}).*?(@.*)?$/, (m, x, y) => x + '***' + (y || '')), at: r.at, credits: r.c })),
      redeemed: used ? { code: used.code, credits: used.c, at: used.at } : null, canRedeem: !used && !!a.username,
      promos: await myPromos(), promoCredits: PROMO_CREDITS });
  }
  if (path === '/api/ref/redeem' && req.method === 'POST') {
    const b = await req.json().catch(() => ({})); const code = String(b.code || '').trim().toUpperCase();
    const fail = async (why, status, msg) => { try { await env.DB.prepare('INSERT INTO ref_fail(email,ip,code,why,at) VALUES(?,?,?,?,?)').bind(a.email, ip, code.slice(0, 20), why, now).run(); } catch (e) {} return json(env, req, { error: msg }, status); };
    if (!/^AIX-[A-Z0-9]{6}$/.test(code)) return fail('format', 400, 'That is not a referral code. It looks like AIX-ABC123.');
    if (!a.username) return fail('guest', 403, 'Create your account (username + password) first, then enter the code.');
    if (await env.DB.prepare('SELECT 1 x FROM ref_uses WHERE referee=?').bind(a.email).first()) return fail('twice', 409, 'You already used a referral code.');
    const age = Date.now() - Date.parse(a.created || now);
    if (age > 30 * 864e5) return fail('old', 403, 'Referral codes work only in the first 30 days of a new account.');
    const rc = await env.DB.prepare('SELECT email FROM ref_codes WHERE code=?').bind(code).first();
    if (!rc) return fail('unknown', 404, 'Code not found. Check it with the person who sent it.');
    if (rc.email === a.email) return fail('self', 403, 'You cannot use your own code.');
    if (await env.DB.prepare('SELECT 1 x FROM ref_uses WHERE ip=? LIMIT 1').bind(ip).first()) return fail('ip', 429, 'A referral code was already used from this network.');
    const cnt = await env.DB.prepare('SELECT COUNT(*) n FROM ref_uses WHERE referrer=?').bind(rc.email).first();
    const full = (cnt.n || 0) >= REF_CAP, rr = full ? 0 : REF_REFERRER;
    try { await env.DB.prepare('INSERT INTO ref_uses(code,referrer,referee,ip,at,referee_credits,referrer_credits) VALUES(?,?,?,?,?,?,?)').bind(code, rc.email, a.email, ip, now, REF_NEW, rr).run(); }
    catch (e) { return json(env, req, { error: 'You already used a referral code.' }, 409); }
    const ops = [env.DB.prepare('UPDATE users SET credits=credits+? WHERE email=?').bind(REF_NEW, a.email), env.DB.prepare('INSERT OR IGNORE INTO purchases(email,at,usd,credits,ref) VALUES(?,?,0,?,?)').bind(a.email, now, REF_NEW, 'ref-new-' + a.email)];
    if (rr) ops.push(env.DB.prepare('UPDATE users SET credits=credits+? WHERE email=?').bind(rr, rc.email), env.DB.prepare('INSERT OR IGNORE INTO purchases(email,at,usd,credits,ref) VALUES(?,?,0,?,?)').bind(rc.email, now, rr, 'ref-by-' + a.email));
    await env.DB.batch(ops); AUTH_C.clear();
    const u = await getUser(env, a.email);
    return json(env, req, { ok: true, credits: REF_NEW, balance: u ? u.credits : undefined });
  }
  if (path === '/api/promo/submit' && req.method === 'POST') {
    const b = await req.json().catch(() => ({})); const vid = ytId(b.url);
    if (!vid) return json(env, req, { error: 'Paste a YouTube link (youtube.com/watch, youtu.be or Shorts).' }, 400);
    if (!a.username) return json(env, req, { error: 'Create your account (username + password) first.' }, 403);
    const c = await env.DB.prepare("SELECT SUM(status='pending') p, SUM(status='approved') ok FROM promos WHERE email=?").bind(a.email).first() || {};
    if ((c.p || 0) >= PROMO_MAX_PENDING) return json(env, req, { error: 'You already have ' + PROMO_MAX_PENDING + ' videos waiting for review. Wait for a decision first.' }, 429);
    if ((c.ok || 0) >= PROMO_MAX_APPROVED) return json(env, req, { error: 'You reached the limit of ' + PROMO_MAX_APPROVED + ' rewarded videos.' }, 429);
    try { await env.DB.prepare("INSERT INTO promos(email,url,vid,status,created) VALUES(?,?,?,'pending',?)").bind(a.email, 'https://www.youtube.com/watch?v=' + vid, vid, now).run(); }
    catch (e) { return json(env, req, { error: 'That video was already submitted.' }, 409); }
    return json(env, req, { ok: true, promos: await myPromos() });
  }
  return json(env, req, { error: 'not found' }, 404);
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
    if (path.startsWith('/api/enterprise/')) return entApi(env, req, path);
    if (path.startsWith('/api/ref/') || path === '/api/promo/submit') return refApi(env, req, path);
    if (path.startsWith('/api/host/')) return hostApi(env, req, path);
    if (path.startsWith('/h/')) return hostGet(env, req, path);
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
