#!/bin/zsh
# make-all.sh — record every script in tools/video/scripts into videos/ (one after the other)
cd "$(dirname "$0")"
for f in ../../videos/scripts/algo-ch01-*.json; do
  out="../../videos/$(basename ${f%.json}).mp4"
  echo "=== $f → $out"; node record.js "$f" "$out" 2>&1 | grep -E "^\[|wrote|rror"
done
