// AIX Alpha Node — runs on your Mac Studio. Wraps Ollama with a token, CORS and one HTTPS-friendly port.
// Usage:  ollama serve   (separate terminal)   then:   AIX_TOKEN=pick-a-long-secret node server.js
// Needs Node 18+. No dependencies.
const http = require('http');
const TOKEN = process.env.AIX_TOKEN || '';
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const PORT = +(process.env.PORT || 8787);
const ORIGINS = (process.env.AIX_ORIGINS || '*').split(',');
if (!TOKEN) { console.error('Set AIX_TOKEN first, e.g.  AIX_TOKEN=$(openssl rand -hex 24) node server.js'); process.exit(1); }
const cors = (req) => ({
  'access-control-allow-origin': ORIGINS.includes('*') ? '*' : (ORIGINS.includes(req.headers.origin) ? req.headers.origin : ORIGINS[0]),
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-private-network': 'true',
  'access-control-max-age': '600',
});
http.createServer(async (req, res) => {
  const h = cors(req);
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  if (req.url === '/health') { res.writeHead(200, { ...h, 'content-type': 'application/json' }); return res.end('{"status":"ok","engine":"aix-node"}'); }
  if ((req.headers.authorization || '') !== 'Bearer ' + TOKEN) { res.writeHead(401, { ...h, 'content-type': 'application/json' }); return res.end('{"error":"bad token"}'); }
  if (!(req.url.startsWith('/v1/') || req.url.startsWith('/api/tags'))) { res.writeHead(404, h); return res.end('not found'); }
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    const up = await fetch(OLLAMA + req.url, { method: req.method, headers: { 'content-type': 'application/json' }, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    res.writeHead(up.status, { ...h, 'content-type': up.headers.get('content-type') || 'application/json', 'cache-control': 'no-cache' });
    if (!up.body) return res.end();
    for await (const c of up.body) res.write(c);
    res.end();
  } catch (e) { res.writeHead(502, { ...h, 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Ollama not reachable: ' + e.message })); }
}).listen(PORT, () => console.log(`AIX node on :${PORT} -> ${OLLAMA}`));
