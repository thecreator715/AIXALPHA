// AIX Alpha Node v2 — Ollama proxy + monitor dashboard. Node 18+, no dependencies.
const http = require('http'), os = require('os'), fs = require('fs'), path = require('path');
const TOKEN = process.env.AIX_TOKEN || '';
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const PORT = +(process.env.PORT || 8787);
const ORIGINS = (process.env.AIX_ORIGINS || '*').split(',');
if (!TOKEN) { console.error('Set AIX_TOKEN first'); process.exit(1); }
const LOGTEXT = process.env.AIX_LOG_PROMPTS !== '0';   // set AIX_LOG_PROMPTS=0 to keep only sizes, never prompt/reply text
const LOGFILE = path.join(__dirname, 'requests.log');
const started = Date.now(), LOG = [], ST = { req: 0, err: 0, chunks: 0, ms: 0, done: 0 };
try { if (fs.existsSync(LOGFILE)) { let L = fs.readFileSync(LOGFILE, 'utf8').split('\n').filter(Boolean); if (L.length > 3000) { L = L.slice(-1000); fs.writeFileSync(LOGFILE, L.join('\n') + '\n'); } for (const l of L.slice(-300)) { try { LOG.push(JSON.parse(l)); } catch {} } } } catch {}
const clip = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);
const lastUser = (m) => { const a = (m || []).filter((x) => x && x.role === 'user'); const c = a.length ? a[a.length - 1].content : ''; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => (p && p.text) || '').join('') : ''; };
const cors = (req) => ({
  'access-control-allow-origin': ORIGINS.includes('*') ? '*' : (ORIGINS.includes(req.headers.origin) ? req.headers.origin : ORIGINS[0]),
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-private-network': 'true', 'access-control-max-age': '600',
});
let lastCpu = os.cpus().map((c) => ({ ...c.times })), cpuPct = 0;
setInterval(() => { const n = os.cpus().map((c) => ({ ...c.times })); let idle = 0, tot = 0; n.forEach((t, i) => { const p = lastCpu[i]; for (const k in t) tot += t[k] - p[k]; idle += t.idle - p.idle; }); cpuPct = tot ? Math.round(100 * (1 - idle / tot)) : 0; lastCpu = n; }, 2000).unref();
const J = (res, h, code, obj) => { res.writeHead(code, { ...h, 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
async function body(req) { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c); }
async function oll(p, opt) { const r = await fetch(OLLAMA + p, opt); return r; }
http.createServer(async (req, res) => {
  const h = cors(req), u = req.url.split('?')[0];
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  if (u === '/' || u === '/monitor' || u === '/monitor.html') { try { const f = fs.readFileSync(path.join(__dirname, 'monitor.html')); res.writeHead(200, { ...h, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(f); } catch { res.writeHead(404, h); return res.end('monitor.html missing'); } }
  if (u === '/health') return J(res, h, 200, { status: 'ok', engine: 'aix-node', build: 3 });
  const localAdmin = u.startsWith('/admin') && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || '') && !req.headers['x-forwarded-for'] && !req.headers['cf-connecting-ip'] && !req.headers.origin;
  if (!localAdmin && (req.headers.authorization || '') !== 'Bearer ' + TOKEN) return J(res, h, 401, { error: 'bad token' });
  try {
    if (u === '/admin/status') {
      let ps = [], up = false, ver = '';
      try { const r = await oll('/api/ps'); up = r.ok; ps = (await r.json()).models || []; } catch {}
      try { ver = (await (await oll('/api/version')).json()).version; } catch {}
      return J(res, h, 200, { ollama: up, version: ver, loaded: ps.map((m) => ({ name: m.name, size: m.size, expires: m.expires_at })), host: os.hostname(), cpu: cpuPct, load: os.loadavg(), mem: { total: os.totalmem(), free: os.freemem() }, uptime: Math.round((Date.now() - started) / 1000), sysUptime: Math.round(os.uptime()), cores: os.cpus().length, chip: (os.cpus()[0] || {}).model, req: ST.req, err: ST.err, tokens: ST.chunks, avgMs: ST.done ? Math.round(ST.ms / ST.done) : 0 });
    }
    if (u === '/admin/log') return J(res, h, 200, { logText: LOGTEXT, items: LOG.filter((e) => e.path.includes('chat/completions')).slice(-200).reverse() });
    if (u === '/admin/cloud') {
      const W = process.env.AIX_WORKER, NS = process.env.AIX_NODE_SECRET;
      if (!W || !NS) return J(res, h, 503, { error: 'Cloud link not configured on this node (needs AIX_WORKER and AIX_NODE_SECRET).' });
      const what = (new URL(req.url, 'http://x').searchParams.get('what') || 'overview').replace(/[^a-z]/g, '');
      const r = await fetch(W.replace(/\/+$/, '') + '/api/node/admin?what=' + what, { headers: { 'x-node-secret': NS } });
      return J(res, h, r.status, await r.json().catch(() => ({ error: 'bad response' })));
    }
    if (u === '/admin/models') { const r = await oll('/api/tags'); return J(res, h, r.status, await r.json()); }
    if (u === '/admin/delete' && req.method === 'POST') { const b = JSON.parse((await body(req)).toString() || '{}'); const r = await oll('/api/delete', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: b.name }) }); return J(res, h, r.ok ? 200 : r.status, { ok: r.ok }); }
    if (u === '/admin/pull' && req.method === 'POST') {
      const b = JSON.parse((await body(req)).toString() || '{}');
      const up = await oll('/api/pull', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: b.name, stream: true }) });
      res.writeHead(up.status, { ...h, 'content-type': 'application/x-ndjson' }); for await (const c of up.body) res.write(c); return res.end();
    }
    if (u === '/admin/unload' && req.method === 'POST') { const b = JSON.parse((await body(req)).toString() || '{}'); await oll('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: b.name, keep_alive: 0 }) }); return J(res, h, 200, { ok: true }); }
    if (u.startsWith('/v1/') || u === '/api/tags') {
      const t0 = Date.now(); const buf = req.method === 'GET' ? undefined : await body(req); let model = '', pj = null; try { pj = JSON.parse(buf.toString()); model = pj.model || ''; } catch {}
      ST.req++; const ent = { t: new Date().toISOString(), path: u, model, status: 0, ms: 0, tokens: 0, user: clip(req.headers['x-aix-user'], 80), src: clip(req.headers['x-aix-src'], 12) || 'direct', stream: !!(pj && pj.stream), msgs: pj && pj.messages ? pj.messages.length : 0, inChars: pj && pj.messages ? JSON.stringify(pj.messages).length : 0, prompt: LOGTEXT && pj ? clip(lastUser(pj.messages), 400) : '', reply: '' };
      let acc = '', rawAcc = '';
      const up = await fetch(OLLAMA + req.url, { method: req.method, headers: { 'content-type': 'application/json' }, body: buf });
      ent.status = up.status; if (!up.ok) ST.err++;
      res.writeHead(up.status, { ...h, 'content-type': up.headers.get('content-type') || 'application/json', 'cache-control': 'no-cache' });
      if (up.body) for await (const c of up.body) { res.write(c); const cs = Buffer.from(c).toString('utf8'); const n = (cs.match(/"content":"/g) || []).length; ent.tokens += n; ST.chunks += n; if (rawAcc.length < 60000) rawAcc += cs; }
      try {
        if (ent.stream) { for (const ln of rawAcc.split('\n')) if (ln.startsWith('data:') && !ln.includes('[DONE]')) { try { const e = JSON.parse(ln.slice(5)); const t = e.choices && e.choices[0] && e.choices[0].delta && e.choices[0].delta.content; if (t) acc += t; } catch {} } }
        else { const j = JSON.parse(rawAcc); acc = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''; if (j.usage && j.usage.completion_tokens) ent.tokens = j.usage.completion_tokens; }
      } catch {}
      ent.outChars = acc.length; if (LOGTEXT) ent.reply = clip(acc, 400);
      ent.ms = Date.now() - t0; ST.ms += ent.ms; ST.done++; LOG.push(ent); if (LOG.length > 300) LOG.shift();
      if (ent.path.includes('chat/completions')) { try { fs.appendFileSync(LOGFILE, JSON.stringify(ent) + '\n'); } catch {} }
      return res.end();
    }
    res.writeHead(404, h); res.end('not found');
  } catch (e) { ST.err++; try { J(res, h, 502, { error: 'Ollama not reachable: ' + e.message }); } catch {} }
}).listen(PORT, () => {
  console.log(`AIX node v2 on :${PORT} -> ${OLLAMA}   dashboard: http://localhost:${PORT}/`);
  const W = process.env.AIX_WORKER, PU = process.env.AIX_PUBLIC_URL, NS = process.env.AIX_NODE_SECRET, MODEL = process.env.MODEL || '';
  if (W && PU && NS && MODEL) {
    const reg = async () => { try { const r = await fetch(W.replace(/\/+$/, '') + '/api/node/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-node-secret': NS }, body: JSON.stringify({ url: PU, token: TOKEN, model: MODEL }) }); if (!reg.ok) { reg.ok = r.ok; console.log(r.ok ? 'Registered with AIX cloud: apps will use this node automatically' : 'Register failed: HTTP ' + r.status); } } catch (e) { console.log('Register error: ' + e.message); reg.ok = false; } };
    reg(); setInterval(reg, 45000).unref && 0; setInterval(reg, 45000);
  } else console.log('Cloud registration off (needs AIX_WORKER, AIX_PUBLIC_URL, AIX_NODE_SECRET, MODEL)');
});
