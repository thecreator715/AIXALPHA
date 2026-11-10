#!/bin/bash
# Installs Qwen-Image 2.1 (7B) on this Mac through mflux (Apple Silicon) and tests it. The node then serves images itself:
# 1 credit per image, 2.5 credits (more steps, higher quality) in Thorough/XQ. If this fails, the cloud falls back to FLUX automatically.
cd "$(dirname "$0")" || exit 1
mkdir -p runtime; LOG="runtime/image-install.log"; : > "$LOG"
say(){ printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -f .aix-image-skip ] && { echo "Qwen-Image install is switched off (delete .aix-image-skip to enable)."; exit 0; }
[ "$(uname -m)" = "arm64" ] || { echo "Qwen-Image needs an Apple Silicon Mac. Images will use cloud FLUX."; exit 0; }
FREE=$(df -g . 2>/dev/null | awk 'NR==2{print $4}'); [ -n "$FREE" ] && [ "$FREE" -lt 45 ] && { echo "Only ${FREE} GB free; Qwen-Image needs about 45 GB. Free some space and run this again. Images use cloud FLUX meanwhile."; exit 0; }
say "1/3 Installing the image engine (uv + mflux)"
command -v uv >/dev/null 2>&1 || { curl -LsSf https://astral.sh/uv/install.sh 2>>"$LOG" | sh >>"$LOG" 2>&1; }
command -v uv >/dev/null 2>&1 || { echo "Could not install uv (see $LOG). Images use cloud FLUX."; exit 0; }
uv tool install --upgrade mflux >>"$LOG" 2>&1 || uv tool upgrade mflux >>"$LOG" 2>&1
CMD="$(command -v mflux-generate-qwen-2.1)"
[ -n "$CMD" ] || { echo "This mflux version has no Qwen-Image 2.1 yet (needs 0.21 or newer). See $LOG. Images use cloud FLUX."; exit 0; }
say "2/3 First test image (downloads the model weights, about 33 GB, once; this can take a while)"
T="runtime/img-test.png"; GOOD=""; OKF=0
for Q in "-q 8" "-q 4" ""; do
  rm -f "$T"
  # shellcheck disable=SC2086
  if "$CMD" $Q --prompt "a red apple on a wooden table, studio light" --steps 4 --width 512 --height 512 --seed 1 --output "$T" >>"$LOG" 2>&1 && [ -s "$T" ]; then GOOD="$Q"; OKF=1; break; fi
  echo "  attempt with '${Q:-no quantize}' did not work, trying the next option"
done
rm -f "$T"
if [ $OKF = 0 ] && [ -n "$(tail -c 300 "$LOG" | grep -i 'gated\|401\|403\|license\|login' )" ]; then echo "The model download needs a Hugging Face login/licence acceptance. Accept the Qwen-Image-2.1 licence on huggingface.co, run: uv tool run hf auth login  then run this script again."; fi
say "3/3 Switching the node over"
if [ $OKF = 1 ]; then
  ARGS='[]'; [ -n "$GOOD" ] && ARGS="[\"${GOOD% *}\",\"${GOOD#* }\"]"
  printf '{"cmd":"%s","args":%s,"steps":20,"stepsHq":40,"ok":true}\n' "$CMD" "$ARGS" > .aix-image
  echo "  Qwen-Image 2.1 is ready. 1 credit per image, 2.5 credits in Thorough/XQ."
  echo "  (the cloud picks this up within a minute; no restart needed)"
else
  rm -f .aix-image; echo "  Qwen-Image 2.1 test did not pass (details: $LOG). Images keep using cloud FLUX at the same price."
fi
