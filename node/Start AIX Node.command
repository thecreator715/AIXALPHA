#!/bin/bash
# AIX Alpha Node for Mac. Double-click to install Ollama (latest), download a model, and start the node.
cd "$(dirname "$0")" || exit 1
APP_URL="https://thecreator715.github.io/AIXALPHA/"
PORT=8787
WORKER="https://aix-alpha.aixalpha.workers.dev"
[ -f .aix-node-secret ] && NODE_SECRET=$(tr -d "[:space:]" < .aix-node-secret)
say() { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }
HEADLESS=0; [ "$1" = "--headless" ] && HEADLESS=1
die() { printf "\n\033[1;31mERROR: %s\033[0m\n" "$1"; [ "$HEADLESS" = 1 ] || read -n 1 -s -r -p "Press any key to close"; exit 1; }

[ "$(uname)" = "Darwin" ] || die "This launcher is for macOS."
# keep the Mac awake while the node runs (a sleeping Mac is why the app shows "node offline")
command -v caffeinate >/dev/null 2>&1 && { caffeinate -dimsu -w $$ >/dev/null 2>&1 & }

# 1) Ollama (latest). Uses the official prebuilt app, never Homebrew (brew tries to compile it on older macOS and fails)
say "Checking Ollama"
install_ollama() {
  say "Downloading Ollama.app (official build)"
  for t in 1 2 3; do curl -fL --progress-bar -o /tmp/Ollama-darwin.zip https://ollama.com/download/Ollama-darwin.zip && break; [ $t = 3 ] && die "Could not download Ollama (check your internet)"; sleep 3; done
  rm -rf /tmp/ollama-unz && mkdir -p /tmp/ollama-unz && ditto -xk /tmp/Ollama-darwin.zip /tmp/ollama-unz || die "Unzip failed"
  osascript -e 'quit app "Ollama"' >/dev/null 2>&1; pkill -f "ollama serve" 2>/dev/null; sleep 2
  rm -rf /Applications/Ollama.app && mv /tmp/ollama-unz/Ollama.app /Applications/ || die "Could not move Ollama to Applications"
  xattr -dr com.apple.quarantine /Applications/Ollama.app 2>/dev/null
}
if [ ! -x /Applications/Ollama.app/Contents/Resources/ollama ] && ! command -v ollama >/dev/null 2>&1; then install_ollama; fi
if [ -x /Applications/Ollama.app/Contents/Resources/ollama ]; then OLLAMA=/Applications/Ollama.app/Contents/Resources/ollama; else OLLAMA="$(command -v ollama)"; fi
[ -x "$OLLAMA" ] || die "Ollama binary not found"
# Qwen 3.8 / Qwen 4 need a recent Ollama: upgrade the app automatically when it is too old
OV=$("$OLLAMA" --version 2>/dev/null | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
ver_lt() { [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -1)" = "$1" ] && [ "$1" != "$2" ]; }
if [ -n "$OV" ] && ver_lt "$OV" "0.32.12" && [ -d /Applications/Ollama.app ]; then
  say "Ollama $OV is too old for the newest Qwen models, updating it"; install_ollama
  OLLAMA=/Applications/Ollama.app/Contents/Resources/ollama
fi

# 2) start Ollama server if not running
if ! curl -fs http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  say "Starting Ollama"
  OLLAMA_KEEP_ALIVE=30m OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 nohup "$OLLAMA" serve >/tmp/aix-ollama.log 2>&1 &
  for i in $(seq 1 40); do curl -fs http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break; sleep 1; done
  curl -fs http://127.0.0.1:11434/api/tags >/dev/null 2>&1 || die "Ollama did not start (see /tmp/aix-ollama.log)"
fi

# a wrapped name left in the environment by an earlier run must not be wrapped again (aix-alpha-aix-alpha-...)
case "$MODEL" in aix-alpha-*) MODEL="";; esac
# 3) pick a model for this Mac's memory (override: MODEL=name ./Start...)
GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
if [ -z "$MODEL" ]; then
  # Qwen 3.x line (newest that Ollama ships). 27B dense is ~18 GB and fits a 32 GB Mac's GPU budget.
  if   [ "$GB" -ge 64 ]; then MODEL="qwen3.8:27b-q8_0"
  elif [ "$GB" -ge 32 ]; then MODEL="qwen3.8:27b"
  elif [ "$GB" -ge 16 ]; then MODEL="qwen3.5:9b"
  else MODEL="qwen3.5:4b"; fi
fi
say "This Mac has ${GB} GB. Using model: $MODEL (first download can take a while)"

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

# 5a) cloudflared (the secure tunnel). The node itself starts and supervises it, so the cloud sees this Mac within seconds.
ARCH=$([ "$(uname -m)" = "arm64" ] && echo arm64 || echo amd64)
if [ ! -x runtime/cloudflared ]; then
  say "Setting up the secure tunnel (cloudflared)"
  mkdir -p runtime && curl -fL --progress-bar "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-$ARCH.tgz" | tar -xz -C runtime 2>/dev/null
fi
[ -f runtime/cloudflared ] && { chmod +x runtime/cloudflared; xattr -dr com.apple.quarantine runtime/cloudflared 2>/dev/null; }

# 5b) start the node RIGHT AWAY so the control panel opens immediately; model download and the tunnel continue below
free_port() { for _ in 1 2 3 4 5 6 7 8; do P=$(lsof -ti tcp:$PORT 2>/dev/null); [ -z "$P" ] && return 0; kill $P 2>/dev/null; sleep 1; done; P=$(lsof -ti tcp:$PORT 2>/dev/null); [ -n "$P" ] && kill -9 $P 2>/dev/null; sleep 1; }
say "Starting AIX Node on port $PORT"
free_port
rm -f .aix-public-url
export AIX_TOKEN="$TOKEN" AIX_WORKER="$WORKER" AIX_NODE_SECRET="$NODE_SECRET" MODEL="$MODEL"
node server.js &
NODE_PID=$!
sleep 1
[ "$HEADLESS" = "1" ] || open "http://localhost:$PORT/?v=$(date +%s)" 2>/dev/null || true
say "Checking the model: $MODEL"
# ALPHA XQ: use Qwen 4 the moment Ollama ships it (32GB+ Macs), otherwise stay on the current best
if [ "$GB" -ge 32 ]; then for Q4 in qwen4:27b qwen4.0:27b; do "$OLLAMA" show "$Q4" >/dev/null 2>&1 || "$OLLAMA" pull "$Q4" >/dev/null 2>&1; "$OLLAMA" show "$Q4" >/dev/null 2>&1 && { echo "  Qwen 4 found: $Q4 -> ALPHA XQ"; MODEL="$Q4"; break; }; done; fi
FREE=$(df -g / 2>/dev/null | awk 'NR==2{print $4}'); "$OLLAMA" show "$MODEL" >/dev/null 2>&1 || { [ -n "$FREE" ] && [ "$FREE" -lt 25 ] && echo "  WARNING: only ${FREE} GB free on this Mac; the model needs about 20 GB. Free some space if the download fails."; }
for t in 1 2 3; do "$OLLAMA" pull "$MODEL" >/dev/null 2>&1 && break; echo "  download attempt $t did not finish, retrying (progress is kept)..."; sleep 4; done
"$OLLAMA" pull "$MODEL" || { FB="${MODEL%%:*}"; [ "$FB" = "qwen3.8" ] && { echo "  $MODEL needs a newer Ollama - falling back to qwen3.6:27b (update Ollama to get 3.8)"; MODEL="qwen3.6:27b"; "$OLLAMA" pull "$MODEL"; } ; } || echo "Model download failed - the panel is already running; the node will retry when you start it again."
# bigger context window (Ollama defaults to a small one, which cuts off long chats and web results)
CTX=8192; [ "$GB" -ge 24 ] && CTX=16384; [ "$GB" -ge 32 ] && CTX=65536   # room for 16K-token replies plus the prompt
mkdir -p runtime; printf 'FROM %s\nPARAMETER num_ctx %s\n' "$MODEL" "$CTX" > runtime/Modelfile.aix
BASE="$MODEL"; AIXM="aix-alpha-$(printf %s "$MODEL" | tr ':/' '--')"
"$OLLAMA" create "$AIXM" -f runtime/Modelfile.aix >/dev/null 2>&1 && MODEL="$AIXM" && echo "  Using $AIXM (context $CTX)"
# prove the model really loads at this context; if not (memory), step the context down automatically
loads() { curl -fs -m 300 http://127.0.0.1:11434/api/generate -d "{\"model\":\"$1\",\"prompt\":\"hi\",\"stream\":false,\"options\":{\"num_predict\":4}}" >/dev/null 2>&1; }
if [ "$MODEL" = "$AIXM" ] && ! loads "$MODEL"; then
  for C in 32768 16384 8192; do [ "$C" -ge "$CTX" ] && continue
    echo "  Model did not load at context $CTX - trying $C"; CTX=$C
    printf 'FROM %s\nPARAMETER num_ctx %s\n' "$BASE" "$CTX" > runtime/Modelfile.aix
    "$OLLAMA" create "$AIXM" -f runtime/Modelfile.aix >/dev/null 2>&1; loads "$AIXM" && { echo "  Running at context $CTX"; break; }
  done
fi
# model ladder: higher mode = bigger model (eco < balanced < thorough/auto/turbo). Smaller tiers download in the background.
if   [ "$GB" -ge 64 ]; then T_BAL="qwen3.6:35b-a3b"; T_ECO="qwen3.5:9b"
elif [ "$GB" -ge 32 ]; then T_BAL="qwen3.5:9b";      T_ECO="qwen3.5:4b"
elif [ "$GB" -ge 16 ]; then T_BAL="qwen3.5:4b";      T_ECO="qwen3.5:2b"
else T_BAL="qwen3.5:2b"; T_ECO="qwen3.5:0.8b"; fi
ECOV="$MODEL"; BALV="$MODEL"
write_tiers() { printf '{"eco":"%s","balanced":"%s","thorough":"%s"}' "$ECOV" "$BALV" "$MODEL" > .aix-models; }
mk_tier() { # base -> prints usable model name
  local b="$1" n="aix-alpha-$(printf %s "$1" | tr ':/' '--')"
  [ "$b" = "$BASE" ] && { printf %s "$MODEL"; return; }
  "$OLLAMA" pull "$b" >/dev/null 2>&1 || return 1
  printf 'FROM %s\nPARAMETER num_ctx %s\n' "$b" "$CTX" > "runtime/Modelfile.$n"
  "$OLLAMA" create "$n" -f "runtime/Modelfile.$n" >/dev/null 2>&1 && printf %s "$n" || printf %s "$b"
}
write_tiers
( B=$(mk_tier "$T_BAL") && [ -n "$B" ] && BALV="$B" && write_tiers
  E=$(mk_tier "$T_ECO") && [ -n "$E" ] && ECOV="$E" && write_tiers
  echo "  Model ladder ready: eco=$ECOV  balanced=$BALV  thorough=$MODEL" ) &
# vision model so Alpha can read images (needs 16 GB or more; skipped on smaller Macs)
rm -f .aix-vision-model
if [ "$GB" -ge 16 ]; then
  VIS="qwen3-vl:8b"; [ "$GB" -lt 24 ] && VIS="qwen3-vl:4b"
  if "$OLLAMA" pull "$VIS" >/dev/null 2>&1; then
    printf 'FROM %s\nPARAMETER num_ctx 8192\n' "$VIS" > runtime/Modelfile.vis
    "$OLLAMA" create aix-alpha-vision -f runtime/Modelfile.vis >/dev/null 2>&1 && VIS=aix-alpha-vision
    printf %s "$VIS" > .aix-vision-model; echo "  Vision model ready: $VIS"
  else echo "  Vision model not available (images will be skipped)"; fi
fi

# Qwen-Image 2.1 (default image model): install + test once in the background; images use cloud FLUX until it passes
[ -s .aix-image ] || [ -f .aix-image-skip ] || ( [ -f "Install Qwen Image.command" ] && bash "./Install Qwen Image.command" >> runtime/image-install.out 2>&1 ) &

# restart the node so it registers the final model names
kill $NODE_PID 2>/dev/null; pkill -f "runtime/empty.yml" 2>/dev/null; free_port; rm -f .aix-public-url
export MODEL; [ -s .aix-vision-model ] && export VISION_MODEL="$(cat .aix-vision-model)"
node server.js &
NODE_PID=$!
# 6) the node starts its own tunnel and writes the public address to .aix-public-url; wait for it here
URL="http://localhost:$PORT"
say "Waiting for the secure tunnel"
for i in $(seq 1 75); do U=$(cat .aix-public-url 2>/dev/null); [ -n "$U" ] && { URL="$U"; break; }; sleep 1; done
[ "$URL" = "http://localhost:$PORT" ] && { echo "  Tunnel not up yet. The node keeps retrying by itself. Last tunnel lines:"; tail -4 tunnel.log 2>/dev/null | sed 's/^/    /'; }

# 7) start the AIX node and open the app already paired
say "Starting AIX Node on port $PORT"
ENC_URL=$(printf %s "$URL" | sed 's|:|%3A|g; s|/|%2F|g')
LINK="${APP_URL}#node=${ENC_URL}&token=${TOKEN}&model=$(printf %s "$MODEL" | sed 's|:|%3A|g')"
echo "$LINK" > aix-pair-link.txt
cat <<MSG

  AIX Node is running.
  Engine : $MODEL via Ollama
  Public : $URL
  Cloud  : registers itself with AIX Alpha every minute. Every app (GitHub site, artifact,
           phones) now uses this Mac automatically for ECO and BALANCED replies.
           If this Mac is off, replies pause until it is back (node-only mode).
  Token  : .aix-token (keep it private)
  Panel  : http://localhost:$PORT/

  Keep this window open, or double-click "Install AutoStart.command" once so it
  runs by itself at every login.
MSG
[ -n "$NODE_SECRET" ] || echo "  WARNING: .aix-node-secret is missing, so cloud registration is OFF."
trap 'kill $NODE_PID 2>/dev/null; pkill -f "runtime/empty.yml" 2>/dev/null' EXIT
# watchdog: if the tunnel or node dies, restart everything (new tunnel address is re-registered automatically)
while kill -0 $NODE_PID 2>/dev/null; do sleep 10; done
kill $NODE_PID 2>/dev/null; pkill -f "runtime/empty.yml" 2>/dev/null; sleep 3
exec "$0" --headless
