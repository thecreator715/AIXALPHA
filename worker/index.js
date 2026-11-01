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
const view = (a) => ({ email: a.email, credits: +Number(a.credits).toFixed(2), tokens: a.tokens, requests: a.requests });
const getUser = (env, email) => env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
async function authed(env, req) {
  const h = req.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!t) return null;
  return env.DB.prepare('SELECT * FROM users WHERE token_hash=?').bind(await sha(t)).first();
}
const costUsd = (u) => ((u.input || 0) * PRICE.in + (u.output || 0) * PRICE.out + (u.cacheRead || 0) * PRICE.cr + (u.cacheWrite || 0) * PRICE.cw) / 1e6;

// Atomic in SQL: no lost updates when requests overlap.
async function charge(env, a, usage) {
  const cr = costUsd(usage) / CREDIT_USD, now = new Date().toISOString(), tok = (usage.input || 0) + (usage.output || 0);
  const owner = owners(env).includes(a.email);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET credits=' + (owner ? 'credits' : 'MAX(0,credits-?)') + ', tokens=tokens+?, requests=requests+1, last=? WHERE email=?').bind(...(owner ? [tok, now, a.email] : [cr, tok, now, a.email])),
    env.DB.prepare('INSERT INTO usage(email,at,input,output,credits) VALUES(?,?,?,?,?)').bind(a.email, now, usage.input || 0, usage.output || 0, owner ? 0 : cr),
  ]);
  const f = await getUser(env, a.email);
  return { credits: +Number(f.credits).toFixed(2), spentCredits: +cr.toFixed(3) };
}

async function sample(env, req) {
  const a = await authed(env, req);
  if (!a) return json(env, req, { error: 'Sign in to use AIX.' }, 401);
  if (a.credits <= 0 && !owners(env).includes(a.email)) return json(env, req, { error: 'Out of credits. Top up to continue.' }, 402);
  const b = await req.json().catch(() => ({}));
  const prompt = String(b.prompt || ''); if (!prompt) return json(env, req, { error: 'prompt required' }, 400);
  const stream = !!b.stream;
  const content = (Array.isArray(b.images) ? b.images.slice(0, 4) : []).map((i) => ({ type: 'image', source: { type: 'base64', media_type: String(i.media_type || 'image/png'), data: String(i.data || '') } }));
  content.push({ type: 'text', text: prompt });
  const up = await fetch(env.UPSTREAM_URL || 'https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: MODEL, max_tokens: Math.min(Number(b.max_tokens) || 4096, 8192), stream, messages: [{ role: 'user', content }] }) });
  if (!up.ok) {
    const bad = up.status === 401 || up.status === 403;
    return json(env, req, { error: bad ? 'The owner API key was rejected by Anthropic. The owner must update the ANTHROPIC_API_KEY secret.' : 'Model request failed (' + up.status + ').' }, up.status === 429 ? 429 : 502);
  }
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  if (!stream) {
    const j = await up.json(); usage.input = j.usage?.input_tokens || 0; usage.output = j.usage?.output_tokens || 0;
    const bill = await charge(env, a, usage);
    return json(env, req, { text: (j.content || []).map((c) => c.text || '').join(''), truncated: j.stop_reason === 'max_tokens', ...bill });
  }
  let buf = ''; const dec = new TextDecoder();
  const ts = new TransformStream({
    transform(chunk, ctl) {
      ctl.enqueue(chunk); buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const ln of lines) if (ln.startsWith('data:')) { try { const e = JSON.parse(ln.slice(5)); if (e.type === 'message_start') usage.input = e.message?.usage?.input_tokens || 0; if (e.type === 'message_delta') usage.output = e.usage?.output_tokens || usage.output; } catch {} }
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
      return json(env, req, { token, account: view(a) });
    }
    if (path === '/api/account/me') { const a = await authed(env, req); return a ? json(env, req, view(a)) : json(env, req, { error: 'sign in' }, 401); }
    if (path === '/api/sample' && req.method === 'POST') return sample(env, req);
    if (path === '/api/stripe/webhook' && req.method === 'POST') return stripe(env, req);
    if (path.startsWith('/api/admin/')) {
      if (!env.ADMIN_TOKEN || req.headers.get('x-admin-token') !== env.ADMIN_TOKEN) return json(env, req, { error: 'admin token required' }, 401);
      if (path === '/api/admin/grant' && req.method === 'POST') {
        const b = await req.json().catch(() => ({})); const email = String(b.email || '').toLowerCase(); const n = Number(b.credits);
        if (!(await getUser(env, email)) || !(n > 0)) return json(env, req, { error: 'email + credits required' }, 400);
        await env.DB.batch([env.DB.prepare('UPDATE users SET credits=credits+? WHERE email=?').bind(n, email), env.DB.prepare('INSERT INTO purchases(email,at,usd,credits,ref) VALUES(?,?,0,?,?)').bind(email, new Date().toISOString(), n, 'admin-grant-' + Date.now())]);
        return json(env, req, view(await getUser(env, email)));
      }
      if (path === '/api/admin/users.md') {
        const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY last DESC').all();
        const rows = results.map((a) => `| ${a.email} | ${Number(a.credits).toFixed(1)} | ${a.tokens} | ${a.requests} | ${a.last || '-'} |`);
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
