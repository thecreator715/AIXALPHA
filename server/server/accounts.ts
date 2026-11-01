import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { PRICING } from './engine/config';

/** 1 credit = 0.0014 USD of model spend (same unit the app shows). */
export const CREDIT_USD = 0.0014;
/** Customer packs: USD -> credits purchased (matches the Members page). */
export const PACKS: Record<number, number> = { 5: 50, 10: 100, 100: 1000 };

interface Account { id: string; email: string; tokenHash: string; credits: number; tokens: number; requests: number; created: string; last: string; purchases: Array<{ at: string; usd: number; credits: number; ref: string }> }
const FILE = path.resolve(process.env.AIX_DATA_DIR || 'data', 'accounts.json');
let db: Record<string, Account> = {};
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { db = {}; }
function persist() { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE + '.tmp', JSON.stringify(db, null, 1)); fs.renameSync(FILE + '.tmp', FILE); }
const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const byToken = (t: string) => Object.values(db).find((a) => a.tokenHash === hash(t));
const byEmail = (e: string) => Object.values(db).find((a) => a.email === e);

export function usdToCredits(usd: number) { return usd / CREDIT_USD; }
export function costUsd(u: { input: number; output: number; cacheRead?: number; cacheWrite?: number }) {
  const long = (u.input || 0) > PRICING.longThreshold;
  const pi = long ? PRICING.longIn : PRICING.shortIn, po = long ? PRICING.longOut : PRICING.shortOut;
  return ((u.input || 0) * pi + (u.output || 0) * po + (u.cacheRead || 0) * (long ? PRICING.longCacheRead : PRICING.shortCacheRead) + (u.cacheWrite || 0) * (long ? PRICING.longCacheWrite : PRICING.shortCacheWrite)) / 1e6;
}

export function authAccount(req: express.Request): Account | null {
  const h = String(req.headers.authorization || '');
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  return t ? byToken(t) || null : null;
}
const OWNERS = (process.env.AIX_OWNER_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
export const isOwner = (a: Account) => OWNERS.includes(a.email);
export function charge(a: Account, usd: number, tokens: number) {
  if (isOwner(a)) { a.tokens += tokens; a.requests++; a.last = new Date().toISOString(); persist(); return; }
  a.credits = Math.max(0, +(a.credits - usdToCredits(usd)).toFixed(4)); a.tokens += tokens; a.requests++; a.last = new Date().toISOString(); persist();
}
export function addCredits(a: Account, usd: number, credits: number, ref: string) {
  a.credits = +(a.credits + credits).toFixed(4); a.purchases.push({ at: new Date().toISOString(), usd, credits, ref }); persist();
}
export const publicView = (a: Account) => ({ email: a.email, credits: +a.credits.toFixed(2), tokens: a.tokens, requests: a.requests });

export function accountRoutes(app: express.Express, rateLimit: express.RequestHandler) {
  const ADMIN = process.env.AIX_ADMIN_TOKEN || '';
  const FREE = Number(process.env.AIX_SIGNUP_CREDITS || 0);
  const admin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!ADMIN || req.headers['x-admin-token'] !== ADMIN) { res.status(401).json({ error: 'admin token required' }); return; }
    next();
  };

  // Sign up (or re-issue a token). Returns the account token ONCE; only its hash is stored.
  app.post('/api/account/signup', rateLimit, (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'valid email required' }); return; }
    if (byEmail(email)) { res.status(409).json({ error: 'account exists; use your saved token' }); return; }
    const token = 'aix_' + crypto.randomBytes(24).toString('hex');
    db[email] = { id: email, email, tokenHash: hash(token), credits: FREE, tokens: 0, requests: 0, created: new Date().toISOString(), last: '', purchases: [] };
    persist(); res.json({ token, account: publicView(db[email]) });
  });
  app.get('/api/account/me', (req, res) => { const a = authAccount(req); if (!a) { res.status(401).json({ error: 'sign in' }); return; } res.json(publicView(a)); });

  // Owner tools: grant credits, export users.md
  app.post('/api/admin/grant', admin, (req, res) => {
    const a = byEmail(String(req.body?.email || '').toLowerCase()); const n = Number(req.body?.credits);
    if (!a || !(n > 0)) { res.status(400).json({ error: 'email + credits required' }); return; }
    addCredits(a, 0, n, 'admin-grant'); res.json(publicView(a));
  });
  app.get('/api/admin/users.md', admin, (_req, res) => {
    const rows = Object.values(db).map((a) => `| ${a.email} | ${a.credits.toFixed(1)} | ${a.tokens} | ${a.requests} | ${a.last || '-'} |`);
    res.type('text/markdown').send(`# AIX ALPHA users\n\n| Email | Credits | Tokens | Requests | Last active |\n|---|---|---|---|---|\n${rows.join('\n')}\n`);
  });

  // Stripe: Checkout Session with client_reference_id = account email. Webhook adds credits.
  // Needs STRIPE_WEBHOOK_SECRET. Raw body is required for signature verification.
  app.post('/api/stripe/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const sig = String(req.headers['stripe-signature'] || '');
    const parts = Object.fromEntries(sig.split(',').map((p) => p.split('=') as [string, string]));
    const expect = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw.toString('utf8')}`).digest('hex');
    if (!secret || !parts.v1 || parts.v1.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expect))) { res.status(400).send('bad signature'); return; }
    try {
      const ev = JSON.parse(raw.toString('utf8'));
      if (ev.type === 'checkout.session.completed') {
        const s = ev.data.object; const usd = (s.amount_total || 0) / 100; const credits = PACKS[usd]; const a = byEmail(String(s.client_reference_id || s.customer_details?.email || '').toLowerCase());
        const dup = a?.purchases.some((p) => p.ref === s.id);
        if (a && credits && !dup) addCredits(a, usd, credits, s.id);
      }
      res.json({ received: true });
    } catch { res.status(400).send('bad payload'); }
  });
}
