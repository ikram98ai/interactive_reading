#!/bin/zsh
# make-series.sh [voice] [chapter] — narrate and record each videos/<book>/<ch>/script.md. Everything stays in that chapter's folder.
#   ./make-series.sh                            all videos, default voice
#   ./make-series.sh kokoro:am_liam clrs/ch01   one chapter, the other voice
# Narration is cached per sentence block, so re-running after editing a script only regenerates what changed.
setopt pipefail   # a narrate.py failure must stop the run, not just whatever grep prints
cd "$(dirname "$0")/../.."
voice=${1:-kokoro:bm_fable}; only=${2:-}
tag=${voice/:/-}
for f in videos/${only:-*/*}/script.md; do
  print "=== ${f:h} · $voice"
  uv run --project tools python tools/video/narrate.py "$f" --voice "$voice" 2>&1 | grep -E "narrate:|clip |retry|WARNING|lint|said:|heard:|→" || exit 1
  node tools/video/studio.js "${f:h}/build/$tag/manifest.json" 2>&1 | grep -E "wrote|FAILED|PROBLEMS|CHECK|could not|no button|rror"
done
