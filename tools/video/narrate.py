#!/usr/bin/env python3
"""narrate.py videos/<book>/<ch>/script.md --voice kokoro:bm_fable [--silent] — turn a video script into timed narration.
Everything a chapter's video needs stays in its folder: script.md, build/ (clips, manifest, frames) and the finished video.

  1. parse the script: spoken text plus {cues}, which fire at the word they sit in front of
  2. lint the spoken text: no digits, no recited runs of numbers (see LINT)
  3. synthesize each block (cached by text + voice) with tts_kokoro.py
  4. transcribe each clip with Whisper: word times place the cues, and a clip that does not say what the script
     says (a TTS slip) is reported
  5. trim, level and write build/<voice>/manifest.json for studio.js

--silent skips 3 and 4 and estimates timing at 150 words a minute: a fast way to check the highlights.
--only "Part 1" narrates just the section whose {goto} contains that text, into its own build folder: a fast way to judge one part."""
import argparse, difflib, hashlib, json, pathlib, random, re, subprocess, sys
import numpy as np
import soundfile as sf

HERE = pathlib.Path(__file__).resolve().parent
MAX_WORDS = 48          # longer blocks drift; split at a sentence end
MAX_WER = 0.10          # above this, the clip probably misread the script
RETRIES = 0             # Kokoro says a text the same way every time, so a clip that differs is reported, not regenerated
SR = 48000
SPEED = 0.92            # Kokoro's rate: about 190 words a minute, the pace of the tutorials these videos are modelled on
_whisper = None

NUM_WORD = r"(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)"


def parse(path):
    raw = pathlib.Path(path).read_text()
    m = re.match(r"---\n(.*?)\n---\n(.*)", raw, re.S)
    meta, targets, inT = {}, {}, False
    for line in m.group(1).splitlines():
        if line.startswith("targets:"): inT = True; continue
        if inT and line.startswith("  "):
            k, v = line.strip().split(":", 1); targets[k.strip()] = v.strip(); continue
        k, v = line.split(":", 1); meta[k.strip()] = v.strip(); inT = False
    meta["targets"] = targets
    segs = []
    body = re.sub(r"<!--.*?-->", "", m.group(2), flags=re.S)  # notes for the author: never spoken, never cued
    for para in re.split(r"\n\s*\n", body.strip()):
        cur = {"text": [], "cues": [], "then": None}
        for tok in re.findall(r"\{[^}]*\}|[^\s{]+", para):
            if tok.startswith("{"):
                body = tok[1:-1].strip()
                op, _, arg = body.partition(" ")
                if op in ("pause", "await"):
                    cur["then"] = {"pause": float(arg)} if op == "pause" else {"await": True}
                    segs.append(cur); cur = {"text": [], "cues": [], "then": None}
                else:
                    cur["cues"].append({"w": len(cur["text"]), "op": op, "arg": arg})
            else:
                cur["text"].append(tok)
        if cur["text"] or cur["cues"]: segs.append(cur)
        if segs: segs[-1]["para_end"] = True
    out = []
    for s in segs:   # split long blocks at sentence ends, keeping each cue on its word
        words = s["text"]
        while len(words) > MAX_WORDS:
            ends = [i + 1 for i, w in enumerate(words[:MAX_WORDS]) if re.search(r"[.?!]$", w)]
            cut = ends[-1] if ends else MAX_WORDS
            out.append({"text": words[:cut], "cues": [c for c in s["cues"] if c["w"] < cut], "then": None})
            s["cues"] = [dict(c, w=c["w"] - cut) for c in s["cues"] if c["w"] >= cut]
            words = words[cut:]
        s["text"] = words
        out.append(s)
    return meta, out


def lint(segs):
    bad = []
    for s in segs:
        t = " ".join(s["text"])
        if "TODO" in t: bad.append(f"unfinished: {t!r}")
        bad += [f"unfinished cue: {{{c['op']} {c['arg']}}}" for c in s["cues"] if "TODO" in c["arg"]]
        if re.search(r"\d", t): bad.append(f"digit in speech: {t!r}")
        if re.search(r"[=×÷<>%&#@/\\_^]", t): bad.append(f"symbol in speech: {t!r}")
        for sent in re.split(r"(?<=[.?!])\s+", t):
            # a sentence that lists numbers is the robot reading the screen
            distinct = re.findall(rf"\b{NUM_WORD}\b(?:[- ]{NUM_WORD}\b)*", sent.lower())
            if len(distinct) > 2: bad.append(f"recites {len(distinct)} numbers: {sent!r}")
            if len(sent.split()) > 34: bad.append(f"too long to say in one breath ({len(sent.split())} words): {sent!r}")
    return bad


def norm(tok):
    return re.sub(r"[^a-z0-9']", "", tok.lower().replace("’", "'"))


def spoken_digits(words):
    """Whisper writes numbers as digits; put them back in words so they compare with the script."""
    from num2words import num2words
    out = []
    for w in words:
        n = re.sub(r"[,$]", "", w["word"]).strip(" .?!,")
        if re.fullmatch(r"\d+", n):
            for piece in num2words(int(n)).replace("-", " ").replace(",", "").replace(" and ", " ").split():
                out.append(dict(w, word=piece))
        else:
            out.append(w)
    return out


def whisper():
    """Loaded once, on the first clip that needs it. Runs on the CPU: CTranslate2 has no Apple GPU backend."""
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
    return _whisper


def transcribe(wav):
    segments, _ = whisper().transcribe(str(wav), language="en", word_timestamps=True, condition_on_previous_text=False)
    return spoken_digits([{"word": w.word, "start": w.start, "end": w.end} for seg in segments for w in seg.words])


def align(script_words, heard):
    """Each script word gets a start and end time; words the recogniser missed are interpolated from their neighbours."""
    a = [norm(w) for w in script_words]
    b = [norm(w["word"]) for w in heard]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    start = [None] * len(a); end = [None] * len(a)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            start[blk.a + k] = float(heard[blk.b + k]["start"]); end[blk.a + k] = float(heard[blk.b + k]["end"])
    edits = sum(max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != "equal")
    wer = edits / max(1, len(a))
    if heard:
        known = [i for i, s in enumerate(start) if s is not None]
        for i in range(len(a)):
            if start[i] is None and known:
                lo = max([k for k in known if k < i], default=None); hi = min([k for k in known if k > i], default=None)
                if lo is None: start[i] = start[hi]; end[i] = start[hi]
                elif hi is None: start[i] = end[lo]; end[i] = end[lo]
                else:
                    f = (i - lo) / (hi - lo); start[i] = end[lo] + f * (start[hi] - end[lo]); end[i] = start[i]
    return start, end, wer


def finish(src, dst):
    """Trim the clip to the speech, keep a sliver of air each side, level it, and fade the edges so joins don't click."""
    w, sr = sf.read(src, dtype="float32", always_2d=True); w = w.mean(axis=1)
    if sr != SR:
        import soxr
        w = soxr.resample(w, sr, SR); sr = SR
    frame = int(0.02 * sr)
    rms = np.sqrt(np.convolve(w ** 2, np.ones(frame) / frame, mode="same") + 1e-12)
    voiced = np.where(rms > max(rms.max() * 0.02, 1e-4))[0]
    a = max(0, voiced[0] - int(0.06 * sr)); b = min(len(w), voiced[-1] + int(0.14 * sr))
    w = w[a:b]
    active = w[np.abs(w) > np.abs(w).max() * 0.05]
    w = w * (0.10 / (np.sqrt((active ** 2).mean()) + 1e-9))
    w = np.clip(w, -0.98, 0.98)
    f = int(0.012 * sr); w[:f] *= np.linspace(0, 1, f); w[-f:] *= np.linspace(1, 0, f)
    sf.write(dst, w, sr, subtype="PCM_16")
    return len(w) / sr, a / sr


def gap_after(seg, rng):
    """How long a person breathes here. Longer after a question or a finished thought, never metronomic."""
    if not seg["text"]: return 0.0
    last = seg["text"][-1]
    if seg.get("para_end"):
        base = (0.12, 0.28)   # on top of the air finish() leaves and the voice's own tail, which together come to about 0.6 s
    elif last.endswith("?"): base = (0.1, 0.22)
    elif last.endswith("..."): base = (0.15, 0.3)
    else: base = (0.04, 0.14)
    return round(rng.uniform(*base), 3)


def synth(engine, voice, items, work):
    if not items: return
    if engine != "kokoro": sys.exit(f"narrate: {len(items)} clips are not cached for {engine}:{voice}, and only kokoro: voices can make new ones.")
    jobs = work / f"jobs-{hashlib.md5(json.dumps(items).encode()).hexdigest()[:8]}.json"
    jobs.write_text(json.dumps({"voice": voice, "speed": SPEED, "items": items}))
    subprocess.run([sys.executable, str(HERE / "tts_kokoro.py"), str(jobs)], check=True)
    jobs.unlink()


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("script"); ap.add_argument("--voice", default="kokoro:bm_fable"); ap.add_argument("--silent", action="store_true"); ap.add_argument("--no-lint", action="store_true"); ap.add_argument("--only")
    a = ap.parse_args()
    engine, voice = a.voice.split(":", 1)
    meta, segs = parse(a.script)
    home = pathlib.Path(a.script).resolve().parent
    name, build = home.name, home / "build"
    if a.only:
        heads = [i for i, s in enumerate(segs) if any(c["op"] == "goto" for c in s["cues"])]
        hit = next((i for i in heads if a.only.lower() in next(c["arg"] for c in segs[i]["cues"] if c["op"] == "goto").lower()), None)
        if hit is None: sys.exit(f"narrate: no {{goto}} contains {a.only!r}")
        meta["scene"] = next(c["arg"] for c in segs[hit]["cues"] if c["op"] == "goto").split("|")[0].strip()
        segs = segs[hit:next((i for i in heads if i > hit), len(segs))]
        part = re.sub(r"\W+", "-", a.only.lower()).strip("-")
        name += "-" + part; build /= part
    problems = lint(segs) + [f"unfinished front matter: {k}: {v}" for k, v in meta.items() if isinstance(v, str) and "TODO" in v] \
        + [f"names another creator in front matter: {k}" for k, v in meta.items() if isinstance(v, str) ]
    if problems and not a.no_lint: sys.exit("script lint failed:\n  " + "\n  ".join(problems))
    tag = "silent" if a.silent else f"{engine}-{voice}"
    out = build / tag; (out / "raw").mkdir(parents=True, exist_ok=True)
    rng = random.Random(meta.get("seed", 1))
    base = int(meta.get("seed", 1))
    res = []
    for i, s in enumerate(segs):
        words = s["text"]; text = " ".join(words)
        rec = {"i": i, "text": text, "words": words, "cues": s["cues"], "then": s["then"], "gap": gap_after(s, rng), "dur": 0.0, "wav": None}
        res.append(rec)
        if not words: continue
        rec["key"] = hashlib.md5(f"{tag}|{SPEED}|{text}".encode()).hexdigest()[:12]
    if a.silent:
        for r in res:
            r["dur"] = len(r["words"]) * 0.4
            r["start"] = [k * 0.4 for k in range(len(r["words"]))]; r["end"] = [(k + 1) * 0.4 for k in range(len(r["words"]))]
    else:
        todo = [r for r in res if r["words"]]
        for attempt in range(RETRIES + 1):
            need = [{"text": r["text"], "out": str(out / "raw" / f"{r['key']}.wav"), "seed": base + attempt * 101 + r["i"]} for r in todo if not (out / "raw" / f"{r['key']}.wav").exists()]
            if need: print(f"{name}: synthesizing {len(need)} clips with {a.voice} (attempt {attempt + 1})", flush=True); synth(engine, voice, need, out)
            bad = []
            for r in todo:
                raw = out / "raw" / f"{r['key']}.wav"; clean = out / f"seg{r['i']:03d}.wav"
                r["dur"], _ = finish(raw, clean); r["wav"] = str(clean)
                cache = out / "raw" / f"{r['key']}.words.json"
                heard = json.loads(cache.read_text()) if cache.exists() else transcribe(clean)
                cache.write_text(json.dumps(heard, default=float))
                r["start"], r["end"], r["wer"] = align(r["words"], heard)
                r["heard"] = " ".join(w["word"].strip() for w in heard)
                if r["wer"] > MAX_WER: bad.append(r)
            if not bad or attempt == RETRIES: break
            for r in bad:
                print(f"   retry: WER {r['wer']:.2f}\n     said: {r['text']}\n     heard: {r['heard']}", flush=True)
                (out / "raw" / f"{r['key']}.wav").unlink(); (out / "raw" / f"{r['key']}.words.json").unlink()
            todo = bad
        left = [r for r in res if r.get("wer", 0) > MAX_WER]
        if left: print(f"WARNING: {len(left)} clips still differ from the script after {RETRIES} retries:", *[f"\n  {r['text']}\n  heard: {r['heard']}" for r in left])
    for r in res:
        for c in r["cues"]:
            c["t"] = 0.0 if c["w"] == 0 or not r["words"] else (r["start"][c["w"]] if c["w"] < len(r["words"]) else r["dur"])
    (out / "manifest.json").write_text(json.dumps({"meta": meta, "name": name, "out": str(home / f"{name}-{'silent' if a.silent else voice}.mp4"), "voice": a.voice, "silent": a.silent, "segments": res}, indent=1, default=float))
    words = sum(len(r["words"]) for r in res); dur = sum(r["dur"] + r["gap"] for r in res)
    print(f"{name}: {len(res)} blocks, {words} words, about {dur / 60:.1f} min of speech. → {out}/manifest.json")


if __name__ == "__main__":
    main()
