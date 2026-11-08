// AIX Alpha Node v2 — Ollama proxy + monitor dashboard. Node 18+, no dependencies.
const http = require('http'), os = require('os'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const VERSION = 11;   // bump on every release: nodes auto-update when GitHub has a higher number
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
// ---- Backups: every 24h pull a compact gzipped snapshot of the cloud database + a copy of the node's own log, keep 30 days ----
const zlib = require('zlib'), BKDIR = path.join(__dirname, 'backups'); let LASTBK = null, REGOK = false, LASTREG = null;
try { fs.mkdirSync(BKDIR, { recursive: true }); } catch {}
const bkList = () => { try { return fs.readdirSync(BKDIR).filter((f) => /\.gz$/.test(f)).map((f) => { const st = fs.statSync(path.join(BKDIR, f)); return { name: f, bytes: st.size, at: st.mtimeMs }; }).sort((a, b) => b.at - a.at); } catch { return []; } };
const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
async function runBackup(kind) {
  const out = { ok: false, files: [] };
  try {
    const W = process.env.AIX_WORKER, NS = process.env.AIX_NODE_SECRET;
    if (W && NS) { const r = await fetch(W.replace(/\/+$/, '') + '/api/node/admin?what=backup_now&kind=node', { method: 'POST', headers: { 'x-node-secret': NS } }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); const f = 'aix-cloud-' + stamp() + '.json.gz'; fs.writeFileSync(path.join(BKDIR, f), Buffer.from(j.data, 'base64')); out.files.push(f); out.rows = j.rows; }
    try { if (fs.existsSync(LOGFILE)) { const f = 'aix-node-log-' + stamp() + '.log.gz'; fs.writeFileSync(path.join(BKDIR, f), zlib.gzipSync(fs.readFileSync(LOGFILE))); out.files.push(f); } } catch {}
    const all = bkList(), cut = Date.now() - 30 * 86400e3; all.filter((f) => f.at < cut).forEach((f) => { try { fs.unlinkSync(path.join(BKDIR, f.name)); } catch {} });
    out.ok = out.files.length > 0; if (!out.ok) out.error = 'Cloud link not configured and no log to back up'; LASTBK = { at: Date.now(), kind, ok: out.ok, files: out.files };
  } catch (e) { out.error = e.message; LASTBK = { at: Date.now(), kind, ok: false, error: e.message }; }
  return out;
}
setTimeout(() => { const l = bkList()[0]; if (!l || Date.now() - l.at > 23.5 * 3600e3) runBackup('auto'); }, 20000);
setInterval(() => { const l = bkList()[0]; if (!l || Date.now() - l.at > 23.5 * 3600e3) runBackup('auto'); }, 3600e3);
// ---- history ring (every 10s, 2h) for charts + analytics from requests.log ----
const HIST = []; setInterval(() => { HIST.push({ t: Date.now(), cpu: cpuPct, mem: 1 - os.freemem() / os.totalmem(), load: os.loadavg()[0] }); if (HIST.length > 720) HIST.shift(); }, 10000);
function analytics() {
  let L = []; try { L = fs.readFileSync(LOGFILE, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((e) => e && e.path && /chat\/completions/.test(e.path)); } catch {}
  const now = Date.now(), H = 3600e3, hours = [], days = [];
  for (let i = 23; i >= 0; i--) hours.push({ t: now - i * H, n: 0, err: 0, tok: 0, ms: 0 });
  for (let i = 13; i >= 0; i--) days.push({ d: new Date(now - i * 86400e3).toISOString().slice(0, 10), n: 0, err: 0, tok: 0 });
  const buck = [1, 2, 5, 10, 20, 40, 80, 1e9], hist = buck.map((b, i) => ({ le: b, n: 0 })), by = { model: {}, src: {}, user: {} }, heat = Array.from({ length: 7 }, () => Array(24).fill(0)), ms = [];
  for (const e of L) {
    const t = Date.parse(e.t); if (!t) continue; const d = new Date(t);
    const hi = 23 - Math.floor((now - t) / H); if (hi >= 0 && hi < 24) { const x = hours[hi]; x.n++; x.tok += e.tokens || 0; x.ms += e.ms || 0; if (e.status >= 400) x.err++; }
    const di = days.findIndex((x) => x.d === d.toISOString().slice(0, 10)); if (di >= 0) { days[di].n++; days[di].tok += e.tokens || 0; if (e.status >= 400) days[di].err++; }
    heat[d.getDay()][d.getHours()]++; const s = (e.ms || 0) / 1000; ms.push(e.ms || 0); const b = hist.find((h) => s <= h.le); if (b) b.n++;
    for (const [k, v] of [['model', e.model || '?'], ['src', e.src || 'direct'], ['user', e.user || 'anonymous']]) { const o = by[k][v] || (by[k][v] = { n: 0, tok: 0, ms: 0, err: 0 }); o.n++; o.tok += e.tokens || 0; o.ms += e.ms || 0; if (e.status >= 400) o.err++; }
  }
  const top = (o) => Object.entries(o).map(([k, v]) => ({ k, n: v.n, tok: v.tok, avgMs: v.n ? Math.round(v.ms / v.n) : 0, err: v.err })).sort((a, b) => b.n - a.n).slice(0, 12);
  ms.sort((a, b) => a - b); const p = (q) => ms[Math.min(ms.length - 1, Math.floor(ms.length * q))] || 0;
  const slow = L.slice().sort((a, b) => (b.ms || 0) - (a.ms || 0)).slice(0, 8).map((e) => ({ t: e.t, ms: e.ms, model: e.model, user: e.user, src: e.src, tokens: e.tokens, prompt: e.prompt }));
  const totTok = L.reduce((a, e) => a + (e.tokens || 0), 0), totMs = L.reduce((a, e) => a + (e.ms || 0), 0);
  return { total: L.length, errors: L.filter((e) => e.status >= 400).length, hours, days, hist, heat, byModel: top(by.model), bySrc: top(by.src), byUser: top(by.user), p50: p(0.5), p95: p(0.95), p99: p(0.99), tokPerSec: totMs ? +(totTok / (totMs / 1000)).toFixed(1) : 0, slow, since: L[0] && L[0].t };
}
// ---- auto-update: panel always served fresh from GitHub; server.js replaces itself when a newer VERSION is published ----
const UPD = (process.env.AIX_UPDATE_URL || 'https://raw.githubusercontent.com/thecreator715/AIXALPHA/main/node/').replace(/\/?$/, '/'), UPD_ON = process.env.AIX_UPDATE !== '0';
let PANEL = { html: '', at: 0 }, UPDST = { checked: 0, remote: null, applied: false, error: '' };
async function getRemote(f, ms) { const r = await fetch(UPD + f + '?t=' + Date.now(), { signal: AbortSignal.timeout(ms || 5000), headers: { 'cache-control': 'no-cache' } }); if (!r.ok) throw new Error(f + ' HTTP ' + r.status); return r.text(); }
async function panelHtml() {
  if (UPD_ON && Date.now() - PANEL.at > 120000) { try { const t = await getRemote('monitor.html', 3500); if (t.length > 15000 && t.includes('AIX NODE CONTROL')) PANEL = { html: t, at: Date.now() }; else PANEL.at = Date.now() - 60000; } catch { PANEL.at = Date.now() - 90000; } }
  if (PANEL.html) return PANEL.html;
  return fs.readFileSync(path.join(__dirname, 'monitor.html'), 'utf8');
}
async function checkUpdate() {
  if (!UPD_ON) return; UPDST.checked = Date.now();
  try {
    const src = await getRemote('server.js', 8000), m = src.match(/const VERSION = (\d+)/); UPDST.remote = m ? +m[1] : null; UPDST.error = '';
    if (!m || +m[1] <= VERSION) return;
    new (require('vm').Script)(src);   // refuse a file that does not even parse
    if (!src.includes('AIX Alpha Node') || src.length < 8000) throw new Error('remote server.js looks wrong');
    const me = path.join(__dirname, 'server.js'); try { fs.copyFileSync(me, me + '.bak'); } catch {}
    fs.writeFileSync(me + '.new', src); fs.renameSync(me + '.new', me); UPDST.applied = true;
    try { fs.writeFileSync(path.join(__dirname, 'monitor.html'), await getRemote('monitor.html', 8000)); } catch {}
    console.log('Updated node to v' + m[1] + ' — restarting'); setTimeout(() => process.exit(0), 800);
  } catch (e) { UPDST.error = e.message; }
}
setTimeout(checkUpdate, 30000); setInterval(checkUpdate, 30 * 60000);
http.createServer(async (req, res) => {
  const h = cors(req), u = req.url.split('?')[0];
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  if (u === '/' || u === '/monitor' || u === '/monitor.html') { try { const f = await panelHtml(); res.writeHead(200, { ...h, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(f); } catch { res.writeHead(404, h); return res.end('monitor.html missing'); } }
  if (u === '/health') return J(res, h, 200, { status: 'ok', engine: 'aix-node', build: 3, version: VERSION, update: UPDST });
  const localAdmin = u.startsWith('/admin') && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || '') && !req.headers['x-forwarded-for'] && !req.headers['cf-connecting-ip'] && (!req.headers.origin || req.headers.origin === 'http://' + req.headers.host);
  // ---- co-admin roles: owner (node token / this Mac) can mint limited tokens in admins.json ----
  const AF = path.join(__dirname, 'admins.json'), loadTeam = () => { try { return JSON.parse(fs.readFileSync(AF, 'utf8')); } catch { return {}; } };
  const ROLE_OK = {
    support: ['overview', 'users', 'user360', 'user_note', 'tickets', 'ticket', 'ticket_reply', 'ticket_status', 'moderation', 'mod_decide', 'alerts', 'alert_ack', 'referrals', 'promos'],
    manager: ['*', '!config_set', '!restore', '!grant', '!export', '!backup_now', '!backup_get', '!backups', '!storage'],
  };
  let ACTOR = 'owner', ROLE = 'owner';
  const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!localAdmin && bearer !== TOKEN) {
    const tm = loadTeam(), mem = bearer && tm[bearer];
    if (!mem || !u.startsWith('/admin')) return J(res, h, 401, { error: 'bad token' });
    ACTOR = mem.name; ROLE = mem.role;
    const wh = (new URL(req.url, 'http://x').searchParams.get('what') || 'overview').replace(/[^a-z_0-9]/g, '');
    if (u === '/admin/cloud') {
      const al = ROLE_OK[ROLE] || [], ok = al.includes('*') ? !al.includes('!' + wh) : al.includes(wh);
      if (!ok) return J(res, h, 403, { error: 'Your role (' + ROLE + ') cannot use "' + wh + '".' });
    } else if (u !== '/admin/me' && u !== '/admin/status') return J(res, h, 403, { error: 'Your role (' + ROLE + ') cannot use this.' });
  }
  if (u === '/admin/me') return J(res, h, 200, { name: ACTOR, role: ROLE, allowed: ROLE === 'owner' ? ['*'] : ROLE_OK[ROLE] || [] });
  if (u === '/admin/team') {
    if (ROLE !== 'owner') return J(res, h, 403, { error: 'Only the owner manages the team.' });
    const tm = loadTeam();
    if (req.method === 'POST') {
      const b = JSON.parse((await body(req)).toString() || '{}');
      if (b.remove) { delete tm[String(b.remove)]; fs.writeFileSync(AF, JSON.stringify(tm, null, 1)); return J(res, h, 200, { ok: true }); }
      const name = String(b.name || '').replace(/[^\w .@-]/g, '').slice(0, 30).trim(), role = ['support', 'manager'].includes(b.role) ? b.role : null;
      if (!name || !role) return J(res, h, 400, { error: 'name and role (support or manager) required' });
      const tok = 'aixadm_' + crypto.randomBytes(24).toString('hex'); tm[tok] = { name, role, at: new Date().toISOString() };
      fs.writeFileSync(AF, JSON.stringify(tm, null, 1)); return J(res, h, 200, { ok: true, token: tok, name, role });
    }
    return J(res, h, 200, { team: Object.entries(tm).map(([t, m]) => ({ id: t, hint: t.slice(0, 11) + '…' + t.slice(-4), name: m.name, role: m.role, at: m.at })) });
  }
  // ---- Hosted images for sites: the cloud (gatekeeper: quota + billing) stores/serves user images here, on this Mac ----
  if (u.startsWith('/host/')) {
    const HD = path.join(__dirname, 'hosted'), okUid = (x) => /^[a-f0-9]{16}$/.test(x || ''), okName = (x) => /^[\w.\-]+(\/[\w.\-]+){0,6}$/.test(x || '') && x.length <= 160 && !x.includes('..');
    const MT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif' };
    try {
      if (u === '/host/put' && req.method === 'POST') {
        const b = JSON.parse((await body(req)).toString() || '{}'); if (!okUid(b.uid) || !okName(b.name)) return J(res, h, 400, { error: 'bad name' });
        const buf = Buffer.from(String(b.data || ''), 'base64'); if (!buf.length && b.name !== '_owner.json' || buf.length > 5 * 1024 * 1024) return J(res, h, 400, { error: 'bad size' });
        const fp = path.join(HD, b.uid, b.name); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, buf); return J(res, h, 200, { ok: true, bytes: buf.length });
      }
      if (u === '/host/get') {
        const q = new URL(req.url, 'http://x').searchParams, uid = q.get('uid'), nm = q.get('name'); if (!okUid(uid) || !okName(nm)) return J(res, h, 400, { error: 'bad name' });
        const f = path.join(HD, uid, nm); if (!fs.existsSync(f)) return J(res, h, 404, { error: 'not found' });
        const buf = fs.readFileSync(f); res.writeHead(200, { ...h, 'content-type': MT[nm.split('.').pop().toLowerCase()] || 'application/octet-stream', 'content-length': buf.length, 'cache-control': 'public, max-age=3600' }); return res.end(buf);
      }
      if (u === '/host/del' && req.method === 'POST') {
        const b = JSON.parse((await body(req)).toString() || '{}'); if (!okUid(b.uid) || !okName(b.name)) return J(res, h, 400, { error: 'bad name' });
        try { fs.unlinkSync(path.join(HD, b.uid, b.name)); } catch {} return J(res, h, 200, { ok: true });
      }
      if (u === '/host/stats') { let n = 0, bytes = 0; try { for (const d of fs.readdirSync(HD)) for (const f of fs.readdirSync(path.join(HD, d))) { n++; bytes += fs.statSync(path.join(HD, d, f)).size; } } catch {} return J(res, h, 200, { files: n, bytes }); }
    } catch (e) { return J(res, h, 500, { error: 'host error: ' + e.message }); }
    return J(res, h, 404, { error: 'unknown host endpoint' });
  }
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
      const qs = new URL(req.url, 'http://x').searchParams, what = (qs.get('what') || 'overview').replace(/[^a-z_]/g, '');
      const extra = ['email', 'id', 'kind', 'status', 'f'].filter((k) => qs.get(k) != null).map((k) => '&' + k + '=' + encodeURIComponent(qs.get(k))).join('');
      const post = req.method === 'POST', bd = post ? await body(req) : null;
      const r = await fetch(W.replace(/\/+$/, '') + '/api/node/admin?what=' + what + extra, { method: post ? 'POST' : 'GET', headers: { 'x-node-secret': NS, 'x-admin-actor': ACTOR + (ROLE === 'owner' ? '' : ' (' + ROLE + ')'), 'content-type': 'application/json' }, body: post ? bd : undefined });
      return J(res, h, r.status, await r.json().catch(() => ({ error: 'bad response' })));
    }
    if (u === '/admin/update' && req.method === 'POST') { PANEL.at = 0; await checkUpdate(); return J(res, h, 200, { version: VERSION, ...UPDST }); }
    if (u === '/admin/history') return J(res, h, 200, { points: HIST });
    if (u === '/admin/analytics') return J(res, h, 200, analytics());
    if (u === '/admin/system') {
      const sh = (c) => { try { return require('child_process').execSync(c, { timeout: 4000, encoding: 'utf8' }).trim(); } catch { return ''; } };
      const df = sh("df -k / | tail -1").split(/\s+/), du = (p) => { try { return fs.statSync(p).size; } catch { return 0; } };
      const procs = sh("ps -Ao pid,pcpu,pmem,comm").split('\n').slice(1).map((l) => l.trim().split(/\s+/)).filter((a) => a.length >= 4).map((a) => ({ pid: a[0], cpu: a[1], mem: a[2], name: (a.slice(3).join(' ') || '').split('/').pop() })).sort((x, y) => y.cpu - x.cpu).slice(0, 8);
      let tun = ''; try { tun = (fs.readFileSync(path.join(__dirname, 'tunnel.log'), 'utf8').match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g) || []).pop() || ''; } catch {}
      const nm = process.memoryUsage();
      return J(res, h, 200, { platform: os.platform() + ' ' + os.release(), arch: os.arch(), host: os.hostname(), node: process.version, pid: process.pid, load: os.loadavg(), cores: os.cpus().length, mem: { total: os.totalmem(), free: os.freemem() }, disk: { total: +df[1] * 1024 || 0, used: +df[2] * 1024 || 0, free: +df[3] * 1024 || 0 }, nodeMem: { rss: nm.rss, heap: nm.heapUsed }, procs, tunnel: tun, tunnelTail: (() => { try { return fs.readFileSync(path.join(__dirname, 'tunnel.log'), 'utf8').trim().split('\n').slice(-4).join('\n').slice(-400); } catch { return ''; } })(), files: { requestsLog: du(LOGFILE), tunnelLog: du(path.join(__dirname, 'tunnel.log')) }, env: { worker: !!process.env.AIX_WORKER, secret: !!process.env.AIX_NODE_SECRET, publicUrl: (() => { try { return fs.readFileSync(path.join(__dirname, '.aix-public-url'), 'utf8').trim(); } catch { return process.env.AIX_PUBLIC_URL || ''; } })(), model: process.env.MODEL || '', logPrompts: LOGTEXT }, registered: REGOK, lastRegister: LASTREG, errors: LOG.filter((e) => e.status >= 400).slice(0, 10).map((e) => ({ t: e.t, status: e.status, path: e.path, model: e.model })) });
    }
    if (u === '/admin/backups') return J(res, h, 200, { dir: BKDIR, files: bkList(), last: LASTBK, auto: 'every 24 hours' });
    if (u === '/admin/backups/now' && req.method === 'POST') { const r = await runBackup('manual'); return J(res, h, r.ok ? 200 : 502, r); }
    if (u === '/admin/backups/get') { const f = path.basename(new URL(req.url, 'http://x').searchParams.get('f') || ''); const fp = path.join(BKDIR, f); if (!f || !fs.existsSync(fp)) return J(res, h, 404, { error: 'no such file' }); res.writeHead(200, { ...h, 'content-type': 'application/gzip', 'content-disposition': 'attachment; filename="' + f + '"' }); return res.end(fs.readFileSync(fp)); }
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
  const W = process.env.AIX_WORKER, NS = process.env.AIX_NODE_SECRET, MODEL = process.env.MODEL || '';
  const PUF = path.join(__dirname, '.aix-public-url'), getPU = () => { try { return fs.readFileSync(PUF, 'utf8').trim(); } catch { return process.env.AIX_PUBLIC_URL || ''; } };
  if (W && NS && MODEL) {
    const reg = async () => { const PU = getPU(); if (!PU) return; try { const r = await fetch(W.replace(/\/+$/, '') + '/api/node/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-node-secret': NS }, body: JSON.stringify({ url: PU, token: TOKEN, model: MODEL }) }); REGOK = r.ok; LASTREG = Date.now(); if (!reg.ok) { reg.ok = r.ok; console.log(r.ok ? 'Registered with AIX cloud: apps will use this node automatically' : 'Register failed: HTTP ' + r.status); } } catch (e) { console.log('Register error: ' + e.message); reg.ok = false; } };
    reg(); setInterval(reg, 60000);
  } else console.log('Cloud registration off (needs AIX_WORKER, AIX_NODE_SECRET, MODEL)');
});
