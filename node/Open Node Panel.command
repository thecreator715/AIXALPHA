#!/bin/bash
# Opens the AIX Node control panel (no token needed on this Mac). Restarts the node if an OLD version is still running.
cd "$(dirname "$0")"
PORT=8787
if ! curl -s -m 2 "http://localhost:$PORT/health" 2>/dev/null | grep -q '"build":3'; then
  OLD=$(lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null)
  [ -n "$OLD" ] && { echo "Stopping the old node ($OLD)…"; kill $OLD 2>/dev/null; sleep 2; }
  osascript -e 'tell application "Terminal" to do script "cd \"'"$PWD"'\" && ./\"Start AIX Node.command\""' >/dev/null 2>&1
  for i in $(seq 1 60); do curl -s -m 1 "http://localhost:$PORT/health" 2>/dev/null | grep -q '"build":3' && break; sleep 2; done
fi
open "http://localhost:$PORT/?v=$(date +%s)"
