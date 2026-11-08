#!/usr/bin/env bash
# Deploys AIX ALPHA to Cloudflare: always on, every machine, using YOUR Anthropic key. Works on the free plan; Workers Paid ($5/mo) removes the D1 daily read limit.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Install Node 20+ first: https://nodejs.org"; exit 1; }
# nvm users: ignore a conflicting ~/.npmrc prefix for this run
export NPM_CONFIG_PREFIX= ; unset npm_config_prefix
W="npx --yes wrangler@latest"
clean(){ printf '%s' "$1" | grep -o 'sk-ant-[A-Za-z0-9_-]*' | head -1; }
check(){ curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/v1/models -H "x-api-key: $1" -H "anthropic-version: 2023-06-01" --max-time 15; }
echo "Step 1/4: Cloudflare login"
$W whoami 2>&1 | grep -q "You are logged in" || $W login || exit 1
echo "Step 2/4: your Anthropic API key (paste it here in this window only, never in a chat)"
KEY=""
HAVEKEY=$($W secret list 2>/dev/null | grep -c ANTHROPIC_API_KEY)
for i in 1 2 3; do
  if [ "$HAVEKEY" -gt 0 ]; then printf "A key is already saved. Press Enter to keep it, or paste a NEW key (sk-ant-...): "; else printf "Paste your Anthropic API key (sk-ant-...), then Enter: "; fi
  IFS= read -rs RAW; echo; K=$(clean "$RAW")
  if [ -z "$K" ] && [ "$HAVEKEY" -gt 0 ]; then KEY="KEEP"; break; fi
  [ -n "$K" ] || { echo "Must start with sk-ant-"; continue; }
  C=$(check "$K"); [ "$C" = "200" ] && { KEY="$K"; break; }
  echo "Anthropic rejected that key (HTTP $C). Create a new one at console.anthropic.com > API Keys and check billing."
done
[ -n "$KEY" ] || { echo "No valid key."; exit 1; }
printf "Your email (owner account: unlimited, never charged) [Enter = divercityrecords@gmail.com]: "; IFS= read -r OWNER; OWNER=$(printf '%s' "$OWNER" | tr -d ' '); [ -n "$OWNER" ] || OWNER="divercityrecords@gmail.com"
sed -i.bak "s/^OWNER_EMAILS = .*/OWNER_EMAILS = \"$OWNER\"/" wrangler.toml && rm -f wrangler.toml.bak
echo "Step 3/4: deploying (keeps your existing database, secrets and settings)"
OUT=$($W deploy 2>&1); echo "$OUT" | tail -12
URL=$(echo "$OUT" | grep -o 'https://[a-zA-Z0-9.-]*\.workers\.dev' | head -1)
if [ -z "$URL" ]; then echo ""; echo "Deploy did not finish. Copy everything above and send it to Claude."; exit 1; fi
echo "Step 4/4: saving your key as a secret"
ADMIN=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
[ "$KEY" = "KEEP" ] || printf '%s' "$KEY" | $W secret put ANTHROPIC_API_KEY 2>&1 | tail -2
if $W secret list 2>/dev/null | grep -q ADMIN_TOKEN; then echo "Admin token already set: left unchanged."; else printf '%s' "$ADMIN" | $W secret put ADMIN_TOKEN 2>&1 | tail -2; echo "$ADMIN" > cloud-admin-token.txt; fi
echo "$URL" > cloud-url.txt
echo ""; echo "DONE. AIX ALPHA cloud backend (always on, uses your key): $URL"
[ -f cloud-admin-token.txt ] && echo "Admin token (keep private): saved in cloud-admin-token.txt"
echo "Send ONLY the URL above to Claude."
sleep 3; curl -s "$URL/api/health"; echo
