#!/usr/bin/env bash
# AIX ALPHA master node. Closes old connections, verifies the key, starts the server, opens the app in your browser.
#   ./start-master.sh            local   ->  http://localhost:3000/alpha
#   ./start-master.sh --public   also opens a public https tunnel (needs cloudflared)
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Node 20+ is required: https://nodejs.org"; exit 1; }
./stop-master.sh >/dev/null 2>&1
./setup-env.sh || exit 1
[ -d node_modules ] || npm install --no-audit --no-fund
export NODE_ENV=production
PORT=$(grep -E '^PORT=' .env.local | cut -d= -f2); PORT=${PORT:-3000}
URL="http://localhost:$PORT/alpha"
if [ "$1" = "--public" ]; then
  if command -v cloudflared >/dev/null; then
    ( cloudflared tunnel --url "http://localhost:$PORT" 2>&1 | grep --line-buffered -o 'https://[a-z0-9-]*\.trycloudflare\.com' | while read -r U; do echo ""; echo "  PUBLIC MASTER NODE: $U/alpha"; done ) &
  else echo "(cloudflared not installed: running locally only)"; fi
fi
( for i in $(seq 1 40); do sleep 1; if curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    [ -z "$AIX_NO_OPEN" ] && { open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null; }; break; fi; done ) &
echo "AIX ALPHA master node starting on $URL"
exec npx tsx server.ts
