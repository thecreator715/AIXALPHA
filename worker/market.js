// AIX Alpha marketplace: cloud-saved apps, publishing, buying with credits, ratings, sales tracking.
const FEE = 0.15, MAXSIZE = 400000, MAXAPPS = 50, MAXPRICE = 10000;
const uname = async (env, email) => { const r = await env.DB.prepare('SELECT username FROM users WHERE email=?').bind(email).first(); return (r && r.username) || email.split('@')[0]; };
const meta = (r, extra) => ({ id: r.id, title: r.title, description: r.description, icon: r.icon, price: r.price, status: r.status, size: r.size, downloads: r.downloads, sales: r.sales, earned: +Number(r.earned).toFixed(2), rating: r.rating_n ? +(r.rating_sum / r.rating_n).toFixed(1) : null, ratings: r.rating_n, updated: r.updated, seller: r.seller || undefined, ...extra });
export async function market(env, req, path, ctx) {
  const { json, authed, owners } = ctx;
  const a = await authed(env, req);
  const isOwner = a && owners(env).includes(a.email);
  const url = new URL(req.url), now = new Date().toISOString();
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const need = () => json(env, req, { error: 'Sign in to use the marketplace.' }, 401);
  const sub = path.slice('/api/market/'.length);

  if (sub === 'browse') {
    const q = (url.searchParams.get('q') || '').toLowerCase().slice(0, 60), sort = url.searchParams.get('sort') || 'new';
    const order = sort === 'top' ? 'CASE WHEN rating_n=0 THEN 0 ELSE rating_sum*1.0/rating_n END DESC, rating_n DESC' : sort === 'popular' ? 'sales+downloads DESC' : sort === 'cheap' ? 'price ASC' : 'updated DESC';
    const rows = (await env.DB.prepare(`SELECT a.*, COALESCE(u.username, substr(a.owner,1,instr(a.owner,'@')-1)) AS seller FROM apps a LEFT JOIN users u ON u.email=a.owner WHERE a.status='live' ORDER BY ${order} LIMIT 120`).all()).results || [];
    let mine = new Set();
    if (a) mine = new Set(((await env.DB.prepare('SELECT app_id FROM app_sales WHERE buyer=?').bind(a.email).all()).results || []).map(x => x.app_id));
    const list = rows.filter(r => !q || (r.title + ' ' + r.description).toLowerCase().includes(q)).map(r => meta(r, { owned: !!a && (r.owner === a.email || mine.has(r.id)), mine: !!a && r.owner === a.email }));
    return json(env, req, { apps: list, fee: FEE });
  }
  if (!a) return need();

  if (sub === 'save' && req.method === 'POST') {
    const files = Array.isArray(body.files) ? body.files.filter(f => f && typeof f.name === 'string').map(f => ({ name: f.name.slice(0, 120), content: typeof f.content === 'string' ? f.content : '', ...(f.bin ? { bin: 1 } : {}) })) : [];
    if (!files.length) return json(env, req, { error: 'App has no files.' }, 400);
    const fj = JSON.stringify(files);
    if (fj.length > MAXSIZE) return json(env, req, { error: `App is too large (${Math.round(fj.length / 1000)} KB; limit ${MAXSIZE / 1000} KB).` }, 413);
    const title = String(body.title || 'Untitled app').slice(0, 60), description = String(body.description || '').slice(0, 400), icon = String(body.icon || '🧩').slice(0, 4);
    if (body.id) {
      const r = await env.DB.prepare('SELECT * FROM apps WHERE id=? AND owner=?').bind(body.id, a.email).first();
      if (!r) return json(env, req, { error: 'App not found.' }, 404);
      await env.DB.prepare('UPDATE apps SET title=?,description=?,icon=?,files=?,size=?,updated=? WHERE id=?').bind(title, description, icon, fj, fj.length, now, r.id).run();
      return json(env, req, { app: meta({ ...r, title, description, icon, size: fj.length, updated: now }) });
    }
    const c = await env.DB.prepare('SELECT COUNT(*) n FROM apps WHERE owner=?').bind(a.email).first();
    if (c.n >= MAXAPPS) return json(env, req, { error: `Cloud limit is ${MAXAPPS} apps. Delete one first.` }, 400);
    const id = 'a_' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    await env.DB.prepare('INSERT INTO apps(id,owner,title,description,icon,files,size,price,status,created,updated) VALUES(?,?,?,?,?,?,?,0,\'draft\',?,?)').bind(id, a.email, title, description, icon, fj, fj.length, now, now).run();
    return json(env, req, { app: meta({ id, title, description, icon, size: fj.length, price: 0, status: 'draft', downloads: 0, sales: 0, earned: 0, rating_sum: 0, rating_n: 0, updated: now }) });
  }
  if (sub === 'mine') {
    const rows = (await env.DB.prepare('SELECT * FROM apps WHERE owner=? ORDER BY updated DESC').bind(a.email).all()).results || [];
    return json(env, req, { apps: rows.map(r => meta(r)), fee: FEE });
  }
  if (sub === 'get') {                       // full files for owner / buyer / free live app
    const id = url.searchParams.get('id'), r = await env.DB.prepare('SELECT * FROM apps WHERE id=?').bind(id).first();
    if (!r) return json(env, req, { error: 'Not found.' }, 404);
    const has = r.owner === a.email || isOwner || (await env.DB.prepare('SELECT 1 x FROM app_sales WHERE app_id=? AND buyer=?').bind(id, a.email).first());
    if (!has && !(r.status === 'live' && r.price === 0)) return json(env, req, { error: 'Buy this app to open it.' }, 403);
    return json(env, req, { app: meta(r), files: JSON.parse(r.files || '[]') });
  }
  if (sub === 'publish' && req.method === 'POST') {
    const r = await env.DB.prepare('SELECT * FROM apps WHERE id=? AND owner=?').bind(body.id, a.email).first();
    if (!r) return json(env, req, { error: 'App not found.' }, 404);
    const live = body.live !== false, price = Math.max(0, Math.min(MAXPRICE, Math.round(Number(body.price) || 0)));
    if (live && (!r.title || r.title === 'Untitled app')) return json(env, req, { error: 'Give the app a title before publishing.' }, 400);
    if (live && !(r.description || '').trim()) return json(env, req, { error: 'Add a short description before publishing.' }, 400);
    await env.DB.prepare('UPDATE apps SET status=?, price=?, updated=? WHERE id=?').bind(live ? 'live' : 'draft', price, now, r.id).run();
    return json(env, req, { ok: true, status: live ? 'live' : 'draft', price });
  }
  if (sub === 'delete' && req.method === 'POST') {
    const r = await env.DB.prepare('SELECT * FROM apps WHERE id=?').bind(body.id).first();
    if (!r || (r.owner !== a.email && !isOwner)) return json(env, req, { error: 'App not found.' }, 404);
    if (r.sales > 0 && !isOwner) { await env.DB.prepare("UPDATE apps SET status='draft' WHERE id=?").bind(r.id).run(); return json(env, req, { ok: true, unlisted: true, note: 'App has buyers, so it was unlisted instead of deleted (buyers keep access).' }); }
    await env.DB.prepare('DELETE FROM apps WHERE id=?').bind(r.id).run();
    return json(env, req, { ok: true });
  }
  if (sub === 'buy' && req.method === 'POST') {
    const r = await env.DB.prepare('SELECT * FROM apps WHERE id=? AND status=\'live\'').bind(body.id).first();
    if (!r) return json(env, req, { error: 'This app is no longer listed.' }, 404);
    if (r.owner === a.email) return json(env, req, { error: 'This is your own app.' }, 400);
    const ins = await env.DB.prepare('INSERT OR IGNORE INTO app_sales(app_id,buyer,seller,price,fee,at) VALUES(?,?,?,?,?,?)').bind(r.id, a.email, r.owner, 0, 0, now).run();
    if (!ins.meta.changes) return json(env, req, { ok: true, already: true, credits: +Number(a.credits).toFixed(2) });
    let price = r.price, fee = 0, left = a.credits;
    if (isOwner) price = 0;
    if (price > 0) {
      const d = await env.DB.prepare('UPDATE users SET credits=credits-? WHERE email=? AND credits>=?').bind(price, a.email, price).run();
      if (!d.meta.changes) { await env.DB.prepare('DELETE FROM app_sales WHERE app_id=? AND buyer=?').bind(r.id, a.email).run(); return json(env, req, { error: `Not enough credits. This app costs ${price}.`, need: price }, 402); }
      fee = +(price * FEE).toFixed(2);
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET credits=credits+? WHERE email=?').bind(price - fee, r.owner),
        env.DB.prepare('UPDATE app_sales SET price=?, fee=? WHERE app_id=? AND buyer=?').bind(price, fee, r.id, a.email),
      ]);
      left = a.credits - price;
    }
    await env.DB.prepare('UPDATE apps SET sales=sales+1, downloads=downloads+1, earned=earned+? WHERE id=?').bind(price - fee, r.id).run();
    return json(env, req, { ok: true, paid: price, credits: +Number(left).toFixed(2), files: JSON.parse(r.files || '[]'), app: meta(r) });
  }
  if (sub === 'library') {
    const rows = (await env.DB.prepare(`SELECT a.*, s.at AS bought, s.price AS paid, s.rating AS myrating, COALESCE(u.username, substr(a.owner,1,instr(a.owner,'@')-1)) AS seller FROM app_sales s JOIN apps a ON a.id=s.app_id LEFT JOIN users u ON u.email=a.owner WHERE s.buyer=? ORDER BY s.at DESC`).bind(a.email).all()).results || [];
    return json(env, req, { apps: rows.map(r => meta(r, { bought: r.bought, paid: r.paid, myrating: r.myrating })) });
  }
  if (sub === 'rate' && req.method === 'POST') {
    const n = Math.round(Number(body.rating));
    if (!(n >= 1 && n <= 5)) return json(env, req, { error: 'Rating must be 1-5.' }, 400);
    const s = await env.DB.prepare('SELECT * FROM app_sales WHERE app_id=? AND buyer=?').bind(body.id, a.email).first();
    if (!s) return json(env, req, { error: 'Only buyers can rate an app.' }, 403);
    await env.DB.batch([
      env.DB.prepare('UPDATE app_sales SET rating=? WHERE id=?').bind(n, s.id),
      env.DB.prepare('UPDATE apps SET rating_sum=rating_sum+?, rating_n=rating_n+? WHERE id=?').bind(n - (s.rating || 0), s.rating ? 0 : 1, body.id),
    ]);
    return json(env, req, { ok: true });
  }
  if (sub === 'sales') {
    const rows = (await env.DB.prepare(`SELECT s.at, s.price, s.fee, s.rating, a.title, a.icon, COALESCE(u.username, substr(s.buyer,1,instr(s.buyer,'@')-1)) AS buyer FROM app_sales s JOIN apps a ON a.id=s.app_id LEFT JOIN users u ON u.email=s.buyer WHERE s.seller=? ORDER BY s.at DESC LIMIT 100`).bind(a.email).all()).results || [];
    const t = await env.DB.prepare('SELECT COUNT(*) n, COALESCE(SUM(price-fee),0) earned, COALESCE(SUM(fee),0) fees FROM app_sales WHERE seller=? AND price>0').bind(a.email).first();
    const dl = await env.DB.prepare('SELECT COALESCE(SUM(downloads),0) d FROM apps WHERE owner=?').bind(a.email).first();
    return json(env, req, { sales: rows, totals: { paidSales: t.n, earned: +Number(t.earned).toFixed(2), fees: +Number(t.fees).toFixed(2), downloads: dl.d }, fee: FEE });
  }
  return json(env, req, { error: 'Unknown marketplace route.' }, 404);
}
