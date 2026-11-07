#!/bin/bash
# AIX Alpha Node for Mac. Double-click to install Ollama (latest), download a model, and start the node.
cd "$(dirname "$0")" || exit 1
APP_URL="https://thecreator715.github.io/AIXALPHA/"
PORT=8787
say() { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }
die() { printf "\n\033[1;31mERROR: %s\033[0m\n" "$1"; read -n 1 -s -r -p "Press any key to close"; exit 1; }

[ "$(uname)" = "Darwin" ] || die "This launcher is for macOS."

# 1) Ollama (latest). Uses the official prebuilt app, never Homebrew (brew tries to compile it on older macOS and fails)
say "Checking Ollama"
if [ ! -x /Applications/Ollama.app/Contents/Resources/ollama ] && ! command -v ollama >/dev/null 2>&1; then
  say "Downloading Ollama.app (official build)"
  curl -fL --progress-bar -o /tmp/Ollama-darwin.zip https://ollama.com/download/Ollama-darwin.zip || die "Could not download Ollama"
  rm -rf /tmp/ollama-unz && mkdir -p /tmp/ollama-unz && ditto -xk /tmp/Ollama-darwin.zip /tmp/ollama-unz || die "Unzip failed"
  rm -rf /Applications/Ollama.app && mv /tmp/ollama-unz/Ollama.app /Applications/ || die "Could not move Ollama to Applications"
  xattr -dr com.apple.quarantine /Applications/Ollama.app 2>/dev/null
fi
if [ -x /Applications/Ollama.app/Contents/Resources/ollama ]; then OLLAMA=/Applications/Ollama.app/Contents/Resources/ollama; else OLLAMA="$(command -v ollama)"; fi
[ -x "$OLLAMA" ] || die "Ollama binary not found"

# 2) start Ollama server if not running
if ! curl -fs http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  say "Starting Ollama"
  OLLAMA_KEEP_ALIVE=30m nohup "$OLLAMA" serve >/tmp/aix-ollama.log 2>&1 &
  for i in $(seq 1 40); do curl -fs http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break; sleep 1; done
  curl -fs http://127.0.0.1:11434/api/tags >/dev/null 2>&1 || die "Ollama did not start (see /tmp/aix-ollama.log)"
fi

# 3) pick a model for this Mac's memory (override: MODEL=name ./Start...)
GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
if [ -z "$MODEL" ]; then
  if   [ "$GB" -ge 64 ]; then MODEL="qwen2.5-coder:32b"
  elif [ "$GB" -ge 32 ]; then MODEL="qwen2.5-coder:14b"
  elif [ "$GB" -ge 16 ]; then MODEL="qwen2.5-coder:7b"
  else MODEL="llama3.2:3b"; fi
fi
say "This Mac has ${GB} GB. Using model: $MODEL (first download can take a while)"
"$OLLAMA" pull "$MODEL" || die "Model download failed"

# 4) Node.js (portable copy if missing)
if ! command -v node >/dev/null 2>&1; then
  say "Setting up Node.js"
  ARCH=$([ "$(uname -m)" = "arm64" ] && echo arm64 || echo x64)
  VER=$(curl -fs https://nodejs.org/dist/latest-v22.x/ | grep -o "node-v22[0-9.]*-darwin-$ARCH.tar.gz" | head -1)
  [ -n "$VER" ] || die "Could not find a Node.js download"
  mkdir -p runtime && curl -fL --progress-bar "https://nodejs.org/dist/latest-v22.x/$VER" | tar -xz -C runtime --strip-components=1 || die "Node download failed"
  export PATH="$PWD/runtime/bin:$PATH"
fi

# 5) token (kept between runs)
[ -f .aix-token ] || openssl rand -hex 24 > .aix-token
TOKEN=$(cat .aix-token)

# 6) optional https address via Tailscale (needed for phones / the claude.ai artifact)
URL="http://localhost:$PORT"
if command -v tailscale >/dev/null 2>&1 || [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then
  TS=$(command -v tailscale || echo /Applications/Tailscale.app/Contents/MacOS/Tailscale)
  "$TS" serve --bg "$PORT" >/dev/null 2>&1
  H=$("$TS" status --json 2>/dev/null | grep -o '"DNSName": *"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"/\1/; s/\.$//')
  [ -n "$H" ] && URL="https://$H"
fi

# 7) start the AIX node and open the app already paired
say "Starting AIX Node on port $PORT"
export AIX_TOKEN="$TOKEN"
node server.js &
NODE_PID=$!
sleep 1
ENC_URL=$(printf %s "$URL" | sed 's|:|%3A|g; s|/|%2F|g')
LINK="${APP_URL}#node=${ENC_URL}&token=${TOKEN}&model=$(printf %s "$MODEL" | sed 's|:|%3A|g')"
echo "$LINK" > aix-pair-link.txt
cat <<MSG

  AIX Node is running.
  Engine : $MODEL via Ollama
  URL    : $URL
  Token  : saved in .aix-token (keep it private)

  Opening AIX Alpha and asking it to connect. Click "Connect" in the page.
  If the page does not pair, use Settings > Local node and paste the URL,
  token and model above. The pairing link is also in aix-pair-link.txt.

  Dashboard: http://localhost:$PORT/   (monitor, models, test chat. Token is in .aix-token)

  Leave this window open while you use the app. Close it (or press Ctrl+C) to stop.
MSG
printf %s "$LINK" | pbcopy 2>/dev/null
echo "  (Pairing link copied to your clipboard: paste it in AIX Alpha > Settings > Local node)"
open "$LINK"
trap 'kill $NODE_PID 2>/dev/null' EXIT
wait $NODE_PID
