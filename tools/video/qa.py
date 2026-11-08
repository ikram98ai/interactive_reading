#!/usr/bin/env python3
"""qa.py videos/<book>/<ch>/<ch>-<voice>.mp4 — the last step of tools/video/BLUEPRINT.md: measure a finished video against the
series' quality bar, and exit 1 if any measure fails.

The targets come from measuring the reference tutorials the series' style follows, and from CLRS chapter 1:
  pace          words (from the .srt beside the video) over the whole running time
  motion        share of time the picture is moving, and visual changes a minute
  silence       the longest pause in the middle of the video (cards excluded: they're still)
  silent motion the picture keeps moving while nobody speaks: the narration is too short for that animation
  clutter       share of the frame that isn't background
Prints each one with its target, then the timestamps of anything to fix."""
import re, subprocess, sys
import numpy as np

W, H, FPS = 320, 180, 30
#              target,           warn outside,    fail outside
BAR = {
    "pace (wpm)":            ((180, 195), (170, 205), (155, 215)),
    "moving (% of time)":    ((5, 11), (4, 12), (2, 15)),
    "changes a minute":      ((6, 10), (4, 13), (2, 16)),
    "longest pause (s)":     ((0, 3.0), (0, 3.5), (0, 5.0)),
    "silent motion (s)":     ((0, 1.5), (0, 2.5), (0, 4.0)),
    "clutter (% of frame)":  ((0, 6), (0, 8), (0, 12)),
}


def picture(path):
    """Stream the video small and grey: per frame, did it move; once a second, how much of it isn't background."""
    p = subprocess.Popen(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vf", f"scale={W}:{H},format=gray", "-r", str(FPS), "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    moving, clutter, prev, n = [], [], None, 0
    while True:
        buf = p.stdout.read(W * H)
        if len(buf) < W * H: break
        f = np.frombuffer(buf, dtype=np.uint8).astype(np.int16).reshape(H, W)
        if prev is not None: moving.append((np.abs(f - prev) > 12).mean() > 0.0003)
        if n % FPS == 0: clutter.append((np.abs(f - np.median(f)) > 25).mean())
        prev, n = f, n + 1
    p.wait()
    return np.array(moving), n / FPS, float(np.median(clutter)) * 100


def silences(path, floor="-35dB", least=0.12):
    err = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", path, "-af", f"silencedetect=noise={floor}:d={least}", "-f", "null", "-"], capture_output=True, text=True).stderr
    ends = [(float(e), float(d)) for e, d in re.findall(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", err)]
    return [(e - d, e) for e, d in ends]


def words(path):
    try: srt = open(re.sub(r"\.mp4$", ".srt", path)).read()
    except OSError: sys.exit(f"qa: no captions beside {path}; studio.js writes them with the video")
    return len(re.findall(r"[A-Za-z']+", re.sub(r"^\d+\s*$|^.*-->.*$", "", srt, flags=re.M)))


def clock(t): return f"{int(t // 60)}:{int(t % 60):02d}"


def main():
    if len(sys.argv) != 2: sys.exit(__doc__)
    path = sys.argv[1]
    moving, dur, clutter = picture(path)
    # a change is a run of motion; gaps under a fifth of a second belong to the same change
    changes, i = 0, 0
    while i < len(moving):
        if moving[i]:
            changes += 1
            while i < len(moving) and moving[i:i + 6].any(): i += 1
        i += 1
    quiet = [(s, e) for s, e in silences(path) if s > 3 and e < dur - 3]  # the opening and the fade-out are allowed to be quiet
    still = lambda s, e: moving[int(s * FPS):int(e * FPS)].mean() if e - s > 0.1 else 0
    # a pause over a still picture is a breath or a card; over a moving one, it's an animation with nobody talking
    pauses = [(e - s, s) for s, e in quiet if still(s, e) < 0.3]
    talkless = []
    for s, e in quiet:
        if e - s < 1.0: continue
        run = moving[int(s * FPS):int(e * FPS)]
        if run.mean() >= 0.3: talkless.append(((e - s) * run.mean(), s))
    got = {
        "pace (wpm)": words(path) / dur * 60,
        "moving (% of time)": moving.mean() * 100,
        "changes a minute": changes / dur * 60,
        "longest pause (s)": max([p for p, _ in pauses], default=0),
        "silent motion (s)": max([m for m, _ in talkless], default=0),
        "clutter (% of frame)": clutter,
    }
    worst = 0
    print(f"{path}  ·  {clock(dur)}")
    for k, v in got.items():
        (t0, t1), (w0, w1), (f0, f1) = BAR[k]
        grade = 0 if t0 <= v <= t1 else 1 if w0 <= v <= w1 else 2 if f0 <= v <= f1 else 3
        worst = max(worst, grade)
        print(f"  {['ok  ', 'near', 'WARN', 'FAIL'][grade]}  {k:<22} {v:7.1f}   target {t0:g}–{t1:g}")
    fix = [x for x in sorted(talkless, reverse=True) if x[0] >= 1.0][:8]
    if fix: print("  silent motion at: " + ", ".join(f"{clock(s)} ({m:.1f} s)" for m, s in fix) + "  → talk over it, or raise {speed}")
    long_ = sorted((p, s) for p, s in pauses if p > 3.0)
    if long_: print("  long pauses at: " + ", ".join(f"{clock(s)} ({p:.1f} s)" for p, s in long_))
    sys.exit(1 if worst == 3 else 0)


if __name__ == "__main__":
    main()
