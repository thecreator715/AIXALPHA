#!/bin/bash
# AIX MASTER: one double-click. Stops every old AIX process, checks the cloud link, repairs what is wrong, then starts everything fresh.
cd "$(dirname "$0")" || exit 1
WORKER="https://aix-alpha.aixalpha.workers.dev"; PORT=8787
G="\033[1;32m"; R="\033[1;31m"; Y="\033[1;33m"; C="\033[1;36m"; N="\033[0m"
ok(){ printf "  ${G}OK${N}   %s\n" "$1"; }; bad(){ printf "  ${R}FIX${N}  %s\n" "$1"; }; warn(){ printf "  ${Y}NOTE${N} %s\n" "$1"; }
step(){ printf "\n${C}==> %s${N}\n" "$1"; }
printf "${C}AIX MASTER${N}  %s\n" "$(date)"

# macOS blocks background agents from Downloads/Desktop/Documents, which makes auto-start hang. Run from a normal folder instead.
case "$PWD" in
  "$HOME"/Downloads/*|"$HOME"/Desktop/*|"$HOME"/Documents/*)
    DEST="$HOME/AIX-Node"
    printf "${Y}NOTE${N} Moving the node to %s (macOS blocks auto-start inside Downloads, Desktop and Documents)\n" "$DEST"
    mkdir -p "$DEST" && rsync -a --exclude runtime ./ "$DEST"/ && chmod +x "$DEST"/*.command && xattr -dr com.apple.quarantine "$DEST" 2>/dev/null
    [ -f "$DEST/AIX MASTER.command" ] && exec "$DEST/AIX MASTER.command" ;;
esac

step "1/6  Stopping anything left over from earlier runs"
PLIST="$HOME/Library/LaunchAgents/com.aix.node.plist"
OLD="$HOME/Library/LaunchAgents/com.aix.alpha.plist"; [ -f "$OLD" ] && { launchctl unload "$OLD" 2>/dev/null; rm -f "$OLD"; }   # retired Anthropic master agent
[ -f "$PLIST" ] && launchctl bootout gui/$(id -u) "$PLIST" 2>/dev/null
pkill -f "Start AIX Node.command" 2>/dev/null
pkill -f "AIX Node" 2>/dev/null
pkill -f "node server.js" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
PIDS=$(lsof -ti tcp:$PORT 2>/dev/null); [ -n "$PIDS" ] && kill $PIDS 2>/dev/null
sleep 2
PIDS=$(lsof -ti tcp:$PORT 2>/dev/null); [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null
rm -f .aix-public-url tunnel.log
lsof -ti tcp:$PORT >/dev/null 2>&1 && bad "port $PORT is still busy; restart the Mac and run this again" || ok "port $PORT is free, old node and tunnel stopped"

step "2/6  Internet and cloud"
curl -fs -m 10 -o /dev/null https://aix-alpha.aixalpha.workers.dev/api/config && ok "AIX cloud answers" || warn "cloud did not answer (check your internet); the node will still start"

step "3/6  Cloud secret (lets this Mac register and lets the control panel load data)"
if [ ! -s .aix-node-secret ]; then
  bad ".aix-node-secret is missing in this folder"
  echo "     Paste the node secret from Cloudflare (or the one Claude gave you) and press Return:"
  read -r NS; NS=$(printf %s "$NS" | tr -d '[:space:]')
  [ -n "$NS" ] && printf '%s\n' "$NS" > .aix-node-secret && chmod 600 .aix-node-secret
fi
if [ -s .aix-node-secret ]; then
  NS=$(tr -d '[:space:]' < .aix-node-secret)
  CODE=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -H "x-node-secret: $NS" "$WORKER/api/node/admin?what=config")
  case "$CODE" in
    200) ok "secret accepted by the cloud" ;;
    401) bad "the cloud rejected this secret (wrong or old). Put the current value in .aix-node-secret and run again." ;;
    *)   warn "cloud check returned HTTP $CODE; continuing" ;;
  esac
else bad "no secret, so cloud registration and the cloud panel tabs stay off"; fi

step "4/6  Files"
for f in "Start AIX Node.command" server.js monitor.html; do [ -f "$f" ] && ok "$f" || bad "$f is missing; re-extract the zip"; done
chmod +x ./*.command 2>/dev/null; xattr -dr com.apple.quarantine . 2>/dev/null
command -v node >/dev/null 2>&1 && ok "Node.js $(node -v)" || warn "Node.js will be set up automatically"

step "5/6  Auto-start at login (optional)"
if [ -f "$PLIST" ]; then ok "auto-start is installed (it will be restarted fresh)"; else
  printf "     Install auto-start so everything launches by itself at login? [y/N] "; read -r -n 1 A; echo
  [ "$A" = "y" ] || [ "$A" = "Y" ] && bash "./Install AutoStart.command" </dev/null
fi

step "6/6  Starting AIX Node, tunnel and model"
echo "     The control panel opens in your browser. Keep this window open."
if [ -f "$PLIST" ]; then
  bash "./Install AutoStart.command" --silent >/dev/null 2>&1   # rewrites the agent so it points at THIS folder
  echo "     Auto-start service restarted. Waiting for the panel (up to 60 s)..."
  for i in $(seq 1 60); do curl -fs -m 2 http://localhost:$PORT/ >/dev/null 2>&1 && break; sleep 1; done
  if curl -fs -m 2 http://localhost:$PORT/ >/dev/null 2>&1; then
    open "http://localhost:$PORT/?v=$(date +%s)"
    echo "     Running in the background (log: node.log). You can close this window."; sleep 5; exit 0
  fi
  printf "  ${R}FIX${N}  the background service did not start. Last log lines:\n"; tail -8 node.log 2>/dev/null | sed 's/^/     /'
  echo "     Starting directly in this window instead (keep it open)."
  launchctl unload "$PLIST" 2>/dev/null
fi
exec "./Start AIX Node.command"
