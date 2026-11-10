#!/bin/bash
# Updates this node to the newest scripts and models (Qwen 3.8, ALPHA XQ / Qwen 4 when available), then starts everything.
cd "$(dirname "$0")" || exit 1
say(){ printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
RAW="https://raw.githubusercontent.com/thecreator715/AIXALPHA/main/node"
TMP="$(mktemp -d)"
say "1/4 Downloading the latest AIX node files"
fail=0
for src in "server.js" "monitor.html" "Start AIX Node.command" "AIX MASTER.command" "Install AutoStart.command" "Open Node Panel.command" "Update Qwen.command" "Install Qwen Image.command" "Install Local Video.command"; do
  enc=$(printf %s "$src" | sed 's/ /%20/g'); f="$TMP/$src"
  ok=0
  for t in 1 2 3; do curl -fsSL -m 60 "$RAW/$enc" -o "$f" && [ -s "$f" ] && ok=1 && break; sleep 2; done
  [ $ok = 1 ] || { echo "  could not fetch $src"; fail=1; continue; }
  case "$src" in
    *.command) bash -n "$f" 2>/dev/null || { echo "  $src failed its syntax check, keeping your current copy"; fail=1; continue; } ;;
    server.js) command -v node >/dev/null 2>&1 && ! node --check "$f" 2>/dev/null && { echo "  server.js failed its syntax check, keeping your current copy"; fail=1; continue; } ;;
  esac
  [ -f "$src" ] && cp "$src" "$src.bak" 2>/dev/null
  if [ "$src" = "Update Qwen.command" ]; then cp "$f" "$src.next"; else cp "$f" "$src"; fi
  echo "  updated $src"
done
[ -f "Update Qwen.command.next" ] && { mv "Update Qwen.command.next" "Update Qwen.command"; }
chmod +x ./*.command 2>/dev/null; xattr -d com.apple.quarantine ./*.command 2>/dev/null
rm -rf "$TMP"
grep -q 'ALPHA XQ' "Start AIX Node.command" || { echo; echo "The launcher is still old. Check your internet and run this again."; read -p "Press Enter to close"; exit 1; }
[ $fail = 1 ] && echo "  (some files could not be refreshed; the rest of the update continues)"
say "2/4 Stopping the old node"
pkill -f "node server.js" 2>/dev/null; pkill -f "runtime/empty.yml" 2>/dev/null; sleep 1
say "3/4 Rebuilding the model list (keeps your downloaded models)"
rm -f .aix-models .aix-vision-model runtime/Modelfile.* 2>/dev/null
say "4/4 Starting everything (first run downloads any missing model, about 18 GB; XQ switches to Qwen 4 automatically once Ollama has it)"
exec "./AIX MASTER.command"
