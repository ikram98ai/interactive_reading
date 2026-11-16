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
A page video can switch to the editor once, at {goto editor | kicker | heading}: from there on it talks at code pace, and
its code cues work as in a code lesson. A code lesson (kind: code) keeps the editor's text in fenced blocks, ```rust @name … ```, which are never spoken. {code name}
types the editor into that snapshot, and {run} shows the program's real output: each snapshot that is run is compiled with
rustc here, and the build fails if it doesn't compile, unless the cue is {run error}, which shows the compiler's error instead.

--only "Part 1" narrates just the section whose {goto} contains that text, into its own build folder: a fast way to judge one part.

A script is narrated only once it has been judged: judgement.py check must pass (a pass verdict whose hash matches the
script's words now). --silent needs no verdict. --skip-judgement is for test renders, never for a video that gets published.
The code language and its compiler come from books/<book>/book.json; only Rust is supported so far."""
import argparse, difflib, hashlib, json, pathlib, random, re, subprocess, sys
import numpy as np
import soundfile as sf
import judgement

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PRONOUNCE = HERE / "pronounce.tsv"   # how the voice says words Kokoro gets wrong (the written words stay as they are)
NEVER_SAY = ROOT / "videos" / "never-say.txt"   # names a video must never say, one per line; kept in the local videos/ repo, off GitHub
MAX_WORDS = 48          # longer blocks drift; split at a sentence end
MAX_WER = 0.10          # above this, the clip probably misread the script
RETRIES = 0             # Kokoro says a text the same way every time, so a clip that differs is reported, not regenerated
SR = 48000
SPEED = 0.92            # Kokoro's rate: about 190 words a minute, the pace of the tutorials these videos are modelled on
# Each kind of video talks at the pace the reference tutorials use: concepts at about 190 words a minute, code videos at
# about 160 (slower, with room between thoughts while the code is typed), boards in between.
PACE = {"code": (0.85, 2.6), "board": (0.88, 1.6)}   # kind → (Kokoro speed, how much longer the gaps between blocks are)
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
    code = {}
    langs = set()
    def keep(mm): langs.add(mm.group(1)); code[mm.group(2)] = mm.group(3); return ""
    body = re.sub(r"```(\w+) @([\w-]+)[ \t]*\n(.*?)\n```", keep, body, flags=re.S)  # the editor's snapshots
    meta["code"], meta["code_langs"] = code, sorted(langs)
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


def long_form_name(chapter):
    """The book's chapter title as a file name: "Divide-and-Conquer" → divide-and-conquer (studio_upload.js names it the same)."""
    return re.sub(r"[^a-z0-9]+", "-", chapter.lower()).strip("-")


def spoken(words, cues):
    """The text the voice reads: a {say X} cue speaks its next word as X (the variable a as "Eh", where the article a stays
    "a"), then pronounce.tsv's rules. Captions, the judgement and the Whisper check all keep the written words."""
    words = list(words)
    for c in cues:
        if c["op"] == "say" and c["w"] < len(words):
            w = words[c["w"]]; m = re.match(r"^(\W*)(.*?)(\W*)$", w)
            words[c["w"]] = m.group(1) + c["arg"].strip() + m.group(3)
    text = " ".join(words)
    if PRONOUNCE.exists():
        for line in PRONOUNCE.read_text().splitlines():
            if line.strip() and not line.startswith("#"):
                pat, say = line.split("\t")[:2]
                text = re.sub(pat, say, text)
    return text


def book_profile(script):
    """books/<book>/book.json for a script under videos/<book>/…, or {} if there is none."""
    try: rel = pathlib.Path(script).resolve().relative_to(ROOT / "videos")
    except ValueError: return {}
    p = ROOT / "books" / rel.parts[0] / "book.json"
    return json.loads(p.read_text()) if p.exists() else {}


def rust(src, work, want_error, compile_cmd=("rustc", "--edition", "2021", "-A", "warnings")):
    """Compile and run one snapshot, as the run panel will show it. Cached by the source text."""
    key = hashlib.md5(src.encode()).hexdigest()[:12]
    d = work / "rust"; d.mkdir(parents=True, exist_ok=True)
    rs, exe = d / f"{key}.rs", d / key
    rs.write_text(src + "\n")
    c = subprocess.run([*compile_cmd, "-o", str(exe), str(rs)], capture_output=True, text=True)
    if c.returncode:
        err = c.stderr.replace(str(rs), "main.rs").replace(str(pathlib.Path.home()), "~")  # no user name on screen
        blocks = err.split("\n\n")
        first = next((b for b in blocks if b.startswith("error")), err)  # the first error is the one the lesson talks about
        abort = next((b.splitlines()[0] for b in blocks if b.startswith("error: aborting")), "")  # rustc's own last line
        out, ok = first.strip() + ("\n\n" + abort if abort else ""), False
    else:
        r = subprocess.run([str(exe)], capture_output=True, text=True, timeout=20)
        err = re.sub(r"thread '([^']*)' \(\d+\)", r"thread '\1'", r.stderr.replace(str(rs), "main.rs").replace(str(pathlib.Path.home()), "~"))  # the same on every run, and no user name on screen
        out, ok = (r.stdout + (err if r.returncode else "")).rstrip(), r.returncode == 0
    if ok == want_error:
        sys.exit(f"narrate: a {{run{' error' if want_error else ''}}} expected {'an error' if want_error else 'a clean run'}, but got:\n{out}\n--- source ---\n{src}")
    return {"out": out, "ok": ok}


def lint(segs):
    bad = []
    never = [n.strip() for n in NEVER_SAY.read_text().splitlines() if n.strip() and not n.startswith("#")] if NEVER_SAY.exists() else []
    for s in segs:
        t = " ".join(s["text"])
        if "TODO" in t: bad.append(f"unfinished: {t!r}")
        shown = t + " " + " ".join(c["arg"] for c in s["cues"])
        bad += [f"names someone the series never names ({NEVER_SAY.name}): {shown!r}" for n in never if re.search(rf"\b{re.escape(n)}\b", shown, re.I)]
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


def synth(engine, voice, items, work, speed=SPEED):
    if not items: return
    if engine != "kokoro": sys.exit(f"narrate: {len(items)} clips are not cached for {engine}:{voice}, and only kokoro: voices can make new ones.")
    jobs = work / f"jobs-{hashlib.md5(json.dumps(items).encode()).hexdigest()[:8]}.json"
    jobs.write_text(json.dumps({"voice": voice, "speed": speed, "items": items}))
    subprocess.run([sys.executable, str(HERE / "tts_kokoro.py"), str(jobs)], check=True)
    jobs.unlink()


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("script"); ap.add_argument("--voice", default="kokoro:bm_fable"); ap.add_argument("--silent", action="store_true"); ap.add_argument("--no-lint", action="store_true"); ap.add_argument("--only")
    ap.add_argument("--skip-judgement", action="store_true", help="narrate an unjudged script: test renders only, never for publishing")
    a = ap.parse_args()
    engine, voice = a.voice.split(":", 1)
    if not a.silent:
        ok, why = judgement.check(a.script)
        if not ok and not a.skip_judgement: sys.exit(f"narrate: {a.script}: {why}\n  (--skip-judgement for a test render that won't be published)")
        if not ok: print(f"narrate: WARNING, unjudged test render: {why}", flush=True)
    meta, segs = parse(a.script)
    book = book_profile(a.script)
    lang = (book.get("language") or {})
    if meta["code"]:
        if lang.get("name", "rust") != "rust": sys.exit(f"narrate: {lang.get('name')} snapshots aren't supported yet; only Rust can be compiled and run")
        wrong = [l for l in meta["code_langs"] if l != lang.get("fence", "rust")]
        if wrong: sys.exit(f"narrate: snapshots are fenced as {wrong}, but book.json says the language is {lang.get('fence', 'rust')}")
    compile_cmd = tuple(lang.get("compile") or ("rustc", "--edition", "2021", "-A", "warnings"))
    home = pathlib.Path(a.script).resolve().parent
    name, build = home.name, home / "build"
    if a.only:
        heads = [i for i, s in enumerate(segs) if any(c["op"] == "goto" for c in s["cues"])]
        goto = lambda i: next(c["arg"] for c in segs[i]["cues"] if c["op"] == "goto")
        hit = next((i for i in heads if goto(i).split("|")[0].strip() == a.only), None)  # a scene id exactly, else any text in the goto
        if hit is None: hit = next((i for i in heads if a.only.lower() in goto(i).lower()), None)
        if hit is None: sys.exit(f"narrate: no {{goto}} contains {a.only!r}")
        meta["scene"] = goto(hit).split("|")[0].strip()
        carded = "|" in goto(hit)
        segs = segs[hit:next((i for i in heads if i > hit), len(segs))]
        if not carded and not any(c["op"] == "scene" for s in segs for c in s["cues"]):
            segs[0]["cues"].insert(0, {"w": 0, "op": "scene", "arg": ""})  # a scene inside a part has no card to lift: lift the cover
        part = re.sub(r"\W+", "-", a.only.lower()).strip("-")
        name += "-" + part; build /= part
    problems = lint(segs) + [f"unfinished front matter: {k}: {v}" for k, v in meta.items() if isinstance(v, str) and "TODO" in v]
    # a code lesson: every {code} names a snapshot, and every {run} gets its program's real output
    runs, current = {}, meta.get("start")
    if current and current not in meta["code"]: problems.append(f"start: @{current} is not a snapshot")
    for s in segs:
        for c in s["cues"]:
            if c["op"] == "code":
                current = c["arg"].split()[0]
                if current not in meta["code"]: problems.append(f"{{code {current}}}: no ```rust @{current} block")
            if c["op"] == "run" and current in meta["code"] and current not in runs:
                runs[current] = rust(meta["code"][current], build, c["arg"].strip() == "error", compile_cmd)
    if problems and not a.no_lint: sys.exit("script lint failed:\n  " + "\n  ".join(problems))
    tag = "silent" if a.silent else f"{engine}-{voice}"
    out = build / tag; (out / "raw").mkdir(parents=True, exist_ok=True)
    speed, stretch = PACE.get(meta.get("kind"), (SPEED, 1.0))
    base = int(meta.get("seed", 1))
    res = []
    in_editor, pace = False, {}   # a page video that switches to the editor ({goto editor | …}) talks at code pace from there on
    for i, s in enumerate(segs):
        words = s["text"]; text = " ".join(words)
        if any(c["op"] == "goto" and c["arg"].split("|")[0].strip() == "editor" for c in s["cues"]): in_editor = True
        sp, st = PACE["code"] if in_editor else (speed, stretch)
        # each block's breath comes from its own words, so an edit in one part leaves every other part's timing alone
        # (assemble.js re-records only the parts whose timing changed)
        rng = random.Random(f"{base}|{text}")
        rec = {"i": i, "text": text, "words": words, "cues": [c for c in s["cues"] if c["op"] != "say"], "then": s["then"], "gap": round(gap_after(s, rng) * st, 3), "dur": 0.0, "wav": None}
        pace[i] = sp   # kept out of the manifest, so the parts assemble.js caches keep their hashes
        res.append(rec)
        if not words: continue
        rec["say"] = spoken(words, s["cues"])
        # a clip spoken as written keeps its old cache key; one with a respelling gets its own
        rec["key"] = hashlib.md5((f"{tag}|{sp}|{text}" + ("" if rec["say"] == text else f"|say:{rec['say']}")).encode()).hexdigest()[:12]
    if a.silent:
        for r in res:
            r["dur"] = len(r["words"]) * 0.4
            r["start"] = [k * 0.4 for k in range(len(r["words"]))]; r["end"] = [(k + 1) * 0.4 for k in range(len(r["words"]))]
    else:
        todo = [r for r in res if r["words"]]
        for attempt in range(RETRIES + 1):
            need = [({"text": r["say"], "out": str(out / "raw" / f"{r['key']}.wav"), "seed": base + attempt * 101 + r["i"]}, pace[r["i"]]) for r in todo if not (out / "raw" / f"{r['key']}.wav").exists()]
            if need: print(f"{name}: synthesizing {len(need)} clips with {a.voice} (attempt {attempt + 1})", flush=True)
            for sp in sorted({v for _, v in need}): synth(engine, voice, [x for x, v in need if v == sp], out, sp)
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
    # a chapter's long form is named after the book's chapter (ch06-heapsort.mp4); silent passes and parts after the voice
    chapter = (book.get("chapters") or {}).get(home.name, {}).get("book")
    stem = f"{name}-{'silent' if a.silent else long_form_name(chapter) if chapter and not a.only else voice}"
    src = lang.get("file", "main.rs")   # the editor's tab, and the command its run panel shows
    (out / "manifest.json").write_text(json.dumps({"meta": meta, "code": meta["code"], "runs": runs, "file": src, "run_cmd": f"rustc {src} && ./{pathlib.Path(src).stem}","name": name, "out": str(home / f"{stem}.mp4"), "voice": a.voice, "silent": a.silent, "segments": res}, indent=1, default=float))
    words = sum(len(r["words"]) for r in res); dur = sum(r["dur"] + r["gap"] for r in res)
    print(f"{name}: {len(res)} blocks, {words} words, about {dur / 60:.1f} min of speech. → {out}/manifest.json")


if __name__ == "__main__":
    main()
