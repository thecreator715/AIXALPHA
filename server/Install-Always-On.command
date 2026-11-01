#!/usr/bin/env bash
# Double-click on Mac: always-on AIX ALPHA master node (starts at login, restarts if it stops), then opens the app.
cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
command -v node >/dev/null || { echo "Node 20+ is required: https://nodejs.org"; exit 1; }
./stop-master.sh >/dev/null 2>&1
./setup-env.sh || exit 1
[ -d node_modules ] || npm install --no-audit --no-fund
PL="$HOME/Library/LaunchAgents/com.aix.alpha.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PL" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.aix.alpha</string>
<key>ProgramArguments</key><array><string>/bin/bash</string><string>-lc</string><string>cd "$DIR" &amp;&amp; AIX_NO_OPEN=1 ./start-master.sh --public</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>$DIR/master.log</string><key>StandardErrorPath</key><string>$DIR/master.log</string>
</dict></plist>
PLIST
launchctl load "$PL"
echo "Starting..."; for i in $(seq 1 40); do sleep 1; curl -fs http://localhost:3000/api/health >/dev/null 2>&1 && break; done
open "http://localhost:3000/alpha"
echo ""; echo "AIX ALPHA master node is always on. App opened in your browser."
echo "Log (public tunnel address appears here): $DIR/master.log"
echo "Stop everything: double-click Stop-Master.command"
