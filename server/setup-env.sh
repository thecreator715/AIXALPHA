#!/usr/bin/env bash
# Creates / repairs .env.local. Cleans the pasted key and TESTS it with Anthropic before saving.
cd "$(dirname "$0")" || exit 1
clean(){ printf '%s' "$1" | grep -o 'sk-ant-[A-Za-z0-9_-]*' | head -1; }
check(){ curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/v1/models -H "x-api-key: $1" -H "anthropic-version: 2023-06-01" --max-time 15; }
CUR=""; [ -f .env.local ] && CUR=$(clean "$(grep -E '^ANTHROPIC_API_KEY=' .env.local | head -1 | cut -d= -f2-)")
if [ -n "$CUR" ]; then
  C=$(check "$CUR"); if [ "$C" = "200" ]; then exit 0; fi
  echo "The saved API key was rejected by Anthropic (HTTP $C). Let's enter a new one."
fi
for i in 1 2 3; do
  printf "Paste your Anthropic API key (sk-ant-...), then press Enter: "; IFS= read -r RAW; KEY=$(clean "$RAW")
  case "$KEY" in sk-ant-*) ;; *) echo "That doesn't look like an Anthropic key (it must start with sk-ant-)."; continue;; esac
  C=$(check "$KEY")
  if [ "$C" = "200" ]; then break; fi
  if [ "$C" = "000" ]; then echo "Could not reach api.anthropic.com. Check your internet connection."; else echo "Anthropic rejected that key (HTTP $C). Create a new one at console.anthropic.com > API Keys (and make sure billing is set up)."; fi
  KEY=""
done
[ -n "$KEY" ] || { echo "No valid key entered."; exit 1; }
ADMIN=""; [ -f .env.local ] && ADMIN=$(grep -E '^AIX_ADMIN_TOKEN=' .env.local | head -1 | cut -d= -f2- | tr -d '"')
[ -n "$ADMIN" ] || ADMIN=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
cat > .env.local <<ENV
ANTHROPIC_API_KEY="$KEY"
AIX_ADMIN_TOKEN="$ADMIN"
AIX_ALLOWED_ORIGINS="*"
AIX_SIGNUP_CREDITS=0
AIX_DATA_DIR="data"
PORT=3000
ENV
echo "Key verified and saved. Admin token (keep it): $ADMIN"
