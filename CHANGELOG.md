# AIX Alpha v3.0 - revision 8

## ALPHA XQ upgrade (node v26)
- XQ output limit doubled to 49,152 tokens, thinking mode on for XQ only, temperature 0.5, plan/compare/re-check method in its prompt. Node context window raised to 65,536 on 32 GB+ Macs to fit it.

## ALPHA XQ (node v25)
- New persona **ALPHA XQ**: always runs on the Thorough tier (newest, largest model on the node). Qwen 4 is not released yet, so today it runs qwen3.8:27b; `Start AIX Node.command` auto-pulls `qwen4:27b` on 32 GB+ Macs as soon as Ollama has it. Panel lists qwen4:27b as a one-click download.

## Node-only Alpha
- Alpha no longer calls Anthropic. Every chat, task and API call runs on the Mac node; if it is offline users get a clear "node offline" message (HTTP 503) and are not charged. Toggle `nodeOnly` in Settings (default on). Added `AIX MASTER.command` for a clean one-click restart.

## Node-only: modes, web search, images (node v12)
- Modes now shape the node: Eco short and fast (low temperature, 1,500-token cap), Balanced default, Thorough/Auto step-by-step with an 8,192-token budget, Turbo complete-code build mode.
- Web search works again: the Mac node searches (DuckDuckGo, then Mojeek), reads the top pages, and the worker hands the results to the model with citations. One search per reply, about 7 credits, charged only when results were found.
- Images: the node uses a vision model (qwen2.5vl:7b on Macs with 16 GB or more); without one, Alpha says it cannot see the image.
- The node model is created with a bigger context window (8K, 16K on 24 GB+ Macs).

## Admin control panel: 10 new tools (node v11)
- Settings tab: live kill switches (pause chat, sign-ups, referrals, Enterprise), site-wide banner, and live tuning of referral rewards/caps, strike limit, promo reward and alert limits. No redeploy; owner accounts are never blocked. Worker `what=config|config_set`, public `/api/config` now returns `banner` and `paused`.
- Alerts tab: node offline, 24h spend over limit, safety-flag spike, open appeals, held referrals, promo videos waiting, open tickets, bad Stripe signature. Checked every 5 minutes, optional push through a Discord webhook or ntfy.sh URL.
- Finance tab: revenue vs model cost per day, 30-day margin, credit liability, biggest spenders and who is losing money.
- Audit log tab: every panel action with who/what/when (also co-admins).
- Co-admin roles: owner mints `support` or `manager` tokens (Settings, stored in `node/admins.json`, git-ignored); node enforces permissions and records the actor.
- User 360 tab: balance, ledger, usage, referrals, flags, tickets, devices, shared-device/network accounts, private admin notes, grant/suspend.
- Fraud radar tab: devices and networks with many accounts, sign-up bursts, free-riders, hoarded free balances, referral-code guessing.
- Support inbox: users contact support from the Members page; admins reply in the Support tab; tickets flagged "needs reply".
- Restore one user from a cloud backup (preview first) and CSV export of users, ledger, usage, flags, referrals, tickets, audit.
- Worker tables created automatically: admin_log, alerts, user_notes, tickets, ticket_msgs.

## Enterprise plan
- $99.99 every 30 days through Stripe adds 1,000 credits and opens the Company page. Credits carry over and never expire.
- Or unlock 30 days with 1,000 credits already in the balance (top up with the $9.99 pack, 100 credits at a time). Worker: `/api/enterprise/status|activate`, Stripe webhook branch, admin `what=enterprise`.
- App: Members page shows days left and renewal, the Company lock screen has a "Use 1,000 credits" button and a Stripe button.

## Safety system
- Worker: every user message is scanned before the model (threats, harm requests, hate, sexual, heavy abuse; minors+sexual is zero tolerance). Blocked messages are strikes, 3 active strikes (90 day expiry) suspend the account, appeals at `/api/mod/appeal`, record at `/api/mod/me`. AI replies are scanned and logged (no strike). Self-harm wording is logged without text and never a strike. Owners are exempt.
- Control panel: new Safety tab (flags with excerpts, accounts near a ban, suspended users, appeals, dismiss/confirm/suspend/unban).
- App: suspension notice with appeal form, strike record on the Members page, notice in the sign-up dialog and About.

## Referral program and YouTube promo
- Every account has a referral code (AIX-XXXXXX). A new registered user who enters one in their first 30 days gets 10 credits, the referrer gets 10 (cap 100 referrals per referrer). Blocks: own code, second code, guest accounts, same network twice. Blocked attempts are logged.
- YouTube promo: users submit a link on the Affiliate page, admin watches it in the control panel and approves (+100 credits, paid once) or rejects with a note. One submission per video, 3 pending and 5 rewarded per account.
- Worker: `/api/ref/me|redeem`, `/api/promo/submit`; admin `what=referrals|promos|promo_decide`.
- App: new Affiliate page, referral field in the sign-up dialog, invite links (`?ref=CODE`).
- Control panel: new Referrals and Promo videos tabs.
- Anti-abuse: the referrer is paid only after the new account is 24h old and has used 3 credits; max 5 paid referrals per 30 days (50 total); blocks for same device, same network, code swaps between two accounts, throwaway emails; more than 3 redemptions of one code per hour are held for admin review. Admin can release or revoke (credits taken back).
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

## Node v13 – model ladder
- Higher mode = bigger model: Eco < Balanced < Thorough/Auto/Turbo. The start script pulls the smaller tiers in the background and writes `.aix-models`; the node reports them on register; the worker picks the model per mode (falls back to the main model until the smaller ones finish downloading). Images still use the vision model.

## App – tab bar
- Top tabs now fit any width: what does not fit moves into a "More" menu (with icons); every tab has an icon; mobile menu gained the missing Affiliate icon.

## App – UX pack
- Quick-start card for new users; Stop button (■) while Alpha is writing, partial text kept with a Continue button; "Retry in a higher mode" on replies.
- Each reply shows the mode and model that answered; offline-host banner with Check again, System status and "What can Alpha do?" dialogs; auto "back online" notice with Retry.
- Credits: per-chat total, balance and low-balance warning, web-search cost note; Receipts (download) in Credits via new `/api/account/receipts`.
- Cmd+K shows recent chats first and new commands; Studio ↶ Undo and 🩹 Fix errors buttons.
- Mobile: bigger touch targets, edge-swipe between chats, haptic on send. Worker `/api/node/status` now returns the model tiers.

## App + worker + node v14 – features 5–20
- Chat: pinned context per chat (📌), smart routing (thin Eco/Balanced answers get a Retry-with-Quantum bar, or auto-escalate when switched on in Cmd+K), offline queue (messages wait and send when the host returns) with reply notifications.
- Studio: template gallery, 🚀 Publish (opens site deploy prefilled), 🧪 Auto-test (clicks every control, reports errors, Fix with Alpha), 🕘 Timeline slider with live preview and restore.
- Credits: 80%/100% cap alerts, low-balance reminder with one-tap Top up, usage CSV and printable PDF report, referral dashboard summary, team credits (`/api/team*`: owner allocates credits to members with a per-member limit).
- Host: multiple hosts can register (`.aix-node-id`, optional `.aix-priority`); cloud uses the lowest priority online host and fails over to the next. Status page shows hosts, 24h uptime chart and response times.

## Admin suite 2 + backend efficiency (node v15)
- Control panel: new Ops, Growth, Money+, Controls and Security tabs covering live dashboard, host fleet (remote restart), incident timeline, SLA/error budget, slow & failed explorer, cohorts, funnel, saved segments + bulk actions, read-only view-as-user, revenue forecast, margin per mode, refunds/chargebacks, promo codes, affiliate payouts, safety overview, rate-limit rules, IP/device blocklist, suspicious logins, announcements, feature flags, scheduled admin jobs, two-person approval, 2-step admin sign-in with session list, export-everything and backup restore test.
- Worker: buffered request log (one batch write instead of one write per request), new D1 indexes, hourly pruning + PRAGMA optimize, charge() uses RETURNING (one fewer read per reply), public /api/announcements, /api/flags, /api/promo/redeem.
- Web search now bills ~3.5 credits (min balance 4).
- App: announcements banner, redeem-code button, desktop More button, mobile menu scrolls and fits.

## Image fixes, drag & drop (node v16)
- Node: image requests were silently sent to the text-only model (a const reassignment error was swallowed). Now they route to the vision model, auto-detect any installed vision model, and start downloading qwen2.5vl:7b if none exists. Until it is ready the reply says so instead of "I can't see an image".
- App: drag and drop images/files onto the chat, and paste images into the message box.
- App: remaining "7 credits" web-search labels now say 3.5.

## Live web search fixes (node v17)
- Node: more search engines (Bing RSS, DuckDuckGo, Mojeek, Google News for news-type questions) with per-engine errors logged; before, one blocked engine meant no search.
- App: the exact question is sent as the search query; the direct-to-Mac path now runs live search too (it skipped it before).
- When search returns nothing, the model is told to say so instead of implying it browsed.

## Web search from the cloud edge
- The worker now searches the web itself (Bing, DuckDuckGo, Google News, CoinGecko for crypto) and only falls back to the Mac node. Shows a toast with the result count. Web badge says +3.5.

## Web search reminder + docs
- Worker adds an end-of-prompt reminder so old "I cannot search" replies in a chat are ignored when live results are present.
- docs/COMMANDS.md: every command in one place.

## Node v18: start-up fix
- Start AIX Node no longer crashes with EADDRINUSE: it frees port 8787 before each start, waits for the old node to exit before restarting, and server.js waits for a busy port instead of exiting.

## Node v19 + app fixes
- Node now starts and supervises its own cloudflared tunnel (one process brings the Mac online); registers with the cloud the moment the tunnel address exists. Previously the launcher started the tunnel only after all model downloads, so the cloud saw the Mac as offline for a long time.
- AIX MASTER.command: step 7 confirms the cloud sees the Mac; tunnel kill pattern narrowed so other cloudflared tunnels are left alone.
- App: web search is always allowed on the Mac node / own-key path (no AIX credits are used there); Mac search path adds the "ignore earlier refusals" reminder and a "Searching the web…" toast.

- App: "rebuild / remake / recreate / clone" and classic game names (asteroids, pacman, tetris…) now route to the app/game builder instead of a chat refusal.

- App: on desktop (>=1100px) a reply with code shows the live preview on the right, side by side with the code (sticky, full height).

- Worker: node reply wait raised (stream 20s->110s) so a cold/loading 14B model no longer shows "node offline"; node v20 keeps the main model warm.

- App: split view panels same height and each scrolls; live preview no longer reloads while the pointer is over it (2.5 s refresh); chat no longer force-scrolls to the bottom while a reply streams if you scrolled up.

- App: built-in tested game cartridges (Atari-style Asteroids, Breakout, Snake, Pong, Space Invaders, Tetris) load instantly with 0 tokens when asked by name; any other game uses a dedicated game rulebook (loop, states, input, WebAudio, particles, high score, era-accurate art) instead of the glass-app template; "finish/continue/fix it" follow-ups edit the last build; game code is checked for a loop and input. Sources in games/.

## Node v21 - Qwen 3.x
- Models moved from Qwen 2.5 to Qwen 3.x: 32 GB Macs run qwen3.8:27b (thorough), qwen3.5:9b (balanced), qwen3.5:4b (eco); vision is qwen3-vl:8b. Falls back to qwen3.6:27b when Ollama is too old for 3.8.
- Thinking is off by default on Qwen3 models (fast chat); opt in with header x-aix-think or AIX_THINK=1.

## Node v22 - control panel
- New "Model tiers & settings" panel: pick eco/balanced/thorough/vision models from installed ones, thinking-mode toggle, one-click downloads of recommended Qwen 3.x models. Saves live; cloud picks up changes within seconds.
- New /admin/tiers endpoint.

## App fix - web search queries
- Chat messages are cleaned into a proper search query (filler like "can you explain ... in list comparisons" removed, model names get context), fixing results about the word "can" / Canva.
- Prompt tells the model that unfamiliar version numbers may be newer than its training and must not be called non-existent.

## Node v23 + worker - search that actually finds things
- Search (worker and node) now cleans the query itself, so it works even from an old cached app; model/version questions also fan out into per-version searches; results that do not match the query are dropped instead of being fed to the model.
- Prompt tells the model unrecognised versions may be newer than its training. Worker live-patched.

## App - unique designs + fewer truncated builds
- Builds no longer default to dark glass. A design-direction system (18 styles: Editorial Paper, Neo-Brutalist, Phosphor Terminal, Swiss Grid, Warm Organic, Fintech Clean, Synthwave, Clay Pastel, Industrial HUD, Luxury Noir, Notebook, Bauhaus, Clinical, Sport, Cinema, Topographic, Glass Aurora, Clean Product) is picked from the prompt's theme, plus a random layout archetype, signature features and an advanced-GUI checklist. Follow-up edits keep the existing look; say "different style" to reroll.
- Build output cap raised to 8192 tokens (balanced 6144) so first drafts are not cut off mid-file.

## Web search now 1 credit
- Live web search billed at about 1 credit per search (was 3.5); minimum balance to allow it is 2. App labels and worker (live-patched) updated.

## Worker - build replies never capped at 4096
- The worker raises the output cap to 8192 (6144 in Eco) whenever the prompt carries the build rulebook, so older cached pages no longer get cut-off drafts. Live-patched.

## Output limits x3 (node v24)
- Max reply tokens: Eco 4,500, Balanced 12,288, Thorough/Turbo 24,576; builds up to 24,576 (Eco 18,432). Mac context window 32K on 32 GB+ Macs with flash attention and a q8 KV cache so long replies fit.

## Smarter build loop
- Free local auto-fix: a file that is complete but missing a closing fence or </body></html> is repaired locally with no model call.
- If a continue pass restarts the whole file, the new full version replaces the cut-off one instead of being appended (no duplicated code).
- Every reply that needed repairs ends with a "What the loop did" note in plain language.

## Marketplace - sellers keep 100%
- Platform fee set to 0: when user B buys user A's app/game/site, A receives the full price in credits, instantly, in the backend (no manual token sending). The app shows "Sellers keep 100%".
- Payment is now safe: if crediting the seller fails, the buyer is refunded automatically. Buy responses show the true balance.
- Tested end to end on the live cloud with temporary accounts (buyer 5 -> 4, seller 0 -> 1, repeat click did not charge twice); test data removed. Worker live-patched.

## Rich message formatting
- New markdown renderer for every reply: headings in different sizes (# to ####), bold, italic, bold-italic, inline code, links and auto-links, bullet and numbered lists with nesting and task boxes, block quotes, horizontal rules and tables.
- Claude-style typography for assistant messages (larger line height, accent-coloured bullets and numbers, table and quote styling).
- The chat rule now asks the model to structure longer answers with headings, bold lead-ins, bullets, steps and tables; short replies stay short.

## Cleaner replies
- Removed the "+1" badge on the WEB button and the generic suggestion buttons under replies.
- Replies must be specific to the exact message (no generic advice or boilerplate) and follow the selected depth mode (Eco / Balanced / Thorough) and any enabled mode (WEB, EVAL, TARGET, ASK, COUNCIL). Tier style hints now allow headings, bullets and bold.

## Premium website builds
- New website design rulebook for every website / landing page request (and TARGET = Website): theme-derived colour palette, mesh-gradient background with glowing orbs, glass cards and floating glass nav, gradient text and glowing buttons, distinctive Google font pairs, bullet-proof centering and responsive type (clamp), SVG illustrations, scroll reveal, FAQ, CTA band and footer. Prevents the logo/headline overlap and oversized mobile text.
- Follow-up edits keep the existing design.
- ALPHA XQ costs 2.5x output credits (covers hidden thinking tokens); app estimate updated.
- Billing audit: API calls with an XQ model id now get the 49K cap, thinking and the 2.5x output rate on node and stream paths; the browser-to-node charge route applies it too.

## Launchers hardened + XQ button (node v27)
- New XQ button next to ECO / BALANCED / THOROUGH: one tap selects ALPHA XQ on the Thorough tier; tapping another mode returns to your previous persona.
- Start AIX Node: keeps the Mac awake (caffeinate), auto-updates an old Ollama, checks free disk, retries downloads, proves the model loads and steps the context down if memory is short.
- Update Qwen / AIX MASTER: syntax-check every file before use, back up old copies, retry downloads, disk warning. The node now also refreshes its launchers when it self-updates.
