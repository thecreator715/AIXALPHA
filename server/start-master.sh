#!/usr/bin/env bash
# RETIRED: the old Anthropic-key master node. AIX Alpha now runs only on the Alpha node (Ollama on this Mac).
# This launcher shuts the old master down for good (including its always-on agent) and starts the Alpha node instead. No API key needed.
cd "$(dirname "$0")" || exit 1
./stop-master.sh >/dev/null 2>&1
PL="$HOME/Library/LaunchAgents/com.aix.alpha.plist"
[ -f "$PL" ] && { launchctl unload "$PL" 2>/dev/null; rm -f "$PL"; echo "Removed the old always-on Anthropic master agent."; }
N="$(cd .. && pwd)/node/AIX MASTER.command"
[ -f "$N" ] || { echo "Could not find node/AIX MASTER.command next to this folder."; read -n 1 -s -r -p "Press any key"; exit 1; }
chmod +x "$N"; exec "$N"
