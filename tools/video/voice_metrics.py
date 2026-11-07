#!/usr/bin/env python3
"""voice_metrics.py <a.wav> [b.wav …] — numbers for a voice: is it male (median pitch), how fast, how varied, where it pauses.
A human narrator's pitch moves around a lot and their pauses are uneven; those are the two tells a flat TTS gives away."""
import json, sys
import numpy as np
import soundfile as sf


def pitch(w, sr):
    """Autocorrelation pitch per 40 ms frame, voiced frames only."""
    n = int(0.04 * sr); hop = int(0.01 * sr); out = []
    lo, hi = int(sr / 320), int(sr / 65)
    for i in range(0, len(w) - n, hop):
        f = w[i:i + n] * np.hanning(n)
        if np.sqrt((f ** 2).mean()) < 0.01: continue
        c = np.fft.irfft(np.abs(np.fft.rfft(f, 2 * n)) ** 2)[:hi + 1]
        if c[0] <= 0: continue
        c = c / c[0]; k = lo + int(np.argmax(c[lo:hi]))
        if c[k] > 0.45: out.append(sr / k)
    return np.array(out)


def pauses(w, sr):
    """Silences of 120 ms or more between speech, in seconds."""
    frame = int(0.01 * sr)
    e = np.sqrt(np.convolve(w ** 2, np.ones(frame) / frame, mode="same")[::frame] + 1e-12)
    th = max(e.max() * 0.035, 3e-4); sil = e < th; out = []; run = 0; seen = False
    for s in sil:
        if s: run += 1
        else:
            if seen and run >= 12: out.append(run * 0.01)
            run = 0; seen = True
    return np.array(out)


def measure(path):
    w, sr = sf.read(path, dtype="float32", always_2d=True); w = w.mean(axis=1)
    w = w / (np.abs(w).max() + 1e-9)
    p = pitch(w, sr); q = pauses(w, sr)
    semis = 12 * np.log2(p / np.median(p)) if len(p) else np.array([0])
    return {"dur": round(len(w) / sr, 2), "f0_median_hz": round(float(np.median(p)), 1) if len(p) else None,
            "f0_range_semitones": round(float(np.percentile(semis, 95) - np.percentile(semis, 5)), 1),
            "n_pauses": int(len(q)), "pause_mean_s": round(float(q.mean()), 2) if len(q) else 0,
            "pause_max_s": round(float(q.max()), 2) if len(q) else 0, "pause_cv": round(float(q.std() / q.mean()), 2) if len(q) else 0}


if __name__ == "__main__":
    for f in sys.argv[1:]:
        print(f.split("/")[-1], json.dumps(measure(f)))
