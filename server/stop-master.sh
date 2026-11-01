#!/usr/bin/env bash
# Closes every previous AIX master node connection: always-on agent, old server, old tunnels.
cd "$(dirname "$0")" || exit 1
PORT=$(grep -E '^PORT=' .env.local 2>/dev/null | cut -d= -f2); PORT=${PORT:-3000}
PL="$HOME/Library/LaunchAgents/com.aix.alpha.plist"
[ -f "$PL" ] && launchctl unload "$PL" 2>/dev/null
TS=$(command -v tailscale || ls /Applications/Tailscale.app/Contents/MacOS/Tailscale 2>/dev/null); [ -n "$TS" ] && "$TS" funnel reset >/dev/null 2>&1
pkill -f "cloudflared tunnel --url http://localhost:$PORT" 2>/dev/null
pkill -f "tsx server.ts" 2>/dev/null
PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null); [ -n "$PIDS" ] && kill $PIDS 2>/dev/null
sleep 1; PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null); [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null
echo "Previous AIX connections closed (port $PORT is free)."
