# AIX ALPHA cloud backend (Cloudflare Worker)

Always-on replacement for the master node. Your Anthropic key lives as a Cloudflare secret; users are metered in credits (1 credit = $0.0014 of spend); the owner email is never charged; Stripe webhook at `/api/stripe/webhook`.

Deploy: run `Deploy-Cloud.command` (Mac) or the same steps by hand with `npx wrangler`. Endpoints match the Node server (`/api/sample`, `/api/account/*`, `/api/admin/*`), so the app works with either.
