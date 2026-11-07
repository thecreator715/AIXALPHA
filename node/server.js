// AIX Alpha Node v2 — Ollama proxy + monitor dashboard. Node 18+, no dependencies.
const http = require('http'), os = require('os'), fs = require('fs'), path = require('path');
const TOKEN = process.env.AIX_TOKEN || '';
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const PORT = +(process.env.PORT || 8787);
const ORIGINS = (process.env.AIX_ORIGINS || '*').split(',');
if (!TOKEN) { console.error('Set AIX_TOKEN first'); process.exit(1); }
const started = Date.now(), LOG = [], ST = { req: 0, err: 0, chunks: 0, ms: 0, done: 0 };
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
  if (u === '/' || u === '/monitor' || u === '/monitor.html') { try { const f = fs.readFileSync(path.join(__dirname, 'monitor.html')); res.writeHead(200, { ...h, 'content-type': 'text/html; charset=utf-8' }); return res.end(f); } catch { res.writeHead(404, h); return res.end('monitor.html missing'); } }
  if (u === '/health') return J(res, h, 200, { status: 'ok', engine: 'aix-node' });
  if ((req.headers.authorization || '') !== 'Bearer ' + TOKEN) return J(res, h, 401, { error: 'bad token' });
  try {
    if (u === '/admin/status') {
      let ps = [], up = false, ver = '';
      try { const r = await oll('/api/ps'); up = r.ok; ps = (await r.json()).models || []; } catch {}
      try { ver = (await (await oll('/api/version')).json()).version; } catch {}
      return J(res, h, 200, { ollama: up, version: ver, loaded: ps.map((m) => ({ name: m.name, size: m.size, expires: m.expires_at })), host: os.hostname(), cpu: cpuPct, load: os.loadavg(), mem: { total: os.totalmem(), free: os.freemem() }, uptime: Math.round((Date.now() - started) / 1000), sysUptime: Math.round(os.uptime()), cores: os.cpus().length, chip: (os.cpus()[0] || {}).model, req: ST.req, err: ST.err, tokens: ST.chunks, avgMs: ST.done ? Math.round(ST.ms / ST.done) : 0 });
    }
    if (u === '/admin/log') return J(res, h, 200, LOG.slice(-80).reverse());
    if (u === '/admin/models') { const r = await oll('/api/tags'); return J(res, h, r.status, await r.json()); }
    if (u === '/admin/delete' && req.method === 'POST') { const b = JSON.parse((await body(req)).toString() || '{}'); const r = await oll('/api/delete', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: b.name }) }); return J(res, h, r.ok ? 200 : r.status, { ok: r.ok }); }
    if (u === '/admin/pull' && req.method === 'POST') {
      const b = JSON.parse((await body(req)).toString() || '{}');
      const up = await oll('/api/pull', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: b.name, stream: true }) });
      res.writeHead(up.status, { ...h, 'content-type': 'application/x-ndjson' }); for await (const c of up.body) res.write(c); return res.end();
    }
    if (u === '/admin/unload' && req.method === 'POST') { const b = JSON.parse((await body(req)).toString() || '{}'); await oll('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: b.name, keep_alive: 0 }) }); return J(res, h, 200, { ok: true }); }
    if (u.startsWith('/v1/') || u === '/api/tags') {
      const t0 = Date.now(); const buf = req.method === 'GET' ? undefined : await body(req); let model = ''; try { model = JSON.parse(buf.toString()).model || ''; } catch {}
      ST.req++; const ent = { t: new Date().toISOString(), path: u, model, status: 0, ms: 0, tokens: 0 };
      const up = await fetch(OLLAMA + req.url, { method: req.method, headers: { 'content-type': 'application/json' }, body: buf });
      ent.status = up.status; if (!up.ok) ST.err++;
      res.writeHead(up.status, { ...h, 'content-type': up.headers.get('content-type') || 'application/json', 'cache-control': 'no-cache' });
      if (up.body) for await (const c of up.body) { res.write(c); const n = (c.toString().match(/"content":"/g) || []).length; ent.tokens += n; ST.chunks += n; }
      ent.ms = Date.now() - t0; ST.ms += ent.ms; ST.done++; LOG.push(ent); if (LOG.length > 300) LOG.shift(); return res.end();
    }
    res.writeHead(404, h); res.end('not found');
  } catch (e) { ST.err++; try { J(res, h, 502, { error: 'Ollama not reachable: ' + e.message }); } catch {} }
}).listen(PORT, () => console.log(`AIX node v2 on :${PORT} -> ${OLLAMA}   dashboard: http://localhost:${PORT}/`));
