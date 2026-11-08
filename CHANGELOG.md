# AIX Alpha v3.0 - revision 8

## Enterprise plan
- $99.99 every 30 days through Stripe adds 1,000 credits and opens the Company page. Credits carry over and never expire.
- Or unlock 30 days with 1,000 credits already in the balance (top up with the $9.99 pack, 100 credits at a time). Worker: `/api/enterprise/status|activate`, Stripe webhook branch, admin `what=enterprise`.
- App: Members page shows days left and renewal, the Company lock screen has a "Use 1,000 credits" button and a Stripe button.

## Referral program and YouTube promo
- Every account has a referral code (AIX-XXXXXX). A new registered user who enters one in their first 30 days gets 10 credits, the referrer gets 10 (cap 100 referrals per referrer). Blocks: own code, second code, guest accounts, same network twice. Blocked attempts are logged.
- YouTube promo: users submit a link on the Affiliate page, admin watches it in the control panel and approves (+100 credits, paid once) or rejects with a note. One submission per video, 3 pending and 5 rewarded per account.
- Worker: `/api/ref/me|redeem`, `/api/promo/submit`; admin `what=referrals|promos|promo_decide`.
- App: new Affiliate page, referral field in the sign-up dialog, invite links (`?ref=CODE`).
- Control panel: new Referrals and Promo videos tabs.
- Tuning: constants REF_NEW, REF_REFERRER, REF_CAP, PROMO_CREDITS at the top of the referral block in worker/index.js.

# AIX Alpha v3.0 - revision 6

- About: "One credit is not one message" breakdown.
- Mobile: Company and Studio scroll fully clear of the bottom nav.
- Worker: errors now return JSON with CORS ("Server error: ...") instead of a bare network failure; observability on.
- Worker: D1 read savings (sign-in and node-status caches, node-admin stats cache, no repeat schema checks).
- wrangler.toml now declares the live D1 database (DB) so a redeploy keeps working; KV binding removed.
- Deploy-Cloud.command keeps existing secrets (Enter to keep the Anthropic key, never rotates the admin token), defaults owner email.
- Node: Mac node checks in every minute; panel refreshes cloud stats every 30s.
- Cron every 5 minutes. Workers Paid plan recommended (no D1 daily read cap).

## Hosted storage (revision 7)
- Node: per-user folders under `hosted/<id>/` (img/ and site/), `_owner.json` in each folder, `/host/put|get|del|stats`. Node VERSION 8 (auto-updates from GitHub).
- Worker: `/api/host/usage|put|prune|delete|plan`, public `/h/<id>/img/<hash>.<ext>`. Images are content-addressed (same picture = same name, stored once).
- Quota per user: 5 MB included with hosting (images + site files). Above that a storage plan of N MB costs N credits per 30 days (prorated upgrades, monthly auto-renew; lapsed plans block new uploads, files are kept).
- App: Studio "Image" button (device, computer or camera), Sites page Storage panel (usage, calculator, per-site, image gallery, history), deploy blocked with a top-up prompt when over quota.
- Control panel (node): new Storage tab for admins (all users, plans, folders, largest files, uploads per day, node disk).
