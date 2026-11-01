// AIX ALPHA cloud backend (Cloudflare Worker). Always on, no machine needed.
// Holds YOUR Anthropic key as a secret; meters users in credits; Stripe-ready.
const CREDIT_USD = 0.0014;
const PRICE = { in: 0.10, out: 0.50, cr: 0.01, cw: 0.125 };           // USD per million tokens (Haiku 5.5)
const PACKS = { 5: 50, 10: 100, 100: 1000 };
const MODEL = 'claude-haiku-5-5';
const enc = new TextEncoder();

const cors = (env, req) => {
  const allow = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const o = req.headers.get('origin') || '';
  const ok = allow.includes('*') ? '*' : allow.includes(o) ? o : '';
  return { 'access-control-allow-origin': ok, 'access-control-allow-headers': 'content-type, authorization, x-admin-token', 'access-control-allow-methods': 'GET,POST,OPTIONS', vary: 'Origin' };
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
  const h = req.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!t) return null;
  const th = await sha(t);
  return (await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.email=s.email WHERE s.token_hash=?').bind(th).first()) || (await env.DB.prepare('SELECT * FROM users WHERE token_hash=?').bind(th).first());
}
const SEARCH_USD = 0.01;            // Anthropic web search: $10 per 1,000 searches (~7 credits each)
const SEARCH_MIN_CREDITS = 8;       // a user needs at least this balance to allow live search on a reply
const costUsd = (u) => (u.searches || 0) * SEARCH_USD + ((u.input || 0) * PRICE.in + (u.output || 0) * PRICE.out + (u.cacheRead || 0) * PRICE.cr + (u.cacheWrite || 0) * PRICE.cw) / 1e6;

// Atomic in SQL: no lost updates when requests overlap.
async function charge(env, a, usage) {
  const cr = costUsd(usage) / CREDIT_USD, now = new Date().toISOString(), tok = (usage.input || 0) + (usage.output || 0);
  const owner = owners(env).includes(a.email);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET credits=' + (owner ? 'credits' : 'MAX(0,credits-?)') + ', tokens=tokens+?, requests=requests+1, last=? WHERE email=?').bind(...(owner ? [tok, now, a.email] : [cr, tok, now, a.email])),
    env.DB.prepare('INSERT INTO usage(email,at,input,output,credits) VALUES(?,?,?,?,?)').bind(a.email, now, usage.input || 0, usage.output || 0, owner ? 0 : cr),
  ]);
  const f = await getUser(env, a.email);
  return { credits: +Number(f.credits).toFixed(2), spentCredits: +cr.toFixed(3), searches: usage.searches || 0 };
}

async function sample(env, req) {
  const a = await authed(env, req);
  if (!a) return json(env, req, { error: 'Sign in to use AIX.' }, 401);
  if (a.credits <= 0 && !owners(env).includes(a.email)) return json(env, req, { error: 'Out of credits. Top up to continue.' }, 402);
  const b = await req.json().catch(() => ({}));
  const prompt = String(b.prompt || ''); if (!prompt) return json(env, req, { error: 'prompt required' }, 400);
  const stream = !!b.stream;
  const owner = owners(env).includes(a.email);
  const search = !!b.search && (owner || a.credits >= SEARCH_MIN_CREDITS);
  const content = (Array.isArray(b.images) ? b.images.slice(0, 4) : []).map((i) => ({ type: 'image', source: { type: 'base64', media_type: String(i.media_type || 'image/png'), data: String(i.data || '') } }));
  content.push({ type: 'text', text: prompt });
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
    const o = ev.data.object, usd = (o.amount_total || 0) / 100, credits = PACKS[usd];
    const email = String(o.client_reference_id || o.customer_details?.email || '').toLowerCase();
    if (credits && (await getUser(env, email))) {
      const ins = await env.DB.prepare('INSERT OR IGNORE INTO purchases(email,at,usd,credits,ref) VALUES(?,?,?,?,?)').bind(email, new Date().toISOString(), usd, credits, o.id).run();
      if (ins.meta?.changes > 0) await env.DB.prepare('UPDATE users SET credits=credits+? WHERE email=?').bind(credits, email).run();
    }
  }
  return new Response('{"received":true}', { headers: { 'content-type': 'application/json' } });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
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
    if (path === '/api/account/claim-free' && req.method === 'POST') {      // 1 free credit per username account, 1 per network
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
    if (path === '/api/image' && req.method === 'POST') return image(env, req);
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
  nano:  { cr: 3, label: 'Nano Banana' },
};
async function genImage(env, kind, prompt, steps) {
  if (kind === 'nano') {
    if (!env.GEMINI_API_KEY) throw Object.assign(new Error('Nano Banana is not set up on this server yet.'), { notConfigured: true });
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || 'Nano Banana request failed (' + r.status + ')');
    const part = ((j.candidates || [])[0]?.content?.parts || []).find((p) => (p.inlineData || p.inline_data));
    const d = part && (part.inlineData || part.inline_data);
    if (!d || !d.data) throw new Error('Nano Banana returned no image (the prompt may have been declined).');
    return 'data:' + (d.mimeType || d.mime_type || 'image/png') + ';base64,' + d.data;
  }
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
  if (kind === 'nano' && !env.GEMINI_API_KEY) return json(env, req, { error: 'Nano Banana is not set up on this server yet.' }, 501);
  const owner = owners(env).includes(a.email);
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
