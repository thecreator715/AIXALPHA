# AIX ALPHA

AIX Alpha is a family of purpose-built language models and a loop engine that routes, verifies and repairs every answer, so credits are spent only where a model call is needed. This repository holds the current v3.0 release in two forms.

## What is here

| Path | What it is |
|---|---|
| `artifact/aix-alpha-v3.html` | The full single-file app: chat, App Studio (one app per chat session, smart debugger, version history), Persona Hub, MCP tool console, plug-and-play connectors, Hosted Sites, Credits, Members, Analytics and About. It runs as a claude.ai artifact and uses the artifact runtime for model access, the shared users database and connectors. |
| `server/` | The server build: Express + React/Vite with the loop engine (`server/server/engine`), the MCP endpoint, spend caps and a test suite. Needs an `ANTHROPIC_API_KEY`. |

## Highlights

- **Loop engine:** reflex, router, context diet, cache, generate, deterministic verify, append-only repair, optional evaluator, credit ledger.
- **Studio:** one app and one Studio chat per chat session; minimal SEARCH/REPLACE edits instead of whole-file rewrites; every AI change saved to History with Undo; a live activity timeline; a smart debugger that creates sample data for blocked API calls.
- **Credits:** Starter $10 = 100 credits, top-up $5 = 50 credits, Enterprise $100 = 1,000 credits. Pay as you go with no monthly or yearly commitments. Stripe Payment Links are wired in and can be added later.
- **Connectors:** PayPal, Gmail and Claude Docs usable straight from chat.
- **Mobile:** a full mobile layout with a bottom navigation bar.

## Run the server build

```bash
cd server
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
npm test
```
