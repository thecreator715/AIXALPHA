#!/bin/bash
# Opens the AIX Node control panel (no token needed on this Mac).
# If an OLD node is still running (even one a login item keeps restarting from another folder), it is replaced by the one in THIS folder.
cd "$(dirname "$0")"
PORT=8787
PLIST="$HOME/Library/LaunchAgents/com.aix.node.plist"
good() { curl -s -m 2 "http://localhost:$PORT/health" 2>/dev/null | grep -q '"version"'; }
here() { local p; p=$(lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | head -1); [ -n "$p" ] && [ "$(lsof -p "$p" 2>/dev/null | awk '$4=="cwd"{print $9}')" = "$PWD" ]; }
if ! good || ! here; then
  echo "Replacing the old AIX node with the one in this folder…"
  HAD_AUTO=0; [ -f "$PLIST" ] && HAD_AUTO=1
  [ $HAD_AUTO = 1 ] && launchctl unload "$PLIST" 2>/dev/null     # stop the login item from respawning the old copy
  pkill -f "Start AIX Node" 2>/dev/null                           # old watchdog loops
  OLD=$(lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null); [ -n "$OLD" ] && kill $OLD 2>/dev/null
  pkill -f "cloudflared tunnel" 2>/dev/null
  sleep 3
  if [ $HAD_AUTO = 1 ]; then
    bash "./Install AutoStart.command" --silent                   # re-point the login item at THIS folder and start it
  else
    osascript -e 'tell application "Terminal" to do script "cd \"'"$PWD"'\" && ./\"Start AIX Node.command\""' >/dev/null 2>&1
  fi
  for i in $(seq 1 60); do good && break; sleep 2; done
fi
open "http://localhost:$PORT/?v=$(date +%s)"
