# AIX ALPHA cloud backend (Cloudflare Worker)

Always-on replacement for the master node. Your Anthropic key lives as a Cloudflare secret; users are metered in credits (1 credit = $0.0014 of spend); the owner email is never charged; Stripe webhook at `/api/stripe/webhook`.

Deploy: run `Deploy-Cloud.command` (Mac) or the same steps by hand with `npx wrangler`. Endpoints match the Node server (`/api/sample`, `/api/account/*`, `/api/admin/*`), so the app works with either.

## Public API (OpenAI-compatible)
Users create keys on the API page. `POST /v1/chat/completions` with `Authorization: Bearer aixk_...`, models `aix-alpha` (Mac node first, cloud fallback) and `aix-alpha-cloud`. Every call is billed to the key owner's credits (about 71 cr per 1M input tokens, 357 cr per 1M output) and logged in `api_usage`; `GET /api/keys/stats` returns the totals shown on the API page. Cron trigger `*/5 * * * *` runs scheduled tasks.
