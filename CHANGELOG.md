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
