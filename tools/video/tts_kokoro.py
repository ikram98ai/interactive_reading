#!/usr/bin/env python3
"""tts_kokoro.py jobs.json — synthesize narration with Kokoro-82M (Apache 2.0), locally, via kokoro-onnx.
jobs.json: { "voice": "af_heart", "speed": 1.0, "items": [{ "text": "...", "out": "/path/clip.wav" }, ...] }
An item may give "parts" (its sentences) instead of "text": each is spoken on its own and they are joined, a sliver of
silence apart, into one clip. A sentence spoken on its own ends the way a person ends one, its last t or s whole and
then quiet; inside one long take, Kokoro runs it into the next sentence, and a pause cut in there clips it.
Each take ends in about two thirds of a second of low murmur after its last sound (−23 to −30 dB, nothing above 4 kHz),
which a listener hears as silence but breathe() doesn't: left in, every stop after a sentence ran 1.2–1.5 s (CLRS
chapter 3, 2026-11-22). speech_only() cuts it, keeping each take's last t or s, which is louder or hisses above 4 kHz.
Setup (once):  make setup models"""
import json, pathlib, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = pathlib.Path(__file__).resolve().parent
job = json.load(open(sys.argv[1]))
k = Kokoro(str(HERE / "models/kokoro-v1.0.onnx"), str(HERE / "models/voices-v1.0.bin"))
voice = job.get("voice", "af_heart")
lang = "en-gb" if voice.startswith("b") else "en-us"
JOIN = 0.05   # seconds between sentences here; narrate.py's breathe() opens the real stop
SPEECH_DB, HISS, KEEP, FADE = -20, 0.3, 0.06, 0.03   # a sound is louder than this, or this share of it is above 4 kHz


def speech_only(s, rate):
    """The take up to its last sound, KEEP s after it, fading out: Kokoro's murmur after the sentence is cut."""
    hop = int(0.025 * rate); n = len(s) // hop
    if n < 4: return s
    f = s[:n * hop].reshape(n, hop)
    db = 20 * np.log10(np.sqrt((f ** 2).mean(1)) + 1e-9); db -= np.percentile(db, 95)
    X = np.abs(np.fft.rfft(f * np.hanning(hop), axis=1)) ** 2; hz = np.fft.rfftfreq(hop, 1 / rate)
    hiss = X[:, hz > 4000].sum(1) / (X.sum(1) + 1e-12)
    sound = np.flatnonzero((db > SPEECH_DB) | ((hiss > HISS) & (db > -40)))
    if not len(sound): return s
    end = min(len(s), (sound[-1] + 1) * hop + int(KEEP * rate))
    s = s[:end].copy(); k = min(int(FADE * rate), len(s)); s[-k:] *= np.linspace(1, 0, k)
    return s

for i, it in enumerate(job["items"], 1):
    takes = [k.create(t, voice=voice, speed=float(job.get("speed", 1.0)), lang=lang) for t in it.get("parts") or [it["text"]]]
    rate = takes[0][1]
    takes = [(speech_only(s, r), r) for s, r in takes]
    gap = np.zeros(int(JOIN * rate), dtype=takes[0][0].dtype)
    samples = np.concatenate([x for n, (s, _) in enumerate(takes) for x in ((gap, s) if n else (s,))])
    sf.write(it["out"], samples, rate)
    print(f"   clip {i}/{len(job['items'])}: {len(samples) / rate:.1f} s of speech", flush=True)
