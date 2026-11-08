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
"$OLLAMA" pull "$MODEL" || echo "Model download failed - the panel is already running; the node will retry when you start it again."
# bigger context window (Ollama defaults to a small one, which cuts off long chats and web results)
CTX=8192; [ "$GB" -ge 24 ] && CTX=16384
mkdir -p runtime; printf 'FROM %s\nPARAMETER num_ctx %s\n' "$MODEL" "$CTX" > runtime/Modelfile.aix
BASE="$MODEL"; AIXM="aix-alpha-$(printf %s "$MODEL" | tr ':/' '--')"
"$OLLAMA" create "$AIXM" -f runtime/Modelfile.aix >/dev/null 2>&1 && MODEL="$AIXM" && echo "  Using $AIXM (context $CTX)"
# model ladder: higher mode = bigger model (eco < balanced < thorough/auto/turbo). Smaller tiers download in the background.
if   [ "$GB" -ge 64 ]; then T_BAL="qwen2.5-coder:14b"; T_ECO="qwen2.5-coder:7b"
elif [ "$GB" -ge 32 ]; then T_BAL="qwen2.5-coder:7b";  T_ECO="llama3.2:3b"
elif [ "$GB" -ge 16 ]; then T_BAL="llama3.2:3b";       T_ECO="llama3.2:1b"
else T_BAL="llama3.2:3b"; T_ECO="llama3.2:1b"; fi
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
  VIS="qwen2.5vl:7b"
  if "$OLLAMA" pull "$VIS" >/dev/null 2>&1; then
    printf 'FROM %s\nPARAMETER num_ctx 8192\n' "$VIS" > runtime/Modelfile.vis
    "$OLLAMA" create aix-alpha-vision -f runtime/Modelfile.vis >/dev/null 2>&1 && VIS=aix-alpha-vision
    printf %s "$VIS" > .aix-vision-model; echo "  Vision model ready: $VIS"
  else echo "  Vision model not available (images will be skipped)"; fi
fi

# restart the node so it registers the final model names
kill $NODE_PID 2>/dev/null; free_port
export MODEL; [ -s .aix-vision-model ] && export VISION_MODEL="$(cat .aix-vision-model)"
node server.js &
NODE_PID=$!
# 6) public https address so the cloud (and every app: GitHub, artifact, phones) can reach this Mac. Cloudflare quick tunnel, no account.
URL="http://localhost:$PORT"; TUN_PID=""
ARCH=$([ "$(uname -m)" = "arm64" ] && echo arm64 || echo amd64)
if [ ! -x runtime/cloudflared ]; then
  say "Setting up the secure tunnel (cloudflared)"
  mkdir -p runtime && curl -fL --progress-bar "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-$ARCH.tgz" | tar -xz -C runtime 2>/dev/null
fi
if [ -x runtime/cloudflared ]; then
  chmod +x runtime/cloudflared; xattr -dr com.apple.quarantine runtime/cloudflared 2>/dev/null
  # an empty config makes the quick tunnel ignore any ~/.cloudflared/config.yml (named tunnels such as LUMA's make quick tunnels fail otherwise)
  printf '# intentionally empty: quick tunnel only\n' > runtime/empty.yml
  for TRY in 1 2 3; do
    : > tunnel.log; T=""
    nohup runtime/cloudflared tunnel --config "$PWD/runtime/empty.yml" --no-autoupdate --url "http://localhost:$PORT" >> tunnel.log 2>&1 &
    TUN_PID=$!
    for i in $(seq 1 40); do T=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' tunnel.log | head -1); [ -n "$T" ] && break; kill -0 $TUN_PID 2>/dev/null || break; sleep 1; done
    if [ -n "$T" ]; then URL="$T"; break; fi
    echo "  Tunnel attempt $TRY did not start. cloudflared said:"; tail -4 tunnel.log | sed 's/^/    /'
    kill $TUN_PID 2>/dev/null; TUN_PID=""; sleep 3
  done
else
  echo "  cloudflared is missing (download failed?) - the cloud cannot reach this Mac without it."
fi
if [ -z "$TUN_PID" ] && { command -v tailscale >/dev/null 2>&1 || [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; }; then
  TS=$(command -v tailscale || echo /Applications/Tailscale.app/Contents/MacOS/Tailscale)
  "$TS" serve --bg "$PORT" >/dev/null 2>&1
  H=$("$TS" status --json 2>/dev/null | grep -o '"DNSName": *"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"/\1/; s/\.$//')
  [ -n "$H" ] && URL="https://$H"
fi

# 7) start the AIX node and open the app already paired
say "Starting AIX Node on port $PORT"
printf %s "$URL" > .aix-public-url   # the running node picks this up and registers with the cloud
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
trap 'kill $NODE_PID $TUN_PID 2>/dev/null' EXIT
# watchdog: if the tunnel or node dies, restart everything (new tunnel address is re-registered automatically)
while kill -0 $NODE_PID 2>/dev/null && { [ -z "$TUN_PID" ] || kill -0 $TUN_PID 2>/dev/null; }; do sleep 10; done
kill $NODE_PID $TUN_PID 2>/dev/null; sleep 3
exec "$0" --headless
