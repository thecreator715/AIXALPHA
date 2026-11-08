# AIX Alpha: every command, in one place

Everything lives in the GitHub repo `thecreator715/AIXALPHA`. The live app is https://thecreator715.github.io/AIXALPHA/ and the cloud backend is https://aix-alpha.aixalpha.workers.dev.

## On your Mac (the Alpha node)
Unzip the package, open the `node` folder, and double-click:

| File | What it does |
|---|---|
| `AIX MASTER.command` | One double-click fix-everything: stops old AIX processes, checks the cloud link, repairs problems, starts a fresh node. Use this first if anything acts odd. |
| `Start AIX Node.command` | Starts the node, pulls the models (main, the Eco/Balanced ladder, and the vision model for images on Macs with 16 GB+). |
| `Open Node Panel.command` | Opens the node control panel at http://localhost:8787 (replaces any old node still running). |
| `Install AutoStart.command` | Makes the node start at every login and restart if it stops. Run once. |

The node updates itself from GitHub whenever the repo has a higher `VERSION` in `node/server.js` (now 18). To force it: quit the node window and double-click `AIX MASTER.command`.

Terminal equivalents:
```bash
cd ~/path/to/aixalpha/node
bash "AIX MASTER.command"        # repair + restart
bash "Start AIX Node.command"    # start only
node server.js                   # run the server directly (needs Ollama running)
```

## Cloud backend (Cloudflare worker)
```bash
cd worker
bash Deploy-Cloud.command        # first-time deploy, asks for your Cloudflare login and keys
npx wrangler deploy              # redeploy after editing worker/index.js
npx wrangler tail                # live logs
npx wrangler d1 execute aix-alpha-db --remote --file=schema.sql   # create/upgrade base tables
```
The new admin-suite tables are created automatically the first time they are used.

## Website / app
```bash
git pull
# edit index.html (and copy it to artifact/aix-alpha-v3.html), then:
git add -A && git commit -m "your message" && git push   # GitHub Pages updates in about a minute
```

## Admin control panel
Open the node panel (`Open Node Panel.command`) or `node/monitor.html`. Tabs: Live, Fleet, Money, Growth, Safety, Controls. Optional extras: Controls > Admin sign-in (2-step) and Controls > Approvals (two-person approval for big credit grants, refunds and payouts). Both are off until you switch them on.

## Server build (optional, separate from the above)
```bash
cd server && npm install && cp .env.example .env.local && npm run dev && npm test
```

## What changed in this release
- Admin suite 2: 25 new control-panel tools, plus backend speed-ups.
- Web search costs about 3.5 credits and now runs from the cloud (Bing, DuckDuckGo, Google News, CoinGecko), with the Mac as a fallback.
- Images are read by the vision model on the node; drag and drop and paste work in chat.
- One More button in the desktop navigation; mobile menu and chat-input fixes.


## One command for everything (node v19)
Double-click `AIX MASTER.command` in the node folder. It stops old processes, repairs what is wrong, starts the node (which now starts its own secure tunnel), and finally checks that the cloud sees your Mac. Nothing else is needed.
Quick check: `cat .aix-public-url; tail -5 tunnel.log node.log`
