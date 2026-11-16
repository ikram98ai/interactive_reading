#!/bin/zsh
# make-series.sh [voice] [folder or video] — narrate and record each numbered video in a folder under videos/. Everything
# stays in each video's folder.
#   ./make-series.sh kokoro:bm_fable <book>/<folder>          every N-name/script.md in it, in order
#   ./make-series.sh kokoro:bm_fable <book>/<folder>/2-name   one video
# A folder made of numbered videos (N-name/script.md) records each as its own video; a folder without them records its
# one script.md. A chapter's long form is recorded with narrate.py and studio.js instead (record-video skill).
# Narration is cached per sentence block, so re-running after an edit only regenerates what changed.
setopt pipefail   # a narrate.py failure must stop the run, not just whatever grep prints
cd "$(dirname "$0")/../.."
voice=${1:-kokoro:bm_fable}; only=${2:-}
tag=${voice/:/-}
for ch in videos/${only:-*/*}(/N); do
  files=($ch/[0-9]*-*/script.md(N))   # numbered videos: 1-…, 2-…
  (( $#files )) || files=($ch/script.md(N))
  for f in $files; do
    print "=== ${f:h} · $voice"
    uv run --project tools python tools/video/narrate.py "$f" --voice "$voice" 2>&1 | grep -E "narrate:|clip |retry|WARNING|lint|said:|heard:|→" || exit 1
    node tools/video/studio.js "${f:h}/build/$tag/manifest.json" 2>&1 | grep -E "wrote|FAILED|PROBLEMS|CHECK|could not|no button|rror|typing ran"
  done
done
