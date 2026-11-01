#!/usr/bin/env bash
# Builds a PRIVATE single-file copy of AIX ALPHA with YOUR API key built in. Open it on any of your machines.
# KEEP IT PRIVATE: never upload, share, email or commit the output file; anyone holding it can spend your key.
cd "$(dirname "$0")" || exit 1
clean(){ printf '%s' "$1" | grep -o 'sk-ant-[A-Za-z0-9_-]*' | head -1; }
printf "Paste your Anthropic API key (sk-ant-...), then Enter: "; IFS= read -r RAW; KEY=$(clean "$RAW")
[ -n "$KEY" ] || { echo "Must start with sk-ant-"; exit 1; }
C=$(curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/v1/models -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01" --max-time 15)
[ "$C" = "200" ] || { echo "Anthropic rejected that key (HTTP $C)."; exit 1; }
OUT="$HOME/Desktop/AIX-ALPHA-PRIVATE.html"
KEY="$KEY" python3 - "$OUT" <<'PY'
import os,sys
s=open('public/alpha.html',encoding='utf8').read()
s=s.replace('<meta name="aix-embedded-key" content="">','<meta name="aix-embedded-key" content="%s">'%os.environ['KEY'],1)
open(sys.argv[1],'w',encoding='utf8').write(s)
PY
chmod 600 "$OUT"; echo "Created: $OUT  (private; contains your key)"; open "$OUT" 2>/dev/null || true
