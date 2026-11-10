#!/bin/bash
# Installs local video generation (Lightricks LTX-2.3, 4-bit, Apple MLX) and tests it. Text-to-video and image-to-video with audio, 3 credits per clip.
# The cloud uses this Mac first and the free cloud queue as backup, so a failed install never breaks video.
cd "$(dirname "$0")" || exit 1
mkdir -p runtime; LOG="runtime/video-install.log"; : > "$LOG"
say(){ printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -f .aix-video-skip ] && { echo "Local video install is switched off (delete .aix-video-skip to enable)."; exit 0; }
[ "$(uname -m)" = "arm64" ] || { echo "Local video needs an Apple Silicon Mac. Video uses the cloud queue."; exit 0; }
FREE=$(df -g . 2>/dev/null | awk 'NR==2{print $4}'); [ -n "$FREE" ] && [ "$FREE" -lt 45 ] && { echo "Only ${FREE} GB free; local video needs about 45 GB (model + text encoder). Free some space and run this again."; exit 0; }
say "1/3 Installing the video engine"
command -v uv >/dev/null 2>&1 || { curl -LsSf https://astral.sh/uv/install.sh 2>>"$LOG" | sh >>"$LOG" 2>&1; }
command -v uv >/dev/null 2>&1 || { echo "Could not install uv (see $LOG). Video uses the cloud queue."; exit 0; }
command -v ffmpeg >/dev/null 2>&1 || { command -v brew >/dev/null 2>&1 && brew install ffmpeg >>"$LOG" 2>&1; }
uv tool install --upgrade ltx-2-mlx >>"$LOG" 2>&1 \
 || uv tool install --upgrade "git+https://github.com/dgrauet/ltx-2-mlx" >>"$LOG" 2>&1 \
 || uv tool install --upgrade "ltx-2-mlx @ git+https://github.com/dgrauet/ltx-2-mlx#subdirectory=packages/ltx-pipelines-mlx" >>"$LOG" 2>&1
CMD="$(command -v ltx-2-mlx)"
[ -n "$CMD" ] || { echo "Could not install the LTX MLX engine (see $LOG). Video uses the cloud queue."; exit 0; }
say "2/3 First test clip (downloads the model once, about 30 GB; this can take a long while)"
T="runtime/vid-test.mp4"; rm -f "$T"; OKF=0
ARGS=(generate --distilled --model dgrauet/ltx-2.3-mlx-q4 --low-ram)
"$CMD" "${ARGS[@]}" -p "a red apple slowly rotating on a wooden table" -o "$T" -H 256 -W 384 >>"$LOG" 2>&1 && [ -s "$T" ] && OKF=1
rm -f "$T"
say "3/3 Switching the node over"
if [ $OKF = 1 ]; then
  printf '{"cmd":"%s","args":["generate","--distilled","--model","dgrauet/ltx-2.3-mlx-q4","--low-ram"],"ok":true}\n' "$CMD" > .aix-video
  echo "  Local video is ready (3 credits per clip). The chat model is unloaded while a clip renders and reloads on the next chat."
else
  rm -f .aix-video; echo "  The local video test did not pass (details: $LOG). Video keeps using the cloud queue."
fi
