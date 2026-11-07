#!/bin/zsh
# make-series.sh [voice] [script-prefix] — narrate and record every script in scripts/ into videos/beginners/<voice>/.
#   ./make-series.sh                      all videos, default voice
#   ./make-series.sh kokoro:am_liam 01   just the first video, the other voice
# Narration is cached per sentence block, so re-running after editing a script only regenerates what changed.
setopt pipefail   # a narrate.py failure must stop the run, not just whatever grep prints
cd "$(dirname "$0")"
voice=${1:-kokoro:bm_fable}; only=${2:-}
tag=${voice/:/-}
out=../../videos/beginners/$tag; mkdir -p "$out"
for f in scripts/$only*.md; do
  n=${f:t:r}
  print "=== $n · $voice"
  uv run --project .. python narrate.py "$f" --voice "$voice" 2>&1 | grep -E "narrate:|clip |retry|WARNING|lint|said:|heard:|→" || exit 1
  node studio.js "build/$n/$tag/manifest.json" "$out/$n.mp4" 2>&1 | grep -E "wrote|FAILED|PROBLEMS|CHECK|could not|no button|rror"
done
