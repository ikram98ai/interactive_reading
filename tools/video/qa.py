#!/usr/bin/env python3
"""qa.py videos/<book>/<ch>/<ch>-<voice>.mp4 — step 8 of the record-video skill: measure a finished video against the
series' quality bar, and exit 1 if any measure fails.

The targets come from measuring the reference tutorials the series' style follows, and from CLRS chapter 1:
  pace          words (from the .srt beside the video) over the whole running time
  talking pace  the same words over the time the voice is actually talking: a person's speed, never a stretched voice
  breaths       stops a minute between a tenth of a second and 1.2 s: how often the voice pauses, the clearest tell of a
                TTS reading in one breath (the reference teacher: 40 to 45 a minute; this series before 2026-11-22: 22)
  long stops    stops over 1.5 s a minute over a still picture: talking, then dead air, then talking
  motion        share of time the picture is moving, and visual changes a minute
  silence       the longest pause in the middle of the video (cards excluded: they're still)
  silent motion the picture keeps moving while nobody speaks: the narration is too short for that animation
  clutter       share of the frame that isn't background
  clipped stops pauses cut through the middle of a sound, heard as a chop: loud just before the pause and just after
                it. Natural speech fades below −21 dB in the last few ms before a pause (CLRS chapter 1, 129 pauses);
                narrate.py's old breathe() left cuts up to −1 dB (chapter 3 before 2026-11-22). A stop fails when one
                edge is above −15 dB and the other above −32 dB. A word may start (or stop) sharply on its own after a
                real silence ("theta", 2026-11-23), so a stop loud on one side only is listed to listen to, not failed
Prints each one with its target, then the timestamps of anything to fix."""
import re, subprocess, sys
import numpy as np

W, H, FPS = 320, 180, 30
#              target,           warn outside,    fail outside
# Each kind of video (its script's `kind:`) has its own bar, from the same tutorials measured video by video: code videos talk
# slower and type while silent, boards talk between the two (narrate.py's PACE) with less moving, and an editor full
# of code is meant to fill the frame.
BY_KIND = {
    "code": {"pace (wpm)": ((135, 160), (126, 170), (112, 185)), "long stops a minute": ((0, 1.5), (0, 2.5), (0, 4.0)), "moving (% of time)": ((0, 70), (0, 80), (0, 95)),
             "changes a minute": ((0, 40), (0, 60), (0, 90)), "longest pause (s)": ((0, 3.5), (0, 4.5), (0, 6.0)),
             "silent motion (s)": ((0, 3.0), (0, 5.0), (0, 8.0)), "clutter (% of frame)": ((0, 40), (0, 50), (0, 70))},
    # a YouTube Short (kind: short): a concept on the chapter page, then its Rust in the editor, in at most three minutes
    "short": {"pace (wpm)": ((145, 178), (136, 187), (117, 196)), "moving (% of time)": ((4, 55), (3, 70), (1, 90)),
              "changes a minute": ((6, 35), (4, 50), (2, 80)), "longest pause (s)": ((0, 2.0), (0, 2.5), (0, 3.5)),
              "silent motion (s)": ((0, 2.0), (0, 3.0), (0, 5.0)), "clutter (% of frame)": ((0, 35), (0, 45), (0, 65)),
              "length (s)": ((0, 90), (0, 120), (0, 180)), "first word (s)": ((0, 0.6), (0, 1.0), (0, 2.0))},
    "board": {"pace (wpm)": ((131, 178), (122, 187), (108, 201)), "moving (% of time)": ((0, 12), (0, 16), (0, 25)),
              "changes a minute": ((0, 14), (0, 18), (0, 25)), "longest pause (s)": ((0, 3.0), (0, 3.5), (0, 5.0)),
              "silent motion (s)": ((0, 1.5), (0, 2.5), (0, 4.0)), "clutter (% of frame)": ((0, 15), (0, 20), (0, 30))},
}
BAR = {
    # The video is slower than the reference teacher's 180 (the author's choice), but the voice talks as fast as a person
    # does: the slower pace comes from breathing (narrate.py breathe, the script's commas and {beat}s), 2026-11-22.
    "pace (wpm)":            ((150, 172), (142, 180), (130, 192)),
    "talking pace (wpm)":    ((205, 260), (195, 270), (180, 285)),
    "breaths a minute":      ((34, 50), (28, 56), (20, 64)),
    "long stops a minute":   ((0, 0.5), (0, 1.0), (0, 2.0)),
    "moving (% of time)":    ((5, 11), (4, 12), (2, 15)),
    "changes a minute":      ((6, 10), (4, 13), (2, 16)),
    "longest pause (s)":     ((0, 3.0), (0, 3.5), (0, 5.0)),
    "silent motion (s)":     ((0, 1.5), (0, 2.5), (0, 4.0)),
    "clutter (% of frame)":  ((0, 6), (0, 8), (0, 12)),
    "clipped stops":         ((0, 0), (0, 0), (0, 0)),   # every one is heard, in any kind of video
}
CLIP_DB, CLIP_NEAR, CLIP_OTHER = -15, -18, -32   # loud edge, an edge worth a listen, and how loud the other edge must be


def picture(path, W=W, H=H, mask=None):
    """Stream the video small and grey: per frame, did it move; once a second, how much of it isn't background.
    mask [(top, bottom), …], as fractions of the height, leaves out bands: a short's burned-in captions change by design."""
    p = subprocess.Popen(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vf", f"scale={W}:{H},format=gray", "-r", str(FPS), "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    moving, clutter, prev, n = [], [], None, 0
    while True:
        buf = p.stdout.read(W * H)
        if len(buf) < W * H: break
        f = np.frombuffer(buf, dtype=np.uint8).astype(np.int16).reshape(H, W)
        if mask: f = np.delete(f, np.concatenate([np.arange(int(a * H), int(b * H)) for a, b in mask]), axis=0)
        if prev is not None: moving.append((np.abs(f - prev) > 12).mean() > 0.0003)
        if n % FPS == 0: clutter.append((np.abs(f - np.median(f)) > 25).mean())
        prev, n = f, n + 1
    p.wait()
    return np.array(moving), n / FPS, float(np.median(clutter)) * 100


def silences(path, floor="-35dB", least=0.12):
    err = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", path, "-af", f"silencedetect=noise={floor}:d={least}", "-f", "null", "-"], capture_output=True, text=True).stderr
    ends = [(float(e), float(d)) for e, d in re.findall(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", err)]
    return [(e - d, e) for e, d in ends]


def clipped_stops(path, quiet_db=-45, least=0.06):
    """Each pause of at least `least` s, as (louder edge dB, quieter edge dB, start s): how loud the voice is 4–12 ms
    before the pause starts and after it ends, against the voice's loud parts. A voice that stops on its own has faded
    by then; a cut through a sound leaves both edges loud. None for a video with no sound (a silent pass)."""
    sr, hop = 48000, 96   # 2 ms
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
    w = np.frombuffer(raw, dtype=np.float32); n = len(w) // hop
    if n < 100: return None
    env = np.sqrt((w[:n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12)
    db = 20 * np.log10(env / max(float(np.percentile(env, 95)), 1e-9))
    q = (db < quiet_db).astype(np.int8); d = np.diff(np.r_[0, q, 0])
    out = []
    for a, b in zip(np.flatnonzero(d == 1), np.flatnonzero(d == -1)):
        if (b - a) * hop / sr < least or a < 10 or b > n - 10: continue
        pre, post = float(db[a - 6:a - 2].max()), float(db[b + 2:b + 6].max())
        out.append((max(pre, post), min(pre, post), a * hop / sr))
    return out


def words(path):
    try: srt = open(re.sub(r"\.mp4$", ".srt", path)).read()
    except OSError: sys.exit(f"qa: no captions beside {path}; studio.js writes them with the video")
    return len(re.findall(r"[A-Za-z']+", re.sub(r"^\d+\s*$|^.*-->.*$", "", srt, flags=re.M)))


def clock(t): return f"{int(t // 60)}:{int(t % 60):02d}"


def main():
    if len(sys.argv) != 2: sys.exit(__doc__)
    path = sys.argv[1]
    try: kind = re.search(r"^kind:\s*(\w+)", open(re.sub(r"[^/]+$", "script.md", path)).read(), re.M).group(1)
    except (OSError, AttributeError): kind = "chapter"
    bar = dict(BAR, **BY_KIND.get(kind, {}))
    # a script can accept one measure for a written reason (front matter `qa-allow: clutter (why)`): it can warn, never fail
    try: allow = re.search(r"^qa-allow:\s*(.+)$", open(re.sub(r"[^/]+$", "script.md", path)).read(), re.M).group(1)
    except (OSError, AttributeError): allow = ""
    # a short stands up, and its captions (studio.js SHORT.cap, 1262 px of 1920, two lines at most) aren't the picture moving;
    # a split short (split: true) burns one line in at SPLIT.cap, 1528 px, below the editor, or at SPLIT.footCap, 1848 px,
    # below the machine while it fills the bottom half, so those two bands are left out instead
    try: split = bool(re.search(r"^split:\s*true\s*$", open(re.sub(r"[^/]+$", "script.md", path)).read(), re.M))
    except OSError: split = False
    if kind == "short" and split:
        bar["length (s)"] = ((0, 180), (0, 180), (0, 180))   # the author's cap: under three minutes
        bar["breaths a minute"] = ((26, 40), (22, 46), (16, 52))   # the author's choice for shorts (2026-11-22): denser than a long video
    band = [(0.79, 0.85), (0.96, 1.0)] if split else [(0.645, 0.78)]
    moving, dur, clutter = picture(path, *((H, W, band) if kind == "short" else (W, H)))
    # a change is a run of motion; gaps under a fifth of a second belong to the same change
    changes, i = 0, 0
    while i < len(moving):
        if moving[i]:
            changes += 1
            while i < len(moving) and moving[i:i + 6].any(): i += 1
        i += 1
    edge = 1 if kind == "short" else 3
    quiet = [(s, e) for s, e in silences(path) if s > edge and e < dur - edge]  # the opening and the fade-out are allowed to be quiet
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
        "talking pace (wpm)": words(path) / max(1.0, dur - sum(e - s for s, e in quiet)) * 60,
        "breaths a minute": sum(1 for s, e in quiet if e - s <= 1.2) / dur * 60,
        "long stops a minute": sum(1 for p, _ in pauses if p > 1.5) / dur * 60,
        "moving (% of time)": moving.mean() * 100,
        "changes a minute": changes / dur * 60,
        "longest pause (s)": max([p for p, _ in pauses], default=0),
        "silent motion (s)": max([m for m, _ in talkless], default=0),
        "clutter (% of frame)": clutter,
    }
    stops = clipped_stops(path)
    if stops is not None: got["clipped stops"] = sum(1 for e, o, _ in stops if e > CLIP_DB and o > CLIP_OTHER)
    if kind == "short":   # a short has a hard cap, and it must be talking before a thumb scrolls past
        got["length (s)"] = dur
        sil = silences(path)
        got["first word (s)"] = sil[0][1] if sil and sil[0][0] < 0.05 else 0.0
    worst = 0
    print(f"{path}  ·  {clock(dur)}  ·  {kind}")
    for k, v in got.items():
        (t0, t1), (w0, w1), (f0, f1) = bar[k]
        grade = 0 if t0 <= v <= t1 else 1 if w0 <= v <= w1 else 2 if f0 <= v <= f1 else 3
        if allow and k.startswith(allow.split()[0]): grade = min(grade, 2)
        worst = max(worst, grade)
        print(f"  {['ok  ', 'near', 'WARN', 'FAIL'][grade]}  {k:<22} {v:7.1f}   target {t0:g}–{t1:g}" + (f"   allowed: {allow}" if allow and k.startswith(allow.split()[0]) and grade else ""))
    fix = [x for x in sorted(talkless, reverse=True) if x[0] >= 1.0][:8]
    if fix: print("  silent motion at: " + ", ".join(f"{clock(s)} ({m:.1f} s)" for m, s in fix) + "  → talk over it, or raise {speed}")
    long_ = sorted((p, s) for p, s in pauses if p > 3.0)
    if stops:
        cut = sorted((s, e) for e, o, s in stops if e > CLIP_DB and o > CLIP_OTHER)
        near = sorted((s, e) for e, o, s in stops if e > CLIP_NEAR and not (e > CLIP_DB and o > CLIP_OTHER))
        if cut: print("  clipped stops at: " + ", ".join(f"{clock(s)} ({e:.0f} dB)" for s, e in cut) + "  → narrate.py breathe() cut into a word there")
        if near: print("  listen to the stops at: " + ", ".join(f"{clock(s)} ({e:.0f} dB)" for s, e in near))
    if long_: print("  long pauses at: " + ", ".join(f"{clock(s)} ({p:.1f} s)" for p, s in long_))
    sys.exit(1 if worst == 3 else 0)


if __name__ == "__main__":
    main()
