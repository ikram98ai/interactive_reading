#!/bin/sh
# landscape.sh <short.mp4> [out.mp4] — turn a split short (1080×1920: editor on top, machine below, cut at y = 960)
# into a landscape video: the two halves side by side, scaled into 1920×1080 on the page's background.
# The editor goes on the left, the machine on the right; the audio is copied as it is.
set -e
in="$1"; out="${2:-${1%.mp4}-landscape.mp4}"
[ -f "$in" ] || { echo "usage: landscape.sh <short.mp4> [out.mp4]" >&2; exit 1; }
ffmpeg -y -loglevel error -i "$in" -filter_complex \
  "[0:v]crop=1080:960:0:0[code];[0:v]crop=1080:960:0:960[pic];[code][pic]hstack=2,scale=1920:-2:flags=lanczos,pad=1920:1080:0:(oh-ih)/2:color=0x0d1220,format=yuv420p[v]" \
  -map "[v]" -map 0:a? -c:v libx264 -preset slow -crf 16 -c:a copy -movflags +faststart "$out"
echo "wrote $out"
