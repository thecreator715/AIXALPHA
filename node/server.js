// AIX Alpha Node v2 — Ollama proxy + monitor dashboard. Node 18+, no dependencies.
const http = require('http'), os = require('os'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const VERSION = 20;   // bump on every release: nodes auto-update when GitHub has a higher number
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

// ---- live web search for node-only Alpha (runs from this Mac's own connection) ----
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const clean = (t) => String(t || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
async function getText(url, opt, ms) { const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(ms || 8000), headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', ...((opt || {}).headers || {}) } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }
async function searchDDG(q) {
  const html = await getText('https://html.duckduckgo.com/html/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'q=' + encodeURIComponent(q) });
  const out = [], parts = html.split(/class="result__a"/).slice(1);
  for (const seg of parts) {
    if (out.length >= 8) break;
    const hm = /href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(seg); if (!hm) continue;
    let u = hm[1].replace(/&amp;/g, '&'); const g = /[?&]uddg=([^&]+)/.exec(u); if (g) u = decodeURIComponent(g[1]); if (u.startsWith('//')) u = 'https:' + u;
    if (!/^https?:/.test(u) || /duckduckgo\.com\/y\.js/.test(u)) continue;
    const sm = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/.exec(seg);
    out.push({ title: clean(hm[2]), url: u, snippet: sm ? clean(sm[1]) : '' });
  }
  return out;
}
async function searchMojeek(q) {
  const html = await getText('https://www.mojeek.com/search?q=' + encodeURIComponent(q));
  const out = [], re = /<li[^>]*>\s*<a[^>]+class="ob"[^>]+href="([^"]+)"[\s\S]*?<a[^>]+class="title"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p class="s">([\s\S]*?)<\/p>/g; let m;
  while ((m = re.exec(html)) && out.length < 8) out.push({ title: clean(m[2]), url: m[1].replace(/&amp;/g, '&'), snippet: clean(m[3]) });
  return out;
}
const xml = (t, tag) => { const m = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>').exec(t); return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') : ''; };
async function searchRSS(url, n) {
  const t = await getText(url, { headers: { accept: 'application/rss+xml,text/xml,*/*' } }), out = [];
  for (const it of t.split(/<item>/).slice(1)) { if (out.length >= 8) break; const u = clean(xml(it, 'link')); if (/^https?:/.test(u)) out.push({ title: clean(xml(it, 'title')), url: u, snippet: clean(xml(it, 'description')).slice(0, 300) }); }
  return out;
}
const searchBing = (q) => searchRSS('https://www.bing.com/search?format=rss&q=' + encodeURIComponent(q));
const searchNews = (q) => searchRSS('https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=' + encodeURIComponent(q));
async function webSearch(q) {
  let res = [], via = '', errs = [];
  const fresh = /\b(news|today|latest|current|now|score|price|weather|recent|this week|tonight|yesterday|202\d)\b/i.test(q);
  const engines = [['bing', searchBing], ['duckduckgo', searchDDG], ['mojeek', searchMojeek], ['google-news', searchNews]];
  if (fresh) engines.splice(1, 0, engines.pop());
  for (const [n, f] of engines) { try { res = await f(q); if (res.length) { via = n; break; } errs.push(n + ': no results'); } catch (e) { errs.push(n + ': ' + e.message); } }
  const top = res.slice(0, 2);   // read the top two pages for real detail
  await Promise.all(top.map(async (r) => { try { const t = await getText(r.url, {}, 6000); r.page = clean(t.replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')).slice(0, 2500); } catch (e) { /* snippet only */ } }));
  if (!res.length) console.log('web search found nothing for', JSON.stringify(q), errs.join(' | '));
  return { query: q, via, errors: res.length ? undefined : errs, results: res.slice(0, 6) };
}
async function body(req) { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c); }
async function oll(p, opt) { const r = await fetch(OLLAMA + p, opt); return r; }

let VIS_C = { t: 0, m: '' }, VIS_PULL = 0;
async function visionModel() {   // the vision model to use for images: env override, else any installed vision-capable model; pulls one in the background if none exists
  if (process.env.VISION_MODEL) return process.env.VISION_MODEL;
  if (Date.now() - VIS_C.t < 60000) return VIS_C.m;
  let m = '';
  try { const r = await oll('/api/tags'), j = await r.json(), names = (j.models || []).map((x) => x.name); m = names.find((n) => /aix-alpha-vision/.test(n)) || names.find((n) => /(vl|vision|llava|minicpm-v|gemma3|moondream|bakllava|llama3\.2-vision)/i.test(n)) || ''; } catch {}
  VIS_C = { t: Date.now(), m };
  if (!m && !VIS_PULL) { VIS_PULL = Date.now(); oll('/api/pull', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'qwen2.5vl:7b', stream: false }) }).then(() => { VIS_C.t = 0; }).catch(() => { VIS_PULL = 0; }); }
  return m;
}
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

// ---- admin sign-in security: optional authenticator-app code (TOTP) + revocable sessions ----
const TOTPF = path.join(__dirname, '.aix-totp'), SESSF = path.join(__dirname, '.aix-sessions.json');
const b32 = (buf) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '', o = ''; for (const x of buf) bits += x.toString(2).padStart(8, '0'); for (let i = 0; i + 5 <= bits.length; i += 5) o += A[parseInt(bits.slice(i, i + 5), 2)]; return o; };
const unb32 = (s) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; for (const c of s.replace(/=+$/, '').toUpperCase()) { const v = A.indexOf(c); if (v >= 0) bits += v.toString(2).padStart(5, '0'); } const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
const totpAt = (sec, t) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(t / 30000))); const h = crypto.createHmac('sha1', unb32(sec)).update(c).digest(), o = h[19] & 15, n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]; return String(n % 1000000).padStart(6, '0'); };
const totpOk = (sec, code) => { code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return false; const now = Date.now(); return [-30000, 0, 30000].some((d) => totpAt(sec, now + d) === code); };
const totpSecret = () => { try { return fs.readFileSync(TOTPF, 'utf8').trim(); } catch { return ''; } };
let SESS = (() => { try { return JSON.parse(fs.readFileSync(SESSF, 'utf8')); } catch { return {}; } })();
const sessSave = () => { try { const now = Date.now(); for (const k of Object.keys(SESS)) if (SESS[k].exp < now) delete SESS[k]; fs.writeFileSync(SESSF, JSON.stringify(SESS)); } catch {} };
const sessKey = (t) => crypto.createHash('sha256').update(t).digest('hex');
const sessGet = (t) => { const s = t && t.startsWith('s_') && SESS[sessKey(t)]; if (s && s.exp > Date.now()) return s; return null; };
let TOTP_FAIL = { n: 0, until: 0 };
// ---- secure tunnel: the node starts and supervises cloudflared itself, so ONE process brings the whole Mac online ----
const cp = require('child_process'); let TUN = null, TUN_STOP = false;
function startTunnel(PUF, onUrl) {
  if (process.env.AIX_NO_TUNNEL === '1' || TUN_STOP) return;
  const bin = path.join(__dirname, 'runtime', 'cloudflared'); if (!fs.existsSync(bin)) { console.log('Tunnel off: runtime/cloudflared is missing (run Start AIX Node.command once to download it)'); return; }
  const cfg = path.join(__dirname, 'runtime', 'empty.yml'), logf = path.join(__dirname, 'tunnel.log');
  try { fs.writeFileSync(cfg, '# intentionally empty: quick tunnel only\n'); fs.writeFileSync(logf, ''); fs.unlinkSync(PUF); } catch {}
  try { cp.spawnSync('pkill', ['-f', 'runtime/empty.yml']); } catch {}
  let found = false;
  const p = cp.spawn(bin, ['tunnel', '--config', cfg, '--no-autoupdate', '--url', 'http://localhost:' + PORT], { stdio: ['ignore', 'pipe', 'pipe'] });
  TUN = p;
  const onData = (d) => { const t = String(d); try { fs.appendFileSync(logf, t); } catch {} const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(t); if (m && !found) { found = true; try { fs.writeFileSync(PUF, m[0]); } catch {} console.log('Secure tunnel up: ' + m[0]); try { onUrl(); } catch {} } };
  p.stdout.on('data', onData); p.stderr.on('data', onData);
  p.on('error', (e) => { console.log('Tunnel error: ' + e.message); });
  p.on('exit', () => { if (TUN === p) TUN = null; if (!TUN_STOP) setTimeout(() => startTunnel(PUF, onUrl), 5000); });
  setTimeout(() => { if (!found && TUN === p) { console.log('Tunnel gave no address in 60 s; retrying'); try { p.kill(); } catch {} } }, 60000);
}
const stopTunnel = () => { TUN_STOP = true; try { TUN && TUN.kill(); } catch {} };
process.on('exit', stopTunnel); process.on('SIGTERM', () => process.exit(0)); process.on('SIGINT', () => process.exit(0));
let LISTEN_TRY = 0;
const SRV = http.createServer(async (req, res) => {
  const h = cors(req), u = req.url.split('?')[0];
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  if (u === '/' || u === '/monitor' || u === '/monitor.html') { try { const f = await panelHtml(); res.writeHead(200, { ...h, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(f); } catch { res.writeHead(404, h); return res.end('monitor.html missing'); } }
  if (u === '/health') return J(res, h, 200, { status: 'ok', engine: 'aix-node', build: 3, version: VERSION, update: UPDST });
  const localAdmin = u.startsWith('/admin') && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || '') && !req.headers['x-forwarded-for'] && !req.headers['cf-connecting-ip'] && (!req.headers.origin || req.headers.origin === 'http://' + req.headers.host);
  // ---- co-admin roles: owner (node token / this Mac) can mint limited tokens in admins.json ----
  const AF = path.join(__dirname, 'admins.json'), loadTeam = () => { try { return JSON.parse(fs.readFileSync(AF, 'utf8')); } catch { return {}; } };
  const ROLE_OK = {
    support: ['overview', 'users', 'user360', 'user_note', 'tickets', 'ticket', 'ticket_reply', 'ticket_status', 'moderation', 'mod_decide', 'alerts', 'alert_ack', 'referrals', 'promos'],
    manager: ['*', '!config_set', '!restore', '!grant', '!export', '!backup_now', '!backup_get', '!backups', '!storage', '!export_all', '!restore_test', '!approval_cfg', '!host_restart'],
  };
  let ACTOR = 'owner', ROLE = 'owner';
  const bearer = (req.headers.authorization || '').replace(/^Bearer /, ''), SE = sessGet(bearer), TS = totpSecret();
  if (u === '/restart' && req.method === 'POST') {   // remote restart from the cloud (the start script's watchdog relaunches the node)
    const ns = process.env.AIX_NODE_SECRET; if (!ns || req.headers['x-node-secret'] !== ns) return J(res, h, 401, { error: 'bad secret' });
    J(res, h, 200, { ok: true, restarting: true }); setTimeout(() => process.exit(0), 600); return;
  }
  if (u.startsWith('/admin/2fa') || u === '/admin/sessions') {
    if (!localAdmin && bearer !== TOKEN && !SE) return J(res, h, 401, { error: 'bad token' });
    const bd = req.method === 'POST' ? JSON.parse((await body(req)).toString() || '{}') : {};
    if (u === '/admin/2fa/login') {
      if (!TS) return J(res, h, 400, { error: 'Two-step sign-in is not turned on.' });
      if (Date.now() < TOTP_FAIL.until) return J(res, h, 429, { error: 'Too many wrong codes. Wait a minute.' });
      if (!totpOk(TS, bd.code)) { if (++TOTP_FAIL.n >= 5) { TOTP_FAIL = { n: 0, until: Date.now() + 60000 }; } return J(res, h, 401, { error: 'That code is not right.' }); }
      TOTP_FAIL.n = 0; const t = 's_' + crypto.randomBytes(24).toString('hex'); SESS[sessKey(t)] = { at: Date.now(), exp: Date.now() + 12 * 3600e3, ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').slice(0, 45), ua: String(req.headers['user-agent'] || '').slice(0, 80) }; sessSave();
      return J(res, h, 200, { session: t, hours: 12 });
    }
    if (u === '/admin/2fa/status') return J(res, h, 200, { enabled: !!TS, sessions: Object.keys(SESS).filter((k) => SESS[k].exp > Date.now()).length });
    if (u === '/admin/2fa/setup') { const sec = b32(crypto.randomBytes(20)); global.__PENDING2FA = sec; return J(res, h, 200, { secret: sec, uri: 'otpauth://totp/AIX%20Alpha%20Admin?secret=' + sec + '&issuer=AIX%20Alpha' }); }
    if (u === '/admin/2fa/confirm') { const sec = global.__PENDING2FA; if (!sec || !totpOk(sec, bd.code)) return J(res, h, 400, { error: 'That code did not match. Add the key to your authenticator app and try again.' }); fs.writeFileSync(TOTPF, sec, { mode: 0o600 }); global.__PENDING2FA = null; SESS = {}; sessSave(); return J(res, h, 200, { ok: true, note: 'Two-step sign-in is on. All other sessions were signed out.' }); }
    if (u === '/admin/2fa/disable') { if (TS && !totpOk(TS, bd.code)) return J(res, h, 400, { error: 'Enter a current code to turn it off.' }); try { fs.unlinkSync(TOTPF); } catch {} return J(res, h, 200, { ok: true }); }
    if (u === '/admin/sessions') {
      if (req.method === 'POST') { if (bd.all) SESS = {}; else if (bd.id) { for (const k of Object.keys(SESS)) if (k.startsWith(String(bd.id))) delete SESS[k]; } sessSave(); return J(res, h, 200, { ok: true }); }
      return J(res, h, 200, { sessions: Object.entries(SESS).filter(([, s]) => s.exp > Date.now()).map(([k, s]) => ({ id: k.slice(0, 12), at: s.at, exp: s.exp, ip: s.ip, ua: s.ua, current: !!bearer && k === sessKey(bearer) })), enabled: !!TS });
    }
    return J(res, h, 404, { error: 'unknown' });
  }
  if (!localAdmin && bearer === TOKEN && TS && u.startsWith('/admin')) return J(res, h, 401, { error: 'Enter your authenticator code to continue.', need2fa: true });
  if (!localAdmin && bearer !== TOKEN && !SE) {
    const tm = loadTeam(), mem = bearer && tm[bearer];
    if (!mem || !u.startsWith('/admin')) return J(res, h, 401, { error: 'bad token' });
    ACTOR = mem.name; ROLE = mem.role;
    const wh = (new URL(req.url, 'http://x').searchParams.get('what') || 'overview').replace(/[^a-z_0-9]/g, '');
    if (u === '/admin/cloud') {
      const al = ROLE_OK[ROLE] || [], ok = al.includes('*') ? !al.includes('!' + wh) : al.includes(wh);
      if (!ok) return J(res, h, 403, { error: 'Your role (' + ROLE + ') cannot use "' + wh + '".' });
    } else if (u !== '/admin/me' && u !== '/admin/status') return J(res, h, 403, { error: 'Your role (' + ROLE + ') cannot use this.' });
  }
  if (u === '/search' && req.method === 'GET') {
    const q = String(new URL(req.url, 'http://x').searchParams.get('q') || '').slice(0, 200).trim();
    if (q.length < 2) return J(res, h, 400, { error: 'q required' });
    try { return J(res, h, 200, await webSearch(q)); } catch (e) { return J(res, h, 502, { error: 'search failed: ' + e.message }); }
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
      const extra = [...qs.keys()].filter((k) => k !== 'what' && /^[a-zA-Z_]{1,20}$/.test(k)).map((k) => '&' + k + '=' + encodeURIComponent(qs.get(k))).join('');
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
      const t0 = Date.now(); let buf = req.method === 'GET' ? undefined : await body(req); let model = '', pj = null; try { pj = JSON.parse(buf.toString()); model = pj.model || ''; const hasImg = pj.messages && pj.messages.some((m) => Array.isArray(m.content) && m.content.some((c) => c && c.type === 'image_url')); if (hasImg) { const vm = await visionModel(); if (vm) { pj.model = model = vm; } else { pj.messages = pj.messages.map((m) => (Array.isArray(m.content) ? { ...m, content: m.content.filter((c) => !(c && c.type === 'image_url')).map((c) => (c.type === 'text' ? c.text : '')).join('\n') + '\n\n(Note for the assistant: the user attached an image but the vision model is still being installed on this host. Tell them in one short sentence that image reading will be ready in a few minutes and to try again, then answer any text part of the question.)' } : m)); } buf = Buffer.from(JSON.stringify(pj)); } } catch (e) { console.log('vision route error', e && e.message); }
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
}).on('error', (e) => {   // an old node may still be shutting down: wait for the port instead of crashing
  if (e && e.code === 'EADDRINUSE' && LISTEN_TRY < 40) { LISTEN_TRY++; if (LISTEN_TRY === 1) console.log(`Port ${PORT} is busy (an older AIX node is still closing). Waiting for it...`); setTimeout(() => { try { SRV.listen(PORT); } catch {} }, 1500); return; }
  console.error('AIX node could not start:', e && e.message); process.exit(1);
}).listen(PORT, () => {
  console.log(`AIX node v2 on :${PORT} -> ${OLLAMA}   dashboard: http://localhost:${PORT}/`);
  const W = process.env.AIX_WORKER, NS = process.env.AIX_NODE_SECRET, MODEL = process.env.MODEL || '';
  const PUF = path.join(__dirname, '.aix-public-url'), getPU = () => { try { return fs.readFileSync(PUF, 'utf8').trim(); } catch { return process.env.AIX_PUBLIC_URL || ''; } };
  let REGNOW = () => {};
  { const warm = () => { const mm = process.env.MODEL; if (mm) oll('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: mm, prompt: '', keep_alive: '30m' }) }).catch(() => {}); }; setTimeout(warm, 3000); setInterval(warm, 20 * 60000); }   // keep the main model loaded so the first reply is not slow
  startTunnel(PUF, () => REGNOW());
  if (W && NS && MODEL) {
    const NODEID = () => { const f = path.join(__dirname, '.aix-node-id'); try { return fs.readFileSync(f, 'utf8').trim() || 'main'; } catch { const id = (os.hostname().replace(/[^\w]/g, '').slice(0, 12) || 'host') + '-' + crypto.randomBytes(3).toString('hex'); try { fs.writeFileSync(f, id); } catch {} return id; } };
    const NODEPRIO = () => { try { return Math.max(1, Math.min(9, parseInt(fs.readFileSync(path.join(__dirname, '.aix-priority'), 'utf8')) || +process.env.NODE_PRIO || 1)); } catch { return Math.max(1, Math.min(9, +process.env.NODE_PRIO || 1)); } };
    const readTiers = () => { try { const t = JSON.parse(fs.readFileSync(path.join(__dirname, '.aix-models'), 'utf8')); const o = {}; for (const k of ['eco', 'balanced', 'thorough']) if (t[k]) o[k] = String(t[k]); return o; } catch { return {}; } };
    const reg = async () => { const PU = getPU(); if (!PU) return; try { const r = await fetch(W.replace(/\/+$/, '') + '/api/node/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-node-secret': NS }, body: JSON.stringify({ url: PU, token: TOKEN, model: MODEL, models: readTiers(), id: NODEID(), prio: NODEPRIO(), name: os.hostname().slice(0, 30) }) }); REGOK = r.ok; LASTREG = Date.now(); if (!reg.ok) { reg.ok = r.ok; console.log(r.ok ? 'Registered with AIX cloud: apps will use this node automatically' : 'Register failed: HTTP ' + r.status); } } catch (e) { console.log('Register error: ' + e.message); reg.ok = false; } };
    REGNOW = reg; reg(); setInterval(reg, 60000);
  } else console.log('Cloud registration off (needs AIX_WORKER, AIX_NODE_SECRET, MODEL)');
});
