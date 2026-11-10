#!/bin/zsh
# make-series.sh [voice] [chapter or lesson] — narrate and record each video under videos/<book>/<ch>/. Everything stays in that folder.
#   ./make-series.sh                                                  every chapter, default voice
#   ./make-series.sh kokoro:bm_fable clrs/ch01                        one chapter
#   ./make-series.sh kokoro:bm_fable clrs/ch01/05-solution-insertion-sort   one lesson
# A chapter made of lessons (videos/<book>/<ch>/NN-name/script.md) records each lesson as its own video, in order;
# a chapter without lessons records its one script.md. Narration is cached per sentence block, so re-running after an edit
# only regenerates what changed.
setopt pipefail   # a narrate.py failure must stop the run, not just whatever grep prints
cd "$(dirname "$0")/../.."
voice=${1:-kokoro:bm_fable}; only=${2:-}
tag=${voice/:/-}
for ch in videos/${only:-*/*}(/N); do
  files=($ch/[0-9][0-9]-*/script.md(N))
  (( $#files )) || files=($ch/script.md(N))
  for f in $files; do
    print "=== ${f:h} · $voice"
    uv run --project tools python tools/video/narrate.py "$f" --voice "$voice" 2>&1 | grep -E "narrate:|clip |retry|WARNING|lint|said:|heard:|→" || exit 1
    node tools/video/studio.js "${f:h}/build/$tag/manifest.json" 2>&1 | grep -E "wrote|FAILED|PROBLEMS|CHECK|could not|no button|rror|typing ran"
  done
done
