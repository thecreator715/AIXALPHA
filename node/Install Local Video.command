#!/bin/bash
# Installs local video generation (Lightricks LTX-2.5, 8-bit, Apple MLX; falls back to LTX-2.3) and tests it.
# Text-to-video and image-to-video with audio, 1 credit per second. The cloud uses this Mac first and the free cloud queue as backup,
# so a failed install never breaks video. Full log: runtime/video-install.log
cd "$(dirname "$0")" || exit 1
mkdir -p runtime; LOG="runtime/video-install.log"; : > "$LOG"
say(){ printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -f .aix-video-skip ] && { echo "Local video install is switched off (delete .aix-video-skip to enable)."; exit 0; }
[ "$(uname -m)" = "arm64" ] || { echo "Local video needs an Apple Silicon Mac. Video uses the cloud queue."; exit 0; }
FREE=$(df -g . 2>/dev/null | awk 'NR==2{print $4}'); [ -n "$FREE" ] && [ "$FREE" -lt 70 ] && { echo "Only ${FREE} GB free; LTX-2.5 needs about 70 GB (model 59 GB + engine). Free some space and run this again."; exit 0; }
fail(){ echo "  $1"; echo "  Video keeps using the cloud queue. Send runtime/video-install.log to support if you want it fixed."; rm -f .aix-video; exit 0; }
say "1/4 Tools (uv, git, ffmpeg)"
command -v uv >/dev/null 2>&1 || { curl -LsSf https://astral.sh/uv/install.sh 2>>"$LOG" | sh >>"$LOG" 2>&1; }
command -v uv >/dev/null 2>&1 || fail "Could not install uv."
UV="$(command -v uv)"
command -v git >/dev/null 2>&1 || fail "git is missing. Run: xcode-select --install   then run this again."
command -v ffmpeg >/dev/null 2>&1 || { command -v brew >/dev/null 2>&1 && brew install ffmpeg >>"$LOG" 2>&1; }
command -v ffmpeg >/dev/null 2>&1 || fail "ffmpeg is missing. Install Homebrew (brew.sh), then run this again."

# setup <dir> <repo> <branch> <pinned-commit|""> : clone + uv sync into runtime/<dir>
setup(){
  local D="runtime/$1" R="$2" B="$3" C="$4"
  if [ -d "$D/.git" ]; then git -C "$D" fetch --all --tags >>"$LOG" 2>&1; else rm -rf "$D"; git clone "$R" "$D" >>"$LOG" 2>&1 || return 1; fi
  git -C "$D" checkout "$B" >>"$LOG" 2>&1 || return 1
  [ -n "$C" ] && { git -C "$D" checkout "$C" >>"$LOG" 2>&1 || echo "(pinned commit not found, using branch tip)" >>"$LOG"; }
  ( cd "$D" && "$UV" sync --python 3.12 --all-extras >>"../../$LOG" 2>&1 || "$UV" sync --python 3.12 >>"../../$LOG" 2>&1 || "$UV" sync >>"../../$LOG" 2>&1 ) || return 1
}
# pick the first help-listed flag name from a list
hasflag(){ echo "$HELP" | grep -q -- "$1"; }
pickflag(){ for f in "$@"; do hasflag "$f" && { echo "$f"; return; }; done; echo ""; }

# try <name> <dir> <model> : self-test one engine/model pair, writes .aix-video on success
try(){
  local NAME="$1" D="runtime/$2" MODEL="$3" ABS; ABS="$(cd "$D" 2>/dev/null && pwd)" || return 1
  HELP="$("$UV" run --project "$ABS" ltx-2-mlx generate --help 2>&1)"; echo "$HELP" >>"$LOG"
  [ -n "$HELP" ] || return 1
  local FP FO FH FW FI FF FR
  FP=$(pickflag --prompt -p); FO=$(pickflag --output -o); FH=$(pickflag --height -H); FW=$(pickflag --width -W)
  FI=$(pickflag --image --image-path --start-image --input-image -i); FF=$(pickflag --frames --num-frames); FR=$(pickflag --frame-rate --fps)
  [ -n "$FP" ] && [ -n "$FO" ] && [ -n "$FH" ] && [ -n "$FW" ] || { echo "(flags not recognised for $NAME)" >>"$LOG"; return 1; }
  local MHQ="" MBEST=""; hasflag --two-stage && MHQ="--two-stage"; hasflag --two-stages-hq && MBEST="--two-stages-hq"
  local EXTRA=(); [ -n "$FF" ] && EXTRA+=("$FF" "$NFR"); [ -n "$FR" ] && EXTRA+=("$FR" 24)
  local T="runtime/vid-test.mp4"; rm -f "$T"
  say "3/4 Test clip with $NAME (downloads the model once; this can take a long while)"
  "$UV" run --project "$ABS" ltx-2-mlx generate --distilled --model "$MODEL" --low-ram "$FP" "a red apple slowly rotating on a wooden table" "$FO" "$T" "$FH" 256 "$FW" 384 "${EXTRA[@]}" >>"$LOG" 2>&1
  [ -s "$T" ] || return 1
  rm -f "$T"
  python3 - "$UV" "$ABS" "$MODEL" "$NAME" "$FP" "$FO" "$FH" "$FW" "$FI" "$FF" "$FR" "$NFR" "$MHQ" "$MBEST" <<'PY' 2>>"$LOG"
import json,sys
uv,abs_,model,name,fp,fo,fh,fw,fi,ff,fr,nfr,mhq,mbest=sys.argv[1:]
cfg={"cmd":uv,"args":["run","--project",abs_,"ltx-2-mlx","generate","--distilled","--model",model,"--low-ram"],"ok":True,"label":name,
     "flags":{"prompt":fp,"out":fo,"h":fh,"w":fw,"img":fi or None,"frames":ff or None,"fps":fr or None},"nframes":int(nfr),"fps":24,"modes":{k:v for k,v in (("hq",mhq),("best",mbest)) if v}}
open(".aix-video","w").write(json.dumps(cfg)+"\n")
PY
  [ -s .aix-video ] && { echo "  Image-to-video flag: ${FI:-none found (text-to-video only; the app makes a start image itself)}"; return 0; }
  return 1
}

NFR=49   # frames per clip (must be 8n+1): 49 = 2 s at 24 fps; raise to 97 for 4 s if your Mac keeps up
rm -f .aix-video
say "2/4 Installing the LTX-2.5 engine (community MLX port, pinned)"
OK=0
if setup ltx-2-mlx-25 https://github.com/MrMoferFRAN/ltx-2-mlx.git ltx25 57952288076766abe27dda3a774b2c24f7346977; then
  try "LTX-2.5" ltx-2-mlx-25 MrMofer/ltx-2.5-mlx-q8 && OK=1
else echo "  LTX-2.5 engine install failed (see $LOG)."; fi
if [ $OK = 0 ]; then
  say "2/4 Falling back to LTX-2.3"
  if setup ltx-2-mlx-23 https://github.com/dgrauet/ltx-2-mlx.git main ""; then
    try "LTX-2.3" ltx-2-mlx-23 dgrauet/ltx-2.3-mlx-q4 && OK=1
  fi
fi
say "4/4 Done"
if [ $OK = 1 ]; then
  echo "  Local video is ready: $(python3 -c 'import json;print(json.load(open(".aix-video"))["label"])' 2>/dev/null) (1 credit per second, 5 minimum). The chat model is unloaded while a clip renders and reloads on the next chat."
else
  fail "The local video test did not pass (details: $LOG)."
fi
