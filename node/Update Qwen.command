#!/bin/bash
# Updates this node to the newest scripts + Qwen 3.x models, then starts everything.
cd "$(dirname "$0")" || exit 1
say(){ printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
RAW="https://raw.githubusercontent.com/thecreator715/AIXALPHA/main/node"
say "1/4 Downloading the latest AIX node files"
ok=1
for f in "server.js" "monitor.html" "Start AIX Node.command" "AIX MASTER.command" "Install AutoStart.command" "Open Node Panel.command" "Update Qwen.command.new"; do
  src="${f%.new}"; enc=$(printf %s "$src" | sed 's/ /%20/g')
  if curl -fsSL "$RAW/$enc" -o "/tmp/aix-upd.$$" && [ -s "/tmp/aix-upd.$$" ]; then
    [ "$f" = "Update Qwen.command.new" ] && continue
    mv "/tmp/aix-upd.$$" "$src" && echo "  updated $src"
  else echo "  could not fetch $src"; ok=0; fi
done
chmod +x ./*.command 2>/dev/null; xattr -d com.apple.quarantine ./*.command 2>/dev/null
grep -q 'qwen3.8' "Start AIX Node.command" || { echo "The launcher is still old - check your internet and run this again."; read -p "Press Enter to close"; exit 1; }
say "2/4 Stopping the old node"
pkill -f "node server.js" 2>/dev/null; pkill -f "runtime/empty.yml" 2>/dev/null; sleep 1
say "3/4 Resetting the old model list so the Qwen 3.x ladder is built fresh"
rm -f .aix-models .aix-vision-model runtime/Modelfile.* 2>/dev/null
say "4/4 Starting everything (downloads qwen3.8:27b, about 18 GB, first time only)"
exec "./AIX MASTER.command"
