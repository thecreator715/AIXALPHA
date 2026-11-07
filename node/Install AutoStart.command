#!/bin/bash
# Makes the AIX node start by itself at every login and restart if it stops.
DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.aix.node.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.aix.node</string>
<key>ProgramArguments</key><array><string>/bin/bash</string><string>$DIR/Start AIX Node.command</string><string>--headless</string></array>
<key>WorkingDirectory</key><string>$DIR</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>$DIR/node.log</string><key>StandardErrorPath</key><string>$DIR/node.log</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
</dict></plist>
EOF
launchctl unload "$PLIST" 2>/dev/null; launchctl load "$PLIST"
echo "AutoStart installed. The AIX node now runs in the background at login. Logs: $DIR/node.log"
echo "To remove: launchctl unload \"$PLIST\" && rm \"$PLIST\""
read -n 1 -s -r -p "Press any key to close"
