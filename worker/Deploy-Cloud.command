#!/usr/bin/env bash
# Double-click on Mac (or run in a terminal): deploys AIX ALPHA to Cloudflare so it is ALWAYS ON, on every machine,
# using YOUR Anthropic key. No computer of yours needs to stay running. Free Cloudflare account is enough.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Install Node 20+ first: https://nodejs.org"; exit 1; }
clean(){ printf '%s' "$1" | grep -o 'sk-ant-[A-Za-z0-9_-]*' | head -1; }
check(){ curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/v1/models -H "x-api-key: $1" -H "anthropic-version: 2023-06-01" --max-time 15; }
echo "Step 1/5: Cloudflare login (a browser window opens; create a free account if you don't have one)"
npx --yes wrangler@latest login || exit 1
echo "Step 2/5: your Anthropic API key"
KEY=""
for i in 1 2 3; do
  printf "Paste your Anthropic API key (sk-ant-...), then Enter: "; IFS= read -r RAW; K=$(clean "$RAW")
  [ -n "$K" ] || { echo "Must start with sk-ant-"; continue; }
  C=$(check "$K"); [ "$C" = "200" ] && { KEY="$K"; break; }
  echo "Anthropic rejected that key (HTTP $C). Create a new one at console.anthropic.com > API Keys and check billing."
done
[ -n "$KEY" ] || { echo "No valid key."; exit 1; }
printf "Your email (owner account: unlimited, never charged): "; IFS= read -r OWNER
echo "Step 3/5: storage"
if grep -q REPLACE_WITH_KV_ID wrangler.toml; then
  OUT=$(npx --yes wrangler@latest kv namespace create AIX 2>&1); echo "$OUT" | tail -3
  ID=$(echo "$OUT" | grep -o '[0-9a-f]\{32\}' | head -1); [ -n "$ID" ] || { echo "Could not read the KV id. Run: npx wrangler kv namespace create AIX  and put the id in wrangler.toml"; exit 1; }
  sed -i.bak "s/REPLACE_WITH_KV_ID/$ID/" wrangler.toml && rm -f wrangler.toml.bak
fi
sed -i.bak "s/^OWNER_EMAILS = .*/OWNER_EMAILS = \"$OWNER\"/" wrangler.toml && rm -f wrangler.toml.bak
echo "Step 4/5: secrets"
ADMIN=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
printf '%s' "$KEY" | npx --yes wrangler@latest secret put ANTHROPIC_API_KEY >/dev/null 2>&1 || { echo "Failed to save key secret"; exit 1; }
printf '%s' "$ADMIN" | npx --yes wrangler@latest secret put ADMIN_TOKEN >/dev/null 2>&1
echo "Step 5/5: deploying"
OUT=$(npx --yes wrangler@latest deploy 2>&1); echo "$OUT" | tail -6
URL=$(echo "$OUT" | grep -o 'https://[a-zA-Z0-9.-]*\.workers\.dev' | head -1)
[ -n "$URL" ] || { echo "Deploy finished but the URL was not found above."; exit 1; }
echo "$URL" > cloud-url.txt; echo "$ADMIN" > cloud-admin-token.txt
echo ""; echo "DONE. AIX ALPHA cloud backend (always on, uses your key): $URL"
echo "Admin token (keep private): $ADMIN   (saved in cloud-admin-token.txt)"
echo "Send the URL above to Claude: it gets built into the GitHub site so every machine uses your account."
curl -s "$URL/api/health"; echo
