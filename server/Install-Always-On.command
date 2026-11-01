#!/usr/bin/env bash
# Double-click on Mac: makes the AIX ALPHA master node start at login and restart if it ever stops.
cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
# First-time setup (asks for your API key once, installs packages)
if [ ! -f .env.local ] || [ ! -d node_modules ]; then
  echo "First-time setup..."
  ( ./start-master.sh >/tmp/aix-setup.log 2>&1 & echo $! > /tmp/aix-setup.pid ) 
  [ -f .env.local ] || { rm -f /tmp/aix-setup.pid; read -rp "Paste your Anthropic API key (sk-ant-...): " KEY
    ADMIN=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
    printf 'ANTHROPIC_API_KEY="%s"\nAIX_ADMIN_TOKEN="%s"\nAIX_ALLOWED_ORIGINS="*"\nAIX_SIGNUP_CREDITS=0\nAIX_DATA_DIR="data"\nPORT=3000\n' "$KEY" "$ADMIN" > .env.local
    echo "Admin token (keep it): $ADMIN"; }
  [ -d node_modules ] || npm install --no-audit --no-fund
fi
PL="$HOME/Library/LaunchAgents/com.aix.alpha.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PL" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.aix.alpha</string>
<key>ProgramArguments</key><array><string>/bin/bash</string><string>-lc</string><string>cd "$DIR" &amp;&amp; ./start-master.sh --public</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>$DIR/master.log</string><key>StandardErrorPath</key><string>$DIR/master.log</string>
</dict></plist>
PLIST
launchctl unload "$PL" 2>/dev/null; launchctl load "$PL"
echo ""; echo "AIX ALPHA master node is now always on (starts at login, restarts if it stops)."
echo "Open: http://localhost:3000/alpha   ·   Public URL appears in: $DIR/master.log"
echo "To stop it:  launchctl unload $PL"
