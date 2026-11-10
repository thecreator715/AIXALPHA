// AIX Alpha Node v2 — Ollama proxy + monitor dashboard. Node 18+, no dependencies.
const http = require('http'), os = require('os'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const VERSION = 39;   // bump on every release: nodes auto-update when GitHub has a higher number
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
const _STOPW = new Set('the and for with that this from into about what are you can could would please explain tell show give list compare comparison comparisons detail details between versus how why when who which does did have has was were will its their them then than also use using models model llm'.split(' '));
function cleanQ(q) {
  q = String(q || '').replace(/\s+/g, ' ').trim();
  let c = q.replace(/^(?:(?:hey|hi|please|ok|okay|so)[, ]+)?(?:can|could|would|will) (?:you|u) (?:please )?/i, '').replace(/^(?:please )?(?:explain|tell me|show me|give me|list|describe|compare|summari[sz]e|what(?:'s| is| are)|who(?:'s| is)|how (?:do|does|is|are))\b ?(?:me )?(?:about |the |a |an )?/i, '').replace(/\b(?:in|as|with) (?:a )?(?:list )?(?:table|bullet(?:s| points)?|comparisons?|detail|simple terms)\b/ig, '').replace(/\b(?:in|as|with) (?:a )?list\b/ig, '').replace(/\b(?:for me|please|thanks|thank you)\b/ig, '').replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  if (c.length < 4) c = q;
  if (/\bqwen\b/i.test(c) && !/alibaba/i.test(c)) c += ' Alibaba Qwen LLM';
  return c.slice(0, 180);
}
function planQ(q) {
  const c = cleanQ(q), out = [c], br = /\b(qwen|llama|gemma|mistral|deepseek|phi|gemini|gpt|claude|grok)\b/i.exec(c);
  if (br) { const nums = [...new Set(c.match(/\b\d+(?:\.\d+)?\b/g) || [])].slice(0, 3); for (const n of nums) out.push(br[1] + ' ' + n + ' model release features'); }
  return out.slice(0, 4);
}
function relevantTo(r, q) {
  const toks = (String(q).toLowerCase().match(/[a-z0-9.]{3,}/g) || []).filter((t) => !_STOPW.has(t));
  if (!toks.length) return true;
  const txt = ((r.title || '') + ' ' + (r.snippet || '')).toLowerCase(), hits = toks.filter((t) => txt.includes(t)).length;
  return hits >= 2 || hits / toks.length >= 0.4;
}
async function multiSearch(q, one) {   // one(query) -> {via,errors,results}; runs the planned queries, drops irrelevant hits, merges
  const plan = planQ(q), seen = new Set(), results = []; let via = '', errors = [];
  const outs = await Promise.all(plan.map((p) => one(p).then((r) => ({ p, r })).catch((e) => ({ p, r: { errors: [String(e && e.message || e)], results: [] } }))));
  for (const { p, r } of outs) { if (r.via && !via.includes(r.via)) via = via ? via + '+' + r.via : r.via; if (r.errors) errors = errors.concat(r.errors); for (const x of r.results || []) { if (!x.url || seen.has(x.url) || !relevantTo(x, p)) continue; seen.add(x.url); results.push(x); } }
  return { query: plan[0], via, errors: results.length ? undefined : errors.concat(['no relevant results']), results: results.slice(0, 7) };
}
async function webSearch(q) { return multiSearch(q, webSearch1); }
async function webSearch1(q) {
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
const thinkOn = () => { try { return fs.readFileSync(path.join(__dirname, '.aix-think'), 'utf8').trim() === '1'; } catch { return process.env.AIX_THINK === '1'; } };
async function oll(p, opt) { const r = await fetch(OLLAMA + p, opt); return r; }

let VIS_C = { t: 0, m: '' }, VIS_PULL = 0;
async function visionModel() {   // the vision model to use for images: env override, else any installed vision-capable model; pulls one in the background if none exists
  if (process.env.VISION_MODEL) return process.env.VISION_MODEL;
  if (Date.now() - VIS_C.t < 60000) return VIS_C.m;
  let m = '';
  try { const r = await oll('/api/tags'), j = await r.json(), names = (j.models || []).map((x) => x.name); m = names.find((n) => /aix-alpha-vision/.test(n)) || names.find((n) => /(vl|vision|llava|minicpm-v|gemma3|moondream|bakllava|llama3\.2-vision)/i.test(n)) || ''; } catch {}
  VIS_C = { t: Date.now(), m };
  if (!m && !VIS_PULL) { VIS_PULL = Date.now(); oll('/api/pull', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'qwen3-vl:8b', stream: false }) }).then(() => { VIS_C.t = 0; }).catch(() => { VIS_PULL = 0; }); }
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
    for (const f of ['Start AIX Node.command', 'AIX MASTER.command', 'Update Qwen.command', 'Install AutoStart.command', 'Install Qwen Image.command', 'Install Local Video.command']) {   // launchers refresh too (rename keeps a running script safe)
      try { const t = await getRemote(f.replace(/ /g, '%20'), 8000); if (t.startsWith('#!/bin/bash') && t.length > 400) { const fp = path.join(__dirname, f); fs.writeFileSync(fp + '.new', t, { mode: 0o755 }); fs.renameSync(fp + '.new', fp); } } catch {}
    }
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

// ---- Qwen-Image 2.1 on Apple Silicon via mflux (installed by the launcher; falls back to cloud FLUX when absent) ----
const IMGDIR = path.join(__dirname, 'runtime', 'img'); try { fs.mkdirSync(IMGDIR, { recursive: true }); } catch {}
const imgCfg = () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '.aix-image'), 'utf8')); } catch { return null; } };   // {cmd, args:[...], steps, stepsHq}
const imgReady = () => { const c = imgCfg(); return !!(c && c.cmd && c.ok !== false); };
// the image and video engines need most of the Mac's memory: unload the chat model first (it reloads on the next chat), unless AIX_UNLOAD=0
async function unloadLLM() {
  if (process.env.AIX_UNLOAD === '0') return;
  try { const ps = await (await fetch(OLLAMA + '/api/ps', { signal: AbortSignal.timeout(4000) })).json(); for (const m of ps.models || []) await fetch(OLLAMA + '/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: m.name, keep_alive: 0 }), signal: AbortSignal.timeout(8000) }).catch(() => {}); } catch {}
}
let IMGBUSY = Promise.resolve(), IMGQ = 0;
const vidCfg = () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '.aix-video'), 'utf8')); } catch { return null; } };   // {cmd,args:[...],ok}
const vidReady = () => { const c = vidCfg(); return !!(c && c.cmd && c.ok !== false); };
let VIDQ = 0;
// ---- video render progress: parses the engine output, learns timings from past renders, streams snapshots to the app ----
const VSTATS = path.join(__dirname, '.aix-vidstats.json');
const vstats = () => { try { return JSON.parse(fs.readFileSync(VSTATS, 'utf8')); } catch { return []; } };
const VIDJOBS = [];
const VSTAGES = [['Waiting in line', 0, 0], ['Loading the model', 2, 10], ['Reading your prompt', 12, 3], ['Stage 1 · drawing the clip', 15, 40], ['Stage 2 · refining detail', 55, 28], ['Decoding frames', 83, 8], ['Making the sound', 91, 5], ['Writing the video', 96, 2], ['Sharpening + upscaling to 1080p', 98, 1]];
function vidJob(w, hgt, sec, q, up) {
  sec = Math.max(2, Math.min(60, Math.round(+sec || 2))); const c = vidCfg() || {}, fps = c.fps || 24;
  return { created: Date.now(), runStart: 0, stage: VSTAGES[0][0], stageIdx: 0, parsed: null, pctMax: 0, step: null, steps: null, sec, w, h: hgt, q: q || 'fast', up: !!up, fps, frames: sec > 2 ? Math.round(sec * fps / 8) * 8 + 1 : (c.nframes || 49), done: false };
}
function vidExpect(j) {
  const rec = vstats().filter((r) => r.q === j.q && r.px && r.frames && r.secs).slice(-3);
  if (rec.length) { const v = rec.map((r) => r.secs * (j.w * j.h * j.frames) / (r.px * r.frames)).sort((a, b) => a - b); return { secs: v[Math.floor(v.length / 2)], est: false }; }
  const rate = 4.7e-6 * ({ fast: 1, hq: 3, best: 4 }[j.q] || 1);
  return { secs: 120 + rate * j.w * j.h * j.frames, est: true };
}
function vidSnap(j) {
  const now = Date.now(), el = j.runStart ? (now - j.runStart) / 1000 : 0, ex = vidExpect(j);
  let pct = j.parsed != null ? j.parsed : (j.runStart ? Math.min(95, el / ex.secs * 100) : 0);
  j.pctMax = Math.max(j.pctMax || 0, Math.min(99, pct)); pct = j.pctMax;
  let eta = null;
  if (j.runStart) { const byTime = Math.max(0, ex.secs - el); if (j.parsed != null && pct >= 12) { const byPct = el * (100 - pct) / pct; eta = ex.est ? byPct : 0.6 * byPct + 0.4 * byTime; } else eta = el < ex.secs ? byTime : null; }
  const ahead = j.runStart ? 0 : Math.max(0, VIDJOBS.indexOf(j));
  return { stage: j.runStart ? j.stage : (ahead ? 'Waiting in line (' + ahead + ' ahead)' : 'Starting'), pct: Math.round(pct * 10) / 10, elapsed: Math.round((now - j.created) / 1000), run: Math.round(el), eta: eta == null ? null : Math.round(eta), etaEst: ex.est, step: j.step, steps: j.steps, sec: j.sec, w: j.w, h: j.h, frames: j.frames, fps: j.fps, q: j.q, up: j.up, memFreeGb: +(os.freemem() / 1e9).toFixed(1), ahead };
}
function vidStage(j, idx) { if (idx > j.stageIdx) { j.stageIdx = idx; j.stage = VSTAGES[idx][0]; j.step = j.steps = null; j.parsed = Math.max(j.parsed || 0, VSTAGES[idx][1]); } }
function vidFeed(j, chunk) {
  for (const raw of String(chunk).split(/[\r\n]+/)) {
    const t = raw.toLowerCase(); if (!t.trim()) continue;
    const rules = [[7, /(mux|ffmpeg|writing video|saving video|export|encoding video)/], [6, /(audio|vocoder|sound)/], [5, /(decod|\bvae\b)/], [4, /(stage ?2|second stage|refin|upsampl|upscal|distilled lora)/], [3, /(stage ?1|first stage|low.?res|half.?res|denois|sampler|sampling)/], [2, /(embedding|encoding (the )?(text|prompt)|prompt enc)/], [1, /(download|fetching|loading|load(ed)? (the )?(model|weights|checkpoint)|safetensors|text.?encoder)/]];
    for (const [i, re] of rules) if (i > j.stageIdx && re.test(t)) { vidStage(j, i); break; }
    let frac = null, m;
    if ((m = /(\d{1,3})%\|/.exec(t))) frac = Math.min(1, +m[1] / 100);
    const nm = /\b(\d+)\s*\/\s*(\d+)\s*\[/.exec(t) || /\bstep\s+(\d+)\s*(?:\/|of)\s*(\d+)/.exec(t);
    if (nm && +nm[2] >= 2 && +nm[2] <= 5000 && +nm[1] <= +nm[2]) { frac = +nm[1] / +nm[2]; if (j.stageIdx !== 1 || !/(fetch|download|file)/.test(t)) { j.step = +nm[1]; j.steps = +nm[2]; } }
    if (frac != null) { if (j.stageIdx === 0) vidStage(j, /(fetch|download|file)/.test(t) ? 1 : 3); else if (j.stageIdx < 3 && !/(fetch|download|file|load)/.test(t)) vidStage(j, 3); const [, base, width] = VSTAGES[j.stageIdx]; j.parsed = Math.max(j.parsed || 0, base + width * frac); }
  }
}
function vidRec(j) {
  try { const secs = (Date.now() - j.runStart) / 1000, a = vstats(); a.push({ q: j.q, px: j.w * j.h, frames: j.frames, secs: Math.round(secs) }); fs.writeFileSync(VSTATS, JSON.stringify(a.slice(-20)) + '\n'); } catch {}
}
// Local video with LTX-2.5 (MLX; 2.3 fallback). Text-to-video, or image-to-video when a start image is given.
function genVid(prompt, imgBuf, w, hgt, sec, up, q, job) {
  sec = Math.max(2, Math.min(60, Math.round(+sec || 2)));
  const c = vidCfg(); if (!c || !c.cmd) return Promise.reject(Object.assign(new Error('local video not installed'), { code: 501 }));
  if (VIDQ >= 2) return Promise.reject(Object.assign(new Error('video queue full'), { code: 429 }));
  VIDQ++; job = job || vidJob(w, hgt, sec, q, up); VIDJOBS.push(job);
  const run = async () => {
    job.runStart = Date.now(); job.stage = 'Freeing memory (unloading the chat model)'; await unloadLLM(); job.stage = 'Starting the engine';
    const id = Date.now() + crypto.randomBytes(3).toString('hex'), out = path.join(IMGDIR, 'v' + id + '.mp4'), inp = path.join(IMGDIR, 'v' + id + '.png');
    const F = Object.assign({ prompt: '-p', out: '-o', h: '-H', w: '-W', img: '--image', frames: null, fps: null }, c.flags || {});
    const MODE = (c.modes && c.modes[q]) || null;   // quality tiers: fast = distilled; hq / best use the dev model with guidance (slower, cleaner)
    const base = (c.args || []).map((x) => (MODE && x === '--distilled') ? MODE : x);
    let args = base.concat([F.prompt, prompt, F.out, out, F.h, String(hgt), F.w, String(w)]);
    const nfr = Math.round(sec * (c.fps || 24) / 8) * 8 + 1;   // frame counts must be 8n+1
    if (F.frames) args = args.concat([F.frames, String(sec > 2 ? nfr : (c.nframes || 49))]);
    if (F.fps && c.fps) args = args.concat([F.fps, String(c.fps)]);
    if (imgBuf && F.img) { fs.writeFileSync(inp, imgBuf); args = args.concat([F.img, inp]); }
    return await new Promise((resolve, reject) => {
      const cp = require('child_process').spawn(c.cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH: process.env.PATH + ':' + os.homedir() + '/.local/bin:/opt/homebrew/bin:/usr/local/bin' } });
      let err = ''; cp.stderr.on('data', (d) => { err = (err + d).slice(-1500); vidFeed(job, d); }); cp.stdout.on('data', (d) => vidFeed(job, d));
      const to = setTimeout(() => { try { cp.kill('SIGKILL'); } catch {} }, Math.min(14400000, (1500000 + sec * 240000) * (MODE ? (q === 'best' ? 4 : 3) : 1)));
      const clean = () => { try { fs.unlinkSync(inp); } catch {} try { fs.unlinkSync(out); } catch {} };
      cp.on('error', (e) => { clearTimeout(to); clean(); reject(e); });
      cp.on('close', (code) => { clearTimeout(to); try { const b = fs.readFileSync(out); clean(); if (b.length > 5000) { vidRec(job); if (!up) { clean(); return resolve(b); } const o2 = out + '.hd.mp4'; vidStage(job, 8); const ff = require('child_process').spawn('ffmpeg', ['-y', '-i', out, '-vf', 'scale=-2:1080:flags=lanczos,unsharp=5:5:0.9:3:3:0.4', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'copy', o2], { stdio: 'ignore', env: { ...process.env, PATH: process.env.PATH + ':/opt/homebrew/bin:/usr/local/bin' } }); ff.on('close', () => { let r = b; try { const hd = fs.readFileSync(o2); if (hd.length > 5000) r = hd; } catch {} try { fs.unlinkSync(o2); } catch {} clean(); resolve(r); }); ff.on('error', () => { clean(); resolve(b); }); return; } } catch {} clean(); reject(new Error('video run failed (' + code + '): ' + err.split('\n').slice(-3).join(' ').slice(0, 300))); });
    });
  };
  const p = IMGBUSY.then(run, run); IMGBUSY = p.catch(() => {}); return p.finally(() => { VIDQ--; job.done = true; const i = VIDJOBS.indexOf(job); if (i >= 0) VIDJOBS.splice(i, 1); });
}
function genImg(prompt, hq, w, hgt) {
  const c = imgCfg(); if (!c || !c.cmd) return Promise.reject(Object.assign(new Error('image model not installed'), { code: 501 }));
  if (IMGQ >= 3) return Promise.reject(Object.assign(new Error('image queue full'), { code: 429 }));
  IMGQ++;
  const run = async () => { await unloadLLM(); return new Promise((resolve, reject) => {
    const out = path.join(IMGDIR, 'i' + Date.now() + crypto.randomBytes(3).toString('hex') + '.png');
    const steps = String(hq ? (c.stepsHq || 30) : (c.steps || 16));
    const args = (c.args || []).concat(['--prompt', prompt, '--steps', steps, '--width', String(w), '--height', String(hgt), '--seed', String(Math.floor(Math.random() * 2e9)), '--output', out]);
    const cp = require('child_process').spawn(c.cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH: process.env.PATH + ':' + os.homedir() + '/.local/bin:/opt/homebrew/bin:/usr/local/bin' } });
    let err = ''; cp.stderr.on('data', (d) => { err = (err + d).slice(-1500); }); cp.stdout.on('data', () => {});
    const to = setTimeout(() => { try { cp.kill('SIGKILL'); } catch {} }, hq ? 600000 : 420000);
    cp.on('error', (e) => { clearTimeout(to); reject(e); });
    cp.on('close', (code) => { clearTimeout(to); try { const b = fs.readFileSync(out); fs.unlinkSync(out); if (b.length > 1000) return resolve(b); } catch {} reject(new Error('image run failed (' + code + '): ' + err.split('\n').slice(-3).join(' ').slice(0, 300))); });
  }); };
  const p = IMGBUSY.then(run, run); IMGBUSY = p.catch(() => {}); return p.finally(() => { IMGQ--; });
}
const SRV = http.createServer(async (req, res) => {
  const h = cors(req), u = req.url.split('?')[0];
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  if (u === '/' || u === '/monitor' || u === '/monitor.html') { try { const f = await panelHtml(); res.writeHead(200, { ...h, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(f); } catch { res.writeHead(404, h); return res.end('monitor.html missing'); } }
  if (u === '/health') return J(res, h, 200, { status: 'ok', engine: 'aix-node', build: 3, version: VERSION, image: imgReady(), video: vidReady(), update: UPDST });
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
    if (u === '/admin/media') {   // media engines panel: status, install/repair, video settings
      const tail = (f) => { try { return fs.readFileSync(path.join(__dirname, 'runtime', f), 'utf8').split('\n').slice(-25).join('\n'); } catch { return ''; } };
      const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')); } catch { return null; } };
      const wr = (f, o) => fs.writeFileSync(path.join(__dirname, f), JSON.stringify(o) + '\n');
      global.__INST = global.__INST || {};
      if (req.method === 'POST') {
        const b = JSON.parse((await body(req)).toString() || '{}');
        if (b.act === 'install' && (b.what === 'image' || b.what === 'video')) {
          const live = global.__INST[b.what]; if (live && live.exitCode === null) return J(res, h, 409, { error: 'already running' });
          const file = b.what === 'image' ? 'Install Qwen Image.command' : 'Install Local Video.command';
          try { fs.unlinkSync(path.join(__dirname, b.what === 'image' ? '.aix-image-skip' : '.aix-video-skip')); } catch {}
          const outf = fs.openSync(path.join(__dirname, 'runtime', b.what + '-install-console.log'), 'w');
          const cp = require('child_process').spawn('bash', [path.join(__dirname, file)], { cwd: __dirname, stdio: ['ignore', outf, outf], detached: true }); cp.unref(); global.__INST[b.what] = cp;
          return J(res, h, 200, { started: b.what });
        }
        if (b.act === 'toggle' && (b.what === 'image' || b.what === 'video')) { const f = b.what === 'image' ? '.aix-image' : '.aix-video', c = rd(f); if (!c) return J(res, h, 404, { error: 'not installed' }); c.ok = !!b.on; wr(f, c); return J(res, h, 200, { ok: c.ok }); }
        if (b.act === 'video') { const c = rd('.aix-video'); if (!c) return J(res, h, 404, { error: 'video not installed' }); const n = Math.round((+b.nframes || 49 - 1) / 8) * 8 + 1; c.nframes = Math.max(25, Math.min(241, n)); wr('.aix-video', c); return J(res, h, 200, { nframes: c.nframes }); }
        return J(res, h, 400, { error: 'unknown action' });
      }
      const ic = rd('.aix-image'), vc = rd('.aix-video'), run = (k) => !!(global.__INST[k] && global.__INST[k].exitCode === null);
      let freeGb = null; try { const d = require('child_process').execSync('df -k /', { encoding: 'utf8', timeout: 3000 }).trim().split('\n').pop().split(/\s+/); freeGb = Math.round(+d[3] / 1048576); } catch {}
      return J(res, h, 200, { version: VERSION, freeGb, unload: process.env.AIX_UNLOAD !== '0', queue: { image: IMGQ, video: VIDQ }, job: VIDJOBS.length ? vidSnap(VIDJOBS[0]) : null,
        image: { ready: imgReady(), cmd: ic && ic.cmd, label: ic && (ic.label || ic.model) || null, steps: ic && ic.steps, stepsHq: ic && ic.stepsHq, installing: run('image'), log: tail('image-install.log') || tail('image-install-console.log') },
        video: { ready: vidReady(), label: vc && vc.label || null, modes: vc && vc.modes || {}, nframes: vc && vc.nframes, fps: vc && vc.fps, imageFlag: !!(vc && vc.flags && vc.flags.img), installing: run('video'), log: tail('video-install.log') || tail('video-install-console.log') } });
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
    if (u === '/admin/tiers') {
      const tf = path.join(__dirname, '.aix-models');
      if (req.method === 'POST') { const b = JSON.parse((await body(req)).toString() || '{}'); const o = {}; for (const k of ['eco', 'balanced', 'thorough']) if (b[k]) o[k] = String(b[k]).slice(0, 120); fs.writeFileSync(tf, JSON.stringify(o)); if (b.vision !== undefined) { const vf = path.join(__dirname, '.aix-vision-model'); if (b.vision) fs.writeFileSync(vf, String(b.vision)); VIS_C.t = 0; } if (b.think !== undefined) fs.writeFileSync(path.join(__dirname, '.aix-think'), b.think ? '1' : '0'); try { global.__REGNOW && global.__REGNOW(); } catch {} }
      let t = {}; try { t = JSON.parse(fs.readFileSync(tf, 'utf8')); } catch {}
      let vis = ''; try { vis = fs.readFileSync(path.join(__dirname, '.aix-vision-model'), 'utf8').trim(); } catch {}
      return J(res, h, 200, { tiers: { eco: t.eco || '', balanced: t.balanced || '', thorough: t.thorough || process.env.MODEL || '' }, vision: process.env.VISION_MODEL || vis, think: thinkOn(), main: process.env.MODEL || '', note: 'Tier changes are sent to the cloud within seconds. Vision changes apply immediately.' });
    }
    if (u === '/v1/videos/generate' && req.method === 'POST') {
      // headers go out at once and a space is sent every 20 s so tunnels/proxies do not time out during the long render; the JSON follows at the end
      let b; try { b = JSON.parse((await body(req)).toString() || '{}'); } catch { return J(res, h, 400, { error: 'bad json' }); }
      const pr = String(b.prompt || '').slice(0, 800).trim(); if (!pr) return J(res, h, 400, { error: 'prompt required' });
      if (!vidReady()) return J(res, h, 501, { error: 'local video not installed' });
      const m = /^data:image\/[\w+.-]+;base64,(.+)$/.exec(String(b.image || '')), ib = m ? Buffer.from(m[1], 'base64') : null;
      const dm = (v, d) => Math.max(256, Math.min(1280, Math.round((+v || d) / 64) * 64));
      const VW = dm(b.w, 768), VH = dm(b.h, 512), VQ = String(b.q || 'fast'), job = vidJob(VW, VH, b.sec, VQ, !!b.up);
      res.writeHead(200, { ...h, 'content-type': 'application/x-ndjson' }); const send = (o) => { try { res.write(JSON.stringify(o) + '\n'); } catch {} }; send({ p: vidSnap(job) }); const hb = setInterval(() => send({ p: vidSnap(job) }), 2000);
      try { const mp4 = await genVid(pr, ib, VW, VH, b.sec, !!b.up, VQ, job); clearInterval(hb); send({ p: { ...vidSnap(job), pct: 100, stage: 'Done', eta: 0 } }); res.end(JSON.stringify({ video: 'data:video/mp4;base64,' + mp4.toString('base64'), model: ((vidCfg() || {}).label || 'ltx').toLowerCase().replace(/\s+/g, '-'), secs: Math.round((Date.now() - job.runStart) / 1000), frames: job.frames })); }
      catch (e) { clearInterval(hb); res.end(JSON.stringify({ error: String(e.message || e).slice(0, 300), code: e.code || 502 })); }
      return;
    }
    if (u === '/v1/images/generate' && req.method === 'POST') {
      try {
        const b = JSON.parse((await body(req)).toString() || '{}'), pr = String(b.prompt || '').slice(0, 1000).trim(); if (!pr) return J(res, h, 400, { error: 'prompt required' });
        const dm = (v) => Math.max(512, Math.min(1536, Math.round((+v || +b.size || 1024) / 64) * 64)), W = dm(b.w), H = dm(b.h);
        const png = await genImg(pr, !!b.hq, W, H); return J(res, h, 200, { image: 'data:image/png;base64,' + png.toString('base64'), model: 'qwen-image-2.1', hq: !!b.hq });
      } catch (e) { return J(res, h, e.code || 502, { error: String(e.message || e).slice(0, 300) }); }
    }
    if (u.startsWith('/v1/') || u === '/api/tags') {
      const t0 = Date.now(); let buf = req.method === 'GET' ? undefined : await body(req); let model = '', pj = null; try { pj = JSON.parse(buf.toString()); if (/qwen3|qwq|deepseek-r1/i.test(pj.model || '') && pj.reasoning_effort == null && pj.think == null && !thinkOn() && !req.headers['x-aix-think']) { pj.reasoning_effort = 'none'; pj.think = false; buf = Buffer.from(JSON.stringify(pj)); } model = pj.model || ''; const hasImg = pj.messages && pj.messages.some((m) => Array.isArray(m.content) && m.content.some((c) => c && c.type === 'image_url')); if (hasImg) { const vm = await visionModel(); if (vm) { pj.model = model = vm; } else { pj.messages = pj.messages.map((m) => (Array.isArray(m.content) ? { ...m, content: m.content.filter((c) => !(c && c.type === 'image_url')).map((c) => (c.type === 'text' ? c.text : '')).join('\n') + '\n\n(Note for the assistant: the user attached an image but the vision model is still being installed on this host. Tell them in one short sentence that image reading will be ready in a few minutes and to try again, then answer any text part of the question.)' } : m)); } buf = Buffer.from(JSON.stringify(pj)); } } catch (e) { console.log('vision route error', e && e.message); }
      ST.req++; const ent = { t: new Date().toISOString(), path: u, model, status: 0, ms: 0, tokens: 0, user: clip(req.headers['x-aix-user'], 80), src: clip(req.headers['x-aix-src'], 12) || 'direct', stream: !!(pj && pj.stream), msgs: pj && pj.messages ? pj.messages.length : 0, inChars: pj && pj.messages ? JSON.stringify(pj.messages).length : 0, prompt: LOGTEXT && pj ? clip(lastUser(pj.messages), 400) : '', reply: '' };
      let acc = '', rawAcc = '';
      const wantThink = !!(pj && pj.stream && (req.headers['x-aix-think'] || thinkOn()) && /qwen3|qwq|deepseek-r1/i.test(pj.model || ''));
      const isChat = u.includes('chat/completions'), isStream = !!(pj && pj.stream);
      const ctls = new Set(); res.on('close', () => { for (const c of ctls) { try { c.abort(); } catch {} } if (res.__ka) clearInterval(res.__ka); });   // a closed browser/worker connection stops the generation, so the next request never waits behind it
      let headSent = false; const head = (st, ct) => { if (!headSent) { headSent = true; res.writeHead(st, { ...h, 'content-type': ct, 'cache-control': 'no-cache', 'x-accel-buffering': 'no' }); } };
      if (isChat && isStream) { head(200, 'text/event-stream'); res.write(': start\n\n'); res.__ka = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 8000); }   // headers + heartbeat go out at once: long prompt processing or thinking can no longer look like a dead connection
      const attempt = async (b) => { const c = new AbortController(); ctls.add(c); const r = await fetch(OLLAMA + req.url, { method: req.method, headers: { 'content-type': 'application/json' }, body: b, signal: c.signal }); return { r, c }; };
      const BUDGET = +process.env.AIX_THINK_MAX || 6000;   // characters of hidden reasoning allowed before the answer must start
      let rch = 0, cch = 0, lb = '';
      const pump = async (r, c, allowCut) => {
        let cut = false;
        try {
          for await (const ch of r.body) {
            const cs = Buffer.from(ch).toString('utf8');
            if (isStream) { lb += cs; const ls = lb.split('\n'); lb = ls.pop(); for (const ln of ls) if (ln.startsWith('data:') && !ln.includes('[DONE]')) { try { const d = (JSON.parse(ln.slice(5)).choices || [{}])[0].delta || {}; if (d.content) cch += d.content.length; const rs = d.reasoning || d.reasoning_content; if (rs) rch += rs.length; } catch {} } }
            if (allowCut && !cch && rch > BUDGET) { cut = true; c.abort(); break; }
            if (!res.writableEnded) res.write(ch);
            const n = (cs.match(/"content":"/g) || []).length; ent.tokens += n; ST.chunks += n; if (rawAcc.length < 60000) rawAcc += cs;
          }
        } catch (e) { if (!cut && !res.writableEnded && !res.destroyed) throw e; }
        return cut;
      };
      let up, c1;
      try { ({ r: up, c: c1 } = await attempt(buf)); } catch (e) { if (res.destroyed) return; throw e; }
      ent.status = up.status; if (!up.ok) ST.err++;
      if (!up.ok && headSent) { res.write('data: ' + JSON.stringify({ error: { message: 'Ollama returned HTTP ' + up.status } }) + '\n\n'); }
      else { head(up.status, up.headers.get('content-type') || 'application/json'); }
      if (up.body && (up.ok || !headSent || true)) {
        const cut = await pump(up, c1, wantThink);
        if (cut) {   // reasoning ran too long: restart once with thinking off so the build is always delivered
          console.log('XQ reasoning budget hit (' + rch + ' chars) - restarting without thinking');
          const pj2 = { ...pj, think: false, reasoning_effort: 'none' }; try { const ms = pj2.messages.slice(); const li = ms.length - 1; if (ms[li] && typeof ms[li].content === 'string') ms[li] = { ...ms[li], content: ms[li].content + '\n\nAnswer directly now with the complete result.' }; pj2.messages = ms; } catch {}
          const r2 = await attempt(Buffer.from(JSON.stringify(pj2))); await pump(r2.r, r2.c, false);
        }
      }
      if (res.__ka) clearInterval(res.__ka);
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
  } catch (e) { ST.err++; try { if (res.__ka) clearInterval(res.__ka); if (res.headersSent) { try { res.write('data: ' + JSON.stringify({ error: { message: 'Ollama not reachable: ' + e.message } }) + '\n\n'); } catch {} res.end(); } else J(res, h, 502, { error: 'Ollama not reachable: ' + e.message }); } catch {} }
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
    const reg = async () => { const PU = getPU(); if (!PU) return; try { const r = await fetch(W.replace(/\/+$/, '') + '/api/node/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-node-secret': NS }, body: JSON.stringify({ url: PU, token: TOKEN, model: MODEL, models: readTiers(), img: imgReady(), vid: vidReady(), id: NODEID(), prio: NODEPRIO(), name: os.hostname().slice(0, 30) }) }); REGOK = r.ok; LASTREG = Date.now(); if (!reg.ok) { reg.ok = r.ok; console.log(r.ok ? 'Registered with AIX cloud: apps will use this node automatically' : 'Register failed: HTTP ' + r.status); } } catch (e) { console.log('Register error: ' + e.message); reg.ok = false; } };
    REGNOW = reg; global.__REGNOW = reg; reg(); setInterval(reg, 60000);
  } else console.log('Cloud registration off (needs AIX_WORKER, AIX_NODE_SECRET, MODEL)');
});
