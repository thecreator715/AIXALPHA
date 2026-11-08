# AIX Alpha v3.0 - revision 6

- About: "One credit is not one message" breakdown.
- Mobile: Company and Studio scroll fully clear of the bottom nav.
- Worker: errors now return JSON with CORS ("Server error: ...") instead of a bare network failure; observability on.
- Worker: D1 read savings (sign-in and node-status caches, node-admin stats cache, no repeat schema checks).
- wrangler.toml now declares the live D1 database (DB) so a redeploy keeps working; KV binding removed.
- Deploy-Cloud.command keeps existing secrets (Enter to keep the Anthropic key, never rotates the admin token), defaults owner email.
- Node: Mac node checks in every minute; panel refreshes cloud stats every 30s.
- Cron every 5 minutes. Workers Paid plan recommended (no D1 daily read cap).
