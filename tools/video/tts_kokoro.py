#!/usr/bin/env python3
"""tts_kokoro.py jobs.json — synthesize narration with Kokoro-82M (Apache 2.0), locally, via kokoro-onnx.
jobs.json: { "voice": "af_heart", "speed": 1.0, "items": [{ "text": "...", "out": "/path/clip.wav" }, ...] }
Setup (once):  python3 -m venv tools/video/.venv && tools/video/.venv/bin/pip install kokoro-onnx soundfile
               download kokoro-v1.0.onnx and voices-v1.0.bin (kokoro-onnx release "model-files-v1.0") into tools/video/models/"""
import json, pathlib, sys
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = pathlib.Path(__file__).resolve().parent
job = json.load(open(sys.argv[1]))
k = Kokoro(str(HERE / "models/kokoro-v1.0.onnx"), str(HERE / "models/voices-v1.0.bin"))
voice = job.get("voice", "af_heart")
lang = "en-gb" if voice.startswith("b") else "en-us"
for it in job["items"]:
    samples, rate = k.create(it["text"], voice=voice, speed=float(job.get("speed", 1.0)), lang=lang)
    sf.write(it["out"], samples, rate)
