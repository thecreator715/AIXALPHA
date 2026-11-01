# AIX Alpha v3.0 — Loop Engine

AIX Alpha v2's full suite (chat, App Studio, Persona Hub, MCP server, hosting, XRPL billing UI) rebuilt on **Claude Haiku 5.5** (`claude-haiku-5-5`, the cheapest current Claude) with a loop-based engine whose job is to **spend as few tokens as possible per useful answer**.

## Run it

```bash
npm install
cp .env.example .env.local      # then put your ANTHROPIC_API_KEY in it
npm run dev                     # http://localhost:3000
npm test                        # 21 engine tests, no API key needed
npm run build && npm start      # production
```

`AIX_MOCK=1 npm run dev` runs the whole UI offline with a clearly labelled mock transport (no API calls).

## How the loop saves tokens

Every message goes through layers; each layer only runs if the previous one could not finish the job. Layers 0–2 cost **zero tokens**.

| Layer | What it does | Anthropic pattern |
|---|---|---|
| 0 Reflex | Greetings, thanks, `/budget`, `/notes`, `/forget`, `/help`, plain 3D-mesh and image requests are answered locally. | Routing |
| 1 Router | Local classifier picks tier (NANO/MICRO/STANDARD/DEEP), `max_tokens`, `effort`, history window, repair budget. Web search is allowed only when the prompt needs fresh facts, max 1 search. | Routing |
| 2 Context diet | Persona prompts are distilled (v2's Quantum prompt ≈ 1,800 tokens → ≈ 170; LE ≈ 465 → ≈ 100; measured with the engine's estimator) or stripped of decoration; old code blocks become one-line stubs; dropped turns become a ~700-char digest; "remember / always / use …" statements become session notes. History window moves in steps so the cached prefix stays identical for several turns. | Compaction, structured note-taking |
| 3 Cache | System block carries `cache_control` and so does the stable history prefix (Haiku 5.5 only caches prefixes ≥ 512 tokens, so short chats simply aren't cached — they're already tiny); identical prompt + state is served from an in-memory response cache for $0. | Prompt caching |
| 4 Generate | One Haiku call, `effort: low` by default (`medium` for DEEP in BALANCED/THOROUGH, and on repair). | — |
| 5 Verify | Deterministic checks, free: truncation, unclosed code fences, unclosed `<html>/<script>/<style>`, invalid JSON, "in N words"/"N bullets" limits, repetition loops, refusals. | Evaluator-optimizer (programmatic evaluator) |
| 6 Repair | Cut-off output is **continued append-only** (only the missing tail is generated, overlap-merged). Constraint failures get one targeted rewrite with only the last user turn, never the whole history. Stops on: pass, no-progress, mode cap (ECO 1 / BALANCED 2 / THOROUGH 3), or budget. | Evaluator-optimizer, prompt chaining |
| 7 Optional judge | `EVAL ON` adds one ≤90-token reviewer call on DEEP answers (`OK` / `FIX: …`) that may trigger one rewrite. | Evaluator-optimizer (LLM evaluator) |
| 8 Ledger | Real usage from the API (input, cache read/write, output, searches) priced at Haiku 5.5 rates; per-request, per-chat and per-day caps are enforced **before** each call, and `max_tokens` is shrunk to fit the remaining request budget. | — |

### Cost reference (Haiku 5.5 list price, ≤100K-token prompts)
$0.10 / M input · $0.50 / M output · $0.01 / M cache read · $0.125 / M cache write. Prompts over 100K tokens bill about 5× — the engine's history window keeps you far below that.
A typical chat reply (~600 in, ~300 out) is ≈ $0.0002; a full single-file app (~8k out) ≈ $0.004.

### Spend caps (`.env.local`)
`AIX_REQUEST_MAX_USD=0.01` · `AIX_SESSION_MAX_USD=0.25` · `AIX_DAILY_MAX_USD=2.00`. When a cap is hit the server answers locally with a clear message and uses no tokens.

## UI additions
- **LOOP bar** above the prompt box: ECO / BALANCED / THOROUGH, EVAL toggle, live per-chat spend meter.
- **Per-reply chips**: tier, calls, repair passes, in/cached/out tokens, cost, estimated saving vs. an unoptimised call.
- The "Pipeline Execution" trace now shows the **real** protocol steps for that reply.

## What changed from v2
- Gemini removed; one priced model on purpose (any other `modelAlias` is coerced to Haiku 5.5).
- v2's silent "free-tier adaptive" canned replies are gone: a missing key returns a clear setup error, never a fake answer.
- v2 returned a stock sample video for any prompt containing "video/animation/motion"; removed.
- MCP `execute_sandbox_code` ran arbitrary JS via `new Function` on the server with no auth. It is now **off by default** (`AIX_ENABLE_SANDBOX=1` to enable; uses `node:vm` with a 1 s timeout — still not a hard security boundary, don't expose it publicly). Optional `AIX_MCP_TOKEN` bearer auth and a per-IP rate limit were added.
- Server-side TTS/transcription (Gemini) removed; the UI's browser Web Speech paths are used.

## Notes and limits
- Session notes, the response cache and spend ledgers live in server memory and reset on restart.
- Haiku 5.5's `effort` setting and the web-search tool are optional: if the API rejects either, the engine drops it, remembers that, and carries on.
- Image generation still uses the Pollinations URL from v2 (no tokens, external service). 3D is the local procedural generator.
- Cost numbers are list-price estimates from usage returned by the API; "% vs naive" compares against a hypothetical call with the full raw prompt and whole history and no caching.

Layout: `server.ts` (HTTP + MCP) · `server/engine/*` (router, context, prompt, verify, loop, budget state, transport) · `server/engine/loop.test.ts` · `src/` (React UI).

## Accounts, credits and Stripe (backend mode)

The static front end signs users in and calls this server; the Anthropic key never leaves the server.

- `POST /api/account/signup {email}` returns a one-time account token. `GET /api/account/me` shows the balance.
- `POST /api/sample` is the metered model proxy (Bearer token). Credits are deducted from actual token usage (1 credit = $0.0014 of spend) and the final stream event reports the new balance. It returns 402 when the balance is empty.
- Stripe: create Payment Links for the $5 / $10 / $100 packs with the buyer's email as `client_reference_id`, and point the webhook at `/api/stripe/webhook`. Credits are added per pack (50 / 100 / 1,000) and duplicate events are ignored.
- Owner: `POST /api/admin/grant` and `GET /api/admin/users.md` with the `x-admin-token` header.

Deploy on Render or Railway with a persistent disk for `AIX_DATA_DIR`, set the env vars above, then paste the server URL into the app's sign-in dialog (or into the `aix-backend` meta tag).
