# AIX Alpha v3.0 - revision 8

## Faster images: Qwen Fast and a realistic first estimate (node v45)
- Why it got slower: Qwen-Image runs on your Mac at 20 steps (40 in Thorough/XQ) and takes a few minutes. The cloud FLUX engine answers in seconds, so images felt instant whenever the Mac was not used.
- New choice in the image model menu: "Qwen Fast" (1 credit). It renders 8 steps at up to 768 px on the Mac, about a minute, and is then upscaled to the size you picked.
- FLUX stays the seconds option, Qwen-Image 2.1 stays the best-quality option.
- The first-time estimate for Qwen was 30 s; it now starts at about 4 min for Qwen, 70 s for Fast, 8 min for HQ, and learns from your last five renders.

## Fix: "Load failed" on image mode, and a real progress meter (node v44)
- Cause: the image route sent nothing back until the picture was finished, which can take minutes with Qwen-Image on the Mac. Mobile Safari drops a silent connection after a while and reports "Load failed". Video never had this because it streams progress.
- The Mac node (v44) now streams image progress: engine step n of N, percent and time left, with a line every 2 s. The server relays it with a heartbeat every 8 s, so the connection stays alive however long the render takes.
- The image card in chat shows the real stage ("Loading the image model", "Rendering step 6 of 16"), a live percent, time left from the measured step rate, and a warning if no update arrives for 12 s. Without node progress (cloud engine) it falls back to an estimate from your last five renders.
- The server stops waiting on the Mac after 60 s of silence (was a fixed 170 s) and falls back to the cloud engine; it waits as long as the Mac keeps reporting progress, up to 8 minutes (11 in Thorough/XQ).
- Credits are only kept if the picture is delivered. If the phone drops the connection, the credit is refunded automatically.
- If the connection does drop, the message now says so plainly instead of "Load failed".
- Update the Mac node (Update Qwen or restart Start AIX Node) to get step-by-step progress; an older node still works, with the estimate meter.

## Fix: sign-in and sign-up blocked by CORS (x-device header)
- The device id header added for the free-credit check was not on the server's allowed-headers list, so browsers refused every sign-in/sign-up request before it was sent. `x-device` and `x-aix-device` are now allowed. No app update needed.

## Admin sign-in with email
- Sign in now accepts the account email as well as the username, so the owner can sign in on the live site with divercityrecords@gmail.com (the `admin` username still works). The sign-in box is a plain text field again so usernames are not rejected.

## Sign-up: 3 free credits, real email required, no duplicates or piggybacking
- Every new account gets 3 free credits (was 1, set by a server setting). Creating an account now requires a valid email address; usernames still work to sign in for existing accounts.
- No duplicates: emails are compared in canonical form, so `Name+tag@gmail.com`, `n.a.m.e@gmail.com` and `googlemail.com` count as the same address as `name@gmail.com`; an email that already has an account is refused.
- No piggybacking: the 3 free credits are given once per device and once per network (IP) per 30 days; further accounts from the same device or network can still be created but get 0 free credits, and the app says why. Disposable email domains (mailinator, yopmail and similar) are rejected. The sign-up form now sends the device id so the device check works.
- Note: emails are not verified by a confirmation link yet (needs an email-sending service).

## Video limits: 8 s for everyone, longer needs Enterprise; one clip at a time
- Lengths over 8 seconds (10 s up to 1 min) are shown greyed out with a lock and "Enterprise only" until the account has an active Enterprise membership (owner/admin always unlocked). A notice with a "Get Enterprise" button sits next to the Length menu; a saved longer length falls back to 8 s.
- The server enforces it too (403 "needs an Enterprise membership"), so it cannot be bypassed from the console.
- One video at a time per account: a second request while one is rendering is refused with a clear message and the credits are refunded; the lock clears when the clip finishes, fails or is cancelled (and expires after 90 min at the latest). Admin is exempt.

## Video follows your words + faster (node v43)
- A short prompt like "a bird flying in the jungle a Red Robin" made LTX invent a random face: the prompt rewrite was timing out and the raw words went straight to the model. The rewrite now uses the 70B model first (8B second, 12 s each) and always has a built-in fallback that expands the prompt into a full cinematic description. It names the subject concretely, turns "multiple scenes / cuts" into one continuous moving shot (one clip cannot cut), and never adds people or faces unless asked. The "Prompt used" line under the clip shows exactly what the engine got.
- Speed: `--low-ram` (slow memory swapping) is left off when 26 GB or more is free after the chat model unloads, with one automatic retry in low-memory mode if that fails; the 1080p sharpen step uses ffmpeg veryfast. Set `AIX_VID_LOWRAM=1` to always use low-ram.
- For the closest match to your words use Better or Best quality (Fast is 8 quick steps and follows text loosely).

## Video errors after cancel / retry (node v42)
- Cause: cancelling killed only the launcher (uv); the python engine under it kept rendering, so the next clip ran out of memory or found the node busy and failed with "Local video is busy or offline". The node now starts the engine in its own process group and kills the whole group on cancel, timeout, stall or exit, and clears any leftover engine before a new render starts.
- A cancelled clip that was still waiting in line frees its place immediately (a few cancels could previously fill the 2-clip queue).
- The error message now includes the real reason from the node instead of the generic "busy or offline", and a "previous clip still stopping" tip for the queue case.

## Is it working or hung? Live engine health (node v41)
- The render card now shows a pulsing "Working" light with the engine's real CPU and memory use and the time since its last output, the engine's latest log line, and clear amber/red warnings: engine quiet, probably stuck (CPU idle and silent 10+ min), or no update from the server (connection lost).
- The node only restarts a silent engine if its CPU is also idle, so a long quiet decode is never killed by mistake.

## Video queue fix: stuck "Waiting in line" (node v40)
- Cause: an older engine process (left running after a node auto-restart, or a render whose app tab was closed) kept the queue and all the RAM, so new clips waited behind it forever.
- The node now stops stray engines on start, cancels a render when the app disconnects (the worker passes that through), drops older queued clips from the same user, and restarts an engine that is silent for 20 minutes. Hard time limit cut from 3.3 h to 3 h max.
- Real RAM reading (macOS vm_stat) instead of the misleading 0.1 GB; waiting card shows the progress of the render ahead.
- Cancel render button on the card and "Cancel all video renders and stop stuck engines" in the Media tab.

## Live video progress, time left and render data (node v39)
- Video replies in chat now show a live card while the clip renders: stage (loading, reading prompt, drawing, refining, decoding, sound, writing, upscale), percent bar, time elapsed, time left and finish clock time, clip data (length, frames, fps, size, quality), step count and free Mac RAM.
- The node learns real timings (`.aix-vidstats.json`): the first estimate is rough and labelled so, later ones get exact.
- Finished clips say how long they took, credits used, balance and the prompt actually used; failures show a plain-language tip.
- Old nodes or the artifact still work: the card just shows elapsed time.

## Node control Media tab, MASTER update, artifact sign-in note (node v38)
- New **Media (image + video)** tab in the node control panel: status of Qwen-Image 2.1 and LTX-2.5, install/repair buttons with live log, turn on/off, quality tiers found, image-to-video support, clip frame count, queue, disk free, prices and limits. Backed by new `/admin/media` endpoints on the node. `node-control.html` is refreshed to the same panel.
- `AIX MASTER.command` gains a media step: reports both engines, offers to install a missing one (checks free disk first), prints the failing log lines if a test does not pass.
- The claude.ai artifact preview cannot reach the AIX server (the sandbox blocks all outside network requests), so sign-in there can never work. The account button now says so and links to the live site.
- `docs/COMMANDS.md` lists every command, including the two installers, Update Qwen and the Media tab.

## Video length and shape options (node v34)
- Turning on Video mode shows two menus in the chat toolbar: length (2, 4, 6, 8, 10, 15, 20, 30, 45 s, 1 min) and shape (Landscape 768x512, Wide 1024x576, Portrait, Tall, Square). Choices are remembered.
- Pricing: 1 credit per second, 5 credits minimum (2 s to 5 s = 5, 10 s = 10, 1 min = 60). Charged up front, refunded on failure, free for admin. Constants: `VIDEO_CR` / `vidCost()` in the worker and app.
- Maximum is 1 minute per clip. Clips over 2 s need the Mac node (the free cloud queue only does about 2 s); the worker says so before charging. The node picks the frame count (8n+1 at 24 fps) and scales its timeout with length. Long clips can take an hour or more and may run out of memory on 32 GB; shorter lengths are the safe choice.
- The start image is cropped to the chosen shape.
- Pricing changed to 1 credit per second (5 minimum). Options now live in a green VIDEO row above the message box.
- Freshness guard (node v37): the web app carries a build id (`APP_BUILD`) and, when served over http(s) outside claude.ai, fetches itself uncached and reloads once if a newer build is on GitHub Pages. Fixes the live site showing an old copy (no video row) after an update; a one-time hard refresh (Cmd+Shift+R) is needed to pick up the guard itself. Installer message now says 1 credit per second.
- Node v36 (quality): (1) "Animate this picture" now uses the picture already in the chat as the start frame (before, it made a different image, so the clip did not match). (2) Quality menu: Fast (distilled), Better (full-guidance two-stage, about 3x slower, default) and Best (HQ sampler, about 4x slower); the installer records which tiers the engine supports. (3) AI-enhance prompt: the worker rewrites a short request into a detailed cinematic LTX prompt (Workers AI, free fallback to your own words). (4) Sharpen + upscale to 1080p and HD shapes.
- Node v35: two HD shapes (1280x704 landscape, 704x1280 portrait; slow, memory heavy) and a 'Sharpen + upscale to 1080p' switch (on by default): after rendering, ffmpeg upscales with Lanczos and light sharpening. No extra credits.

## Local video upgraded to LTX-2.5 (node v33)
- Cause of the failed install: `uv tool install ltx-2-mlx` does not work (the engine is not a published package). The installer now clones the engine, runs `uv sync` (Python 3.12) and runs it with `uv run --project`.
- Default is LTX-2.5 (22B, 8-bit MLX, `MrMofer/ltx-2.5-mlx-q8`, runtime branch `ltx25` pinned to a known commit). If it fails the self-test, LTX-2.3 (`dgrauet/ltx-2.3-mlx-q4`) is tried automatically; if both fail, video stays on the cloud queue.
- The installer reads `generate --help` and records the real flag names in `.aix-video` (`flags`), so the node adapts to the engine instead of guessing. Clips are 49 frames at 24 fps (2 s); `nframes` in `.aix-video` can be raised (8n+1, e.g. 97).
- Needs about 70 GB free (the 2.5 model repo is 59 GB). Everything is logged to `runtime/video-install.log`.

## Local video with LTX-2.3 (node v32)
- Video now runs on the Mac node first: Lightricks LTX-2.3 (4-bit, Apple MLX through ltx-2-mlx). Text-to-video, or image-to-video with a start image, with sound. 3 credits per clip (free for admin, refunded on failure). If the node is offline, busy or the clip fails and an image was given, the free cloud queue is the backup.
- `Install Local Video.command` installs uv, ffmpeg and the engine, downloads the model once (about 30 GB), self-tests, and writes `.aix-video`. `Start AIX Node.command` runs the image and video installers one after the other in the background on first start; `Update Qwen.command` refreshes both. Switch off with `.aix-video-skip`.
- The node unloads the chat model before an image or video render (it reloads on the next chat) because the engines need most of a 32 GB Mac. Set `AIX_UNLOAD=0` to disable.
- Long renders keep the connection alive (a space every 15-20 s), then return the clip. Chat video requests without a picture now try text-to-video first, and only make a start image if the node has no local video.
- PDF dossier updated with revision 8 images, sizes, video and fixes.
- Expect minutes per clip on an M2 Max with 32 GB; command flags were not verified on real hardware, so the installer self-tests.

## Mobile touch fixes
- Taps always register on phones: pointer cursor on touch devices (iOS ignores taps on plain elements otherwise), touch-action on buttons, hidden side panels no longer take part in hit-testing.
- Inputs use 16px text on phones so iOS no longer zooms the page when you tap a field (a zoomed page made icons look dead).
- Tapping the dim area behind any pop-up closes it, and a pop-up that is open but empty or off-screen is closed automatically so it can never freeze the page.

## Image sizes + JPEG downloads (node v31)
- Every image download (gallery pop-up and chat "Save image") now produces a real JPEG. The old button guessed the type by searching the image data for "svg", which could wrongly save an .svg.
- Image size/shape: Settings -> Images sets the default; a size menu sits next to the image-model menu; or just ask ("4K ultra wide", "iPhone screen", "portrait", "wide angle landscape"). Presets: square, landscape, wide 16:9, 4K UHD, ultra wide 21:9, 4K ultra wide (5120x2160), portrait, tall 9:16, iPhone screen, phone wallpaper 4K, fast draft.
- The model renders at the right shape (about 1 megapixel); sizes above that are enlarged smoothly, so 4K output is upscaled, not natively rendered. Credits are unchanged.

## Hang fix, Max removed (node v30)
- XQ no longer routes to Qwen3.8-Max: XQ runs on the Mac node again, as before (the cloud route and DASHSCOPE key support were removed).
- Hang: hidden "thinking" could run up to 24,000 characters (several minutes) before the first word appeared. Budget is now 6,000 characters, and XQ build/code requests skip thinking (the build method is already in the prompt), so output starts in seconds.
- Launcher no longer double-wraps the model name (aix-alpha-aix-alpha-...) when a wrapped name is left in the environment.
- Qwen-Image 2.1 changes (default image model, 1 cr / 2.5 cr) are unchanged.

## Qwen-Image 2.1 default + XQ on Qwen3.8-Max (node v29)
- **Qwen-Image 2.1** (7B, via mflux on the Mac node) is now the default image model: **1 credit** per image, **2.5 credits** (40 steps instead of 20, higher quality) in Thorough and XQ. FLUX.1 (1 cr) and FLUX.2 (3 cr) stay selectable. If no node has the model or a run fails, the same price buys FLUX on Workers AI, so image requests never fail.
- `Install Qwen Image.command` installs uv + mflux, downloads the weights once (about 33 GB), self-tests and writes `.aix-image`. `Start AIX Node.command` runs it in the background the first time; `Update Qwen.command` refreshes it. Switch off with a `.aix-image-skip` file.
- Node endpoint `POST /v1/images/generate` (token protected, one image at a time, queue of 3).
- **XQ on Qwen3.8-Max**: when the worker secret `DASHSCOPE_API_KEY` is set, XQ chats go to Alibaba Cloud's qwen3.8-max (32,768-token output cap); the Mac node is the automatic fallback. Billed at about 1.5x Alibaba's price (Haiku-equivalent tokens x24 in, x18 out). User email is not sent to Alibaba.
- Licence note: Qwen-Image-2.1 weights use the Qwen Research License (non-commercial). Selling credits for images from the local model is a commercial use; check the licence or switch the default to FLUX/the hosted API.

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

## Fix: cloud 500 / "Register failed: HTTP 500"
- A live worker update dropped the D1 database binding (DB), so every database call returned HTTP 500 (control panel tabs, node registration, balances). Binding, AI binding and variables restored from wrangler.toml. Always deploy with `wrangler deploy` (it re-applies bindings) or re-apply bindings after a live content patch.

## Build reliability, ALPHA XQ (node v28)
- Node: stream headers and a heartbeat are sent immediately (long prompt processing or thinking can no longer look like a dead connection); closing the browser or worker connection now cancels the model run so the next request never queues behind it; hidden reasoning is budgeted (24,000 chars, AIX_THINK_MAX) and, if exceeded, the run restarts once with thinking off so the build is always delivered.
- Worker: forwards heartbeats and "thinking" progress, reports max_tokens truncation on the node path (the app now continues cut-off builds instead of calling them complete), surfaces node errors, no thinking on continue/refine passes.
- App: stalled or dropped streams (2 min of silence) end cleanly and are continued instead of hanging; partial builds are kept; XQ per-request credit budget raised 4x so long builds are not stopped mid-way.
- PDF dossier updated to revision 8 (ALPHA XQ, Qwen 3.8 / Qwen 4 plan, limits, billing, reliability, launchers).
