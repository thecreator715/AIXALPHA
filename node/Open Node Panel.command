#!/bin/bash
# Opens the AIX Node control panel, already connected. Starts the node first if it isn't running.
cd "$(dirname "$0")"
PORT=8787
TOKEN=$(cat .aix-token 2>/dev/null)
if ! curl -s -m 2 "http://localhost:$PORT/health" >/dev/null 2>&1 && ! curl -s -m 2 "http://localhost:$PORT/" >/dev/null 2>&1; then
  osascript -e 'tell application "Terminal" to do script "cd \"'"$PWD"'\" && ./\"Start AIX Node.command\""' >/dev/null 2>&1
  for i in $(seq 1 60); do curl -s -m 1 "http://localhost:$PORT/" >/dev/null 2>&1 && break; sleep 2; done
fi
open "http://localhost:$PORT/#token=$TOKEN"
