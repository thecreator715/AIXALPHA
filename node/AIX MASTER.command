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

step "1/7  Stopping anything left over from earlier runs"
PLIST="$HOME/Library/LaunchAgents/com.aix.node.plist"
OLD="$HOME/Library/LaunchAgents/com.aix.alpha.plist"; [ -f "$OLD" ] && { launchctl unload "$OLD" 2>/dev/null; rm -f "$OLD"; }   # retired Anthropic master agent
[ -f "$PLIST" ] && launchctl bootout gui/$(id -u) "$PLIST" 2>/dev/null
pkill -f "Start AIX Node.command" 2>/dev/null
pkill -f "AIX Node" 2>/dev/null
pkill -f "node server.js" 2>/dev/null
pkill -f "runtime/empty.yml" 2>/dev/null
PIDS=$(lsof -ti tcp:$PORT 2>/dev/null); [ -n "$PIDS" ] && kill $PIDS 2>/dev/null
sleep 2
PIDS=$(lsof -ti tcp:$PORT 2>/dev/null); [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null
rm -f .aix-public-url tunnel.log
lsof -ti tcp:$PORT >/dev/null 2>&1 && bad "port $PORT is still busy; restart the Mac and run this again" || ok "port $PORT is free, old node and tunnel stopped"

step "2/7  Internet and cloud"
curl -fs -m 10 -o /dev/null https://aix-alpha.aixalpha.workers.dev/api/config && ok "AIX cloud answers" || warn "cloud did not answer (check your internet); the node will still start"

step "3/7  Cloud secret (lets this Mac register and lets the control panel load data)"
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

step "4/7  Files and media engines"
for f in "Start AIX Node.command" server.js monitor.html; do [ -f "$f" ] && ok "$f" || bad "$f is missing; re-extract the zip"; done
for f in ./*.command; do bash -n "$f" 2>/dev/null || bad "$f has a syntax problem; run Update Qwen.command to refresh it"; done
command -v node >/dev/null 2>&1 && ! node --check server.js 2>/dev/null && bad "server.js has a syntax problem; run Update Qwen.command"
FREEGB=$(df -g / 2>/dev/null | awk 'NR==2{print $4}'); [ -n "$FREEGB" ] && [ "$FREEGB" -lt 25 ] && warn "only ${FREEGB} GB of disk free; the models need about 25 GB" || ok "disk space ${FREEGB:-?} GB free"
chmod +x ./*.command 2>/dev/null; xattr -dr com.apple.quarantine . 2>/dev/null
command -v node >/dev/null 2>&1 && ok "Node.js $(node -v)" || warn "Node.js will be set up automatically"

step "4a  Latest node and control panel from GitHub (Insights tab, Enterprise switch, Qwen Fast)"
RAWU="https://raw.githubusercontent.com/thecreator715/AIXALPHA/main/node"
CUR=$(grep -o 'VERSION = [0-9]*' server.js | head -1 | grep -o '[0-9]*$')
if curl -fs -m 25 -o /tmp/aix-server-new.js "$RAWU/server.js" 2>/dev/null && [ -s /tmp/aix-server-new.js ]; then
  NEW=$(grep -o 'VERSION = [0-9]*' /tmp/aix-server-new.js | head -1 | grep -o '[0-9]*$')
  if [ -n "$NEW" ] && [ "${NEW:-0}" -gt "${CUR:-0}" ]; then
    if command -v node >/dev/null 2>&1 && ! node --check /tmp/aix-server-new.js 2>/dev/null; then warn "the new server.js did not pass its syntax check; keeping v$CUR"
    else cp server.js server.js.bak 2>/dev/null; cp /tmp/aix-server-new.js server.js && ok "updated server.js v$CUR -> v$NEW (old copy kept as server.js.bak)"
      curl -fs -m 25 -o /tmp/aix-monitor.new "$RAWU/monitor.html" 2>/dev/null && [ -s /tmp/aix-monitor.new ] && cp /tmp/aix-monitor.new monitor.html; fi
  else ok "server.js is up to date (v${CUR:-?})"; fi
  rm -f /tmp/aix-server-new.js /tmp/aix-monitor.new
else warn "could not reach GitHub, staying on v${CUR:-?}"; fi

step "4b  Image and video engines (Qwen-Image 2.1 and LTX-2.5)"
media_one(){   # $1 label  $2 config file  $3 skip file  $4 installer  $5 disk GB  $6 log
  if [ -s "$2" ] && grep -q '"ok": *true' "$2" 2>/dev/null; then ok "$1 is ready"
  elif [ -f "$3" ]; then warn "$1 is switched off (delete $3 to enable)"
  else
    warn "$1 is not installed yet (the cloud falls back to its free queue)"
    FG=$(df -g . 2>/dev/null | awk 'NR==2{print $4}')
    if [ -n "$FG" ] && [ "$FG" -lt "$5" ]; then echo "     needs about $5 GB free, you have ${FG} GB. Free some space, then run this again."
    else printf "     Install it now? Needs about %s GB and a long first download. [y/N] " "$5"; read -r -n 1 A; echo
      [ "$A" = "y" ] || [ "$A" = "Y" ] && { bash "./$4" </dev/null; [ -s "$2" ] && ok "$1 installed" || { bad "$1 install did not pass its test; details in $6"; tail -8 "$6" 2>/dev/null | sed 's/^/     /'; }; }
    fi
  fi
}
media_one "Image engine (Qwen-Image 2.1)" .aix-image .aix-image-skip "Install Qwen Image.command" 45 runtime/image-install.log
media_one "Video engine (LTX-2.5)" .aix-video .aix-video-skip "Install Local Video.command" 70 runtime/video-install.log
[ -s .aix-video ] && ok "video: $(grep -o '"label": *"[^"]*"' .aix-video | head -1 | cut -d'"' -f4) | 1 credit per second, 5 minimum | length and quality are set in the app's VIDEO row"
echo "     Control panel: open the Media tab to repair, turn on or off, and watch installs."


step "5/7  Auto-start at login (optional)"
if [ -f "$PLIST" ]; then ok "auto-start is installed (it will be restarted fresh)"; else
  printf "     Install auto-start so everything launches by itself at login? [y/N] "; read -r -n 1 A; echo
  [ "$A" = "y" ] || [ "$A" = "Y" ] && bash "./Install AutoStart.command" </dev/null
fi

cloud_wait(){   # confirm the cloud really sees this Mac (tunnel up + registered), up to ~2.5 minutes
  step "7/7  Checking that the cloud sees this Mac"
  for i in $(seq 1 50); do
    J=$(curl -fs -m 8 "$WORKER/api/node/status" 2>/dev/null)
    echo "$J" | grep -q '"online":true' && echo "$J" | grep -o '"ageSec":[0-9]*' | head -1 | grep -qE '"ageSec":([0-9]|[1-5][0-9]|6[0-9])$' && { ok "the cloud sees this Mac: every app (phone, GitHub site, artifact) can now use it"; return 0; }
    [ $((i % 5)) = 0 ] && printf "     still connecting (%ss)...\n" $((i*3))
    sleep 3
  done
  warn "the cloud does not see this Mac yet. Tunnel log:"; tail -6 tunnel.log 2>/dev/null | sed 's/^/     /'; echo "     Node log:"; tail -6 node.log 2>/dev/null | sed 's/^/     /'
  echo "     Chat on THIS Mac still works. Run this file again, or send those lines to Claude."
}
step "6/7  Starting AIX Node, tunnel and model"
echo "     The control panel opens in your browser. Keep this window open."
if [ -f "$PLIST" ]; then
  bash "./Install AutoStart.command" --silent >/dev/null 2>&1   # rewrites the agent so it points at THIS folder
  echo "     Auto-start service restarted. Waiting for the panel (up to 60 s)..."
  for i in $(seq 1 60); do curl -fs -m 2 http://localhost:$PORT/ >/dev/null 2>&1 && break; sleep 1; done
  if curl -fs -m 2 http://localhost:$PORT/ >/dev/null 2>&1; then
    open "http://localhost:$PORT/?v=$(date +%s)"
    cloud_wait; echo "     Running in the background (log: node.log). You can close this window."; sleep 5; exit 0
  fi
  printf "  ${R}FIX${N}  the background service did not start. Last log lines:\n"; tail -8 node.log 2>/dev/null | sed 's/^/     /'
  echo "     Starting directly in this window instead (keep it open)."
  launchctl unload "$PLIST" 2>/dev/null
fi
exec "./Start AIX Node.command"
