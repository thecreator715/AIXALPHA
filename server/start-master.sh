#!/usr/bin/env bash
# AIX ALPHA master node: runs the server on this machine. Mac / Linux.
#   ./start-master.sh            local only      -> http://localhost:3000/alpha
#   ./start-master.sh --public   also opens a free public https tunnel (needs cloudflared)
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Node 20+ is required: https://nodejs.org"; exit 1; }
if [ ! -f .env.local ]; then
  read -rp "Paste your Anthropic API key (sk-ant-...): " KEY
  ADMIN=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
  cat > .env.local <<ENV
ANTHROPIC_API_KEY="$KEY"
AIX_ADMIN_TOKEN="$ADMIN"
AIX_ALLOWED_ORIGINS="*"
AIX_SIGNUP_CREDITS=0
AIX_DATA_DIR="data"
PORT=3000
ENV
  echo "Saved .env.local. Your admin token: $ADMIN  (keep it; it grants credits and exports users.md)"
fi
[ -d node_modules ] || npm install --no-audit --no-fund
export NODE_ENV=production
PORT=$(grep -E '^PORT=' .env.local | cut -d= -f2); PORT=${PORT:-3000}
if [ "$1" = "--public" ]; then
  if command -v cloudflared >/dev/null; then
    ( cloudflared tunnel --url "http://localhost:$PORT" 2>&1 | grep --line-buffered -o 'https://[a-z0-9-]*\.trycloudflare\.com' | while read -r U; do echo ""; echo "  PUBLIC MASTER NODE: $U/alpha"; done ) &
  else
    echo "cloudflared not found. Install it (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for a public URL."
  fi
fi
echo "AIX ALPHA master node starting on http://localhost:$PORT/alpha"
exec npx tsx server.ts
