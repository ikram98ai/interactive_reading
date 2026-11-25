#!/usr/bin/env python3
"""narrate.py videos/<book>/<ch>/script.md --voice kokoro:bm_fable [--silent] — turn a video script into timed narration.
Everything a chapter's video needs stays in its folder: script.md, build/ (clips, manifest, frames) and the finished video.

  1. parse the script: spoken text plus {cues}, which fire at the word they sit in front of
  2. lint the spoken text: no digits, no recited runs of numbers (see LINT)
  3. synthesize each block (cached by text + voice) with tts_kokoro.py
  4. transcribe each clip with Whisper: word times place the cues, and a clip that does not say what the script
     says (a TTS slip) is reported
  5. trim and level each clip, put a person's breathing back into it (breathe), and write build/<voice>/manifest.json
     for studio.js

The voice talks at a person's speed, and the pace a viewer hears comes from where it stops, not from a slower voice: a
TTS slowed down stretches every sound evenly, and that is what sounds like a computer. A teacher talks at about 230 to
260 words a minute and pauses forty to fifty times a minute (videos/demo, measured 2026-11-22), at commas, between
sentences, after a question, and longer after a result. {beat} asks for that longer stop where the script wants one.
The voice says each sentence on its own, so every sentence ends whole, and a stop opens only inside a silence the voice
really leaves (breathe): a cut anywhere else clips the word, an s or a t worst of all.

--silent skips 3 and 4 and estimates timing at 150 words a minute, breaths included: a fast way to check the highlights.
A page video can switch to the editor once, at {goto editor} (a YouTube Short, kind: short, does): its code cues then work
as in a code video, and the voice keeps the pace it had on the page, so the whole video sounds like one speaker. A code video (kind: code) keeps the editor's text in fenced blocks, ```rust @name … ```, which are never spoken. {code name}
types the editor into that snapshot, and {run} shows the program's real output: each snapshot that is run is compiled with
rustc here, and the build fails if it doesn't compile, unless the cue is {run error}, which shows the compiler's error instead.

A new part ({goto id | kicker | heading}) is a dissolve to its scene, and its heading is only the chapter's title in the
YouTube timeline: it is never shown and never spoken. The script's own words make the move from one idea to the next
(see bridge_lint), so the video sounds like one lesson rather than a run of read-out titles.

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
SPEED = 0.95            # Kokoro's rate while it talks, near the 1.0 it was trained at, where it sounds most like a person. Never slow it below about 0.9 to
                        # slow a video down (0.86 and 0.79 were tried, 2026-11-16, and sounded like a computer); slow it with
                        # breaths and beats instead, which bring the whole video to about 160.
# Each kind of video keeps one talking speed, and gets its slower overall pace from longer stops: code videos leave
# more room between thoughts while the code is typed, boards a little more than concepts.
PACE = {"code": (0.95, 1.5), "board": (0.95, 1.2)}   # kind → (Kokoro speed, how much longer the gaps between blocks are)
# How long a person stops, in seconds of silence in all, after a word ending in this mark. Each stop is drawn at random
# from its range, so no two are the same length, and a stop the voice already leaves that long gets nothing added.
BREATH = {",": (0.22, 0.32), ";": (0.32, 0.45), ":": (0.30, 0.42), "—": (0.30, 0.42), "–": (0.30, 0.42),
          ".": (0.45, 0.65), "!": (0.45, 0.65), "?": (0.65, 0.85), "…": (0.50, 0.75)}
BEAT = (1.1, 1.4)       # {beat}: the stop that lets a result land, or gives the viewer a moment to answer a question
# A long run with no comma still breathes before the word that turns it ("…bigger than the key because…"), but only
# where the voice already leaves a gap, so the cut never lands inside a sound.
HINGE = {"because", "but", "so", "which", "while", "until", "unless", "although", "whereas", "since"}
HINGE_RUN, HINGE_GAP = 8, (0.14, 0.22)
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


def bridge_lint(segs):
    """A part's first words carry the viewer over from the last idea: they never read out the part's heading (the
    YouTube chapter title), and a {goto} card never sits alone with a silent pause, since the dissolve then plays with
    nobody talking. Write the card at the head of the part's first paragraph: {goto id | Part 3 of 6 | heading}{scene} …"""
    bad = []
    norm_ = lambda t: re.sub(r"[^a-z ]", "", t.lower()).split()
    for i, s in enumerate(segs):
        g = next((c for c in s["cues"] if c["op"] == "goto" and c["arg"].count("|") >= 2), None)
        if not g: continue
        head = norm_(g["arg"].split("|")[2])
        if not s["text"]:
            bad.append(f"a new part with no words over its dissolve (put the card at the head of the part's first paragraph): {{goto {g['arg']}}}")
        first = next((x for x in segs[i:i + 2] if x["text"]), None)
        if first and head and norm_(" ".join(first["text"]))[:len(head)] == head:
            bad.append(f"a part that opens by reading its own heading aloud; open with a sentence that carries on from the last part: {' '.join(first['text'])[:90]!r}")
    return bad


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


def sentences(words):
    """The block's sentences as word ranges [(a, b), …]: each ends at a word ending in . ? ! or …"""
    out, a = [], 0
    for k, w in enumerate(words):
        if re.search(r"[.?!…]$", w.rstrip("\"')]’”")) or k == len(words) - 1:
            out.append((a, k + 1)); a = k + 1
    return out


def spoken_parts(words, cues):
    """spoken(), one sentence at a time: the voice says each sentence on its own (tts_kokoro.py's parts), so each ends
    whole instead of running into the next one."""
    return [spoken(words[a:b], [dict(c, w=c["w"] - a) for c in cues if a <= c["w"] < b]) for a, b in sentences(words)]


def book_profile(script):
    """books/<book>/book.json for a script under videos/<book>/…, or {} if there is none."""
    try: rel = pathlib.Path(script).resolve().relative_to(ROOT / "videos")
    except ValueError: return {}
    p = ROOT / "books" / rel.parts[1 if rel.parts[0] == "shorts" else 0] / "book.json"   # videos/shorts/<book>/… too
    return json.loads(p.read_text()) if p.exists() else {}


def rust(src, work, want_error, compile_cmd=("rustc", "--edition", "2021", "-A", "warnings"), warnings=False, shown="main.rs"):
    """Compile and run one snapshot, as the run panel will show it. Cached by the source text."""
    key = hashlib.md5(src.encode()).hexdigest()[:12]
    d = work / "rust"; d.mkdir(parents=True, exist_ok=True)
    rs, exe = d / f"{key}.rs", d / key
    rs.write_text(src + "\n")
    c = subprocess.run([*compile_cmd, "-o", str(exe), str(rs)], capture_output=True, text=True)
    if c.returncode:
        err = c.stderr.replace(str(rs), shown).replace(str(pathlib.Path.home()), "~")  # no user name on screen
        blocks = err.split("\n\n")
        first = next((b for b in blocks if b.startswith("error")), err)  # the first error is the one the video talks about
        abort = next((b.splitlines()[0] for b in blocks if b.startswith("error: aborting")), "")  # rustc's own last line
        out, ok = first.strip() + ("\n\n" + abort if abort else ""), False
    else:
        r = subprocess.run([str(exe)], capture_output=True, text=True, timeout=20)
        err = re.sub(r"thread '([^']*)' \(\d+\)", r"thread '\1'", r.stderr.replace(str(rs), shown).replace(str(pathlib.Path.home()), "~"))  # the same on every run, and no user name on screen
        out, ok = (r.stdout + (err if r.returncode else "")).rstrip(), r.returncode == 0
        if warnings and c.stderr.strip():   # a short shows rustc's warnings, as the command on screen would print them
            out = c.stderr.replace(str(rs), shown).rstrip() + "\n\n" + out
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


EAR_SENTENCE = 25       # a spoken sentence longer than this is hard to follow on one hearing
EAR_RUN = 16            # words with no comma, colon or dash: nowhere for the voice to breathe, so it runs on


def ear_lint(segs):
    """Warnings, not failures: sentences written for the eye. A new script fixes every one; an older one that was
    judged before this lint keeps working, and gets fixed the next time its words change."""
    warn = []
    for s in segs:
        t = " ".join(s["text"])
        for sent in re.split(r"(?<=[.?!])\s+", t):
            n = len(sent.split())
            if EAR_SENTENCE < n <= 34: warn.append(f"long for the ear ({n} words; split it): {sent!r}")
            longest = max((len(p.split()) for p in re.split(r"[,;:—–]", sent)), default=0)
            if longest > EAR_RUN and n <= 34: warn.append(f"{longest} words without a breath (add a comma, or split it): {sent!r}")
    return warn


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
    """How long a person stops after this block, on top of the air finish() leaves and the voice's own tail (together
    about a quarter of a second). Longest after a question or a finished thought, never metronomic. A {beat} at the end
    of the block adds its own stop."""
    if not seg["text"]: return 0.0
    last = seg["text"][-1].rstrip("\"')]’”")
    if last.endswith("?"): base = (0.40, 0.60)
    elif seg.get("para_end"): base = (0.30, 0.55)
    elif last.endswith(("...", "…")): base = (0.30, 0.50)
    else: base = (0.22, 0.38)
    beat = any(c["op"] == "beat" and c["w"] >= len(seg["text"]) for c in seg["cues"])
    return round(rng.uniform(*base) + (rng.uniform(*BEAT) if beat else 0), 3)


def breath_plan(words, cues):
    """Where a person stops inside a block, and for how long: [(the word the stop follows, (least, most) seconds)].
    A {beat} cue before word k stops after word k − 1 (one at the very start or end of a block is the gap's business)."""
    beats = {c["w"] for c in cues if c["op"] == "beat" and 0 < c["w"] < len(words)}
    plan, run = [], 0
    for k in range(len(words) - 1):
        run += 1
        tail = words[k].rstrip("\"')]’”")
        mark = "…" if tail.endswith("...") else tail[-1:] if tail else ""
        if k + 1 in beats: want = BEAT
        elif mark in BREATH: want = BREATH[mark]
        elif run >= HINGE_RUN and norm(words[k + 1]) in HINGE: want = HINGE_GAP
        else: continue
        plan.append((k, want)); run = 0
    return plan


QUIET_DB = -40          # a stop opens only where the voice is this far below its loud parts (an s hisses at about −22)
MIN_QUIET = 0.035       # for at least this long: shorter quiet is the closure inside a t or a k, not a gap between words
CUT_FADE = 0.010        # each side of a cut fades this long, inside the quiet, so the join is silent


def quiet_run(db, sr, lo, hi):
    """The longest stretch of samples lo..hi quieter than QUIET_DB, as (l, r), or None if none lasts MIN_QUIET."""
    q = db[lo:hi] < QUIET_DB
    edges = np.flatnonzero(np.diff(np.concatenate(([0], q.astype(np.int8), [0]))))
    if not len(edges): return None
    l, r = max(zip(edges[::2], edges[1::2]), key=lambda x: x[1] - x[0])
    return (lo + int(l), lo + int(r)) if (r - l) / sr >= MIN_QUIET else None


def breathe(wav, words, start, end, cues, rng):
    """Put a person's stops back into a clip: open a silence in the middle of a gap the voice really leaves between the
    two words, and nowhere else. Whisper's word edges are tens of milliseconds out, so the gap is looked for between the
    middles of the two words. A cut anywhere else is heard: in an s it chops the hiss, in a t it strands the release
    after the pause as a click, and before a vowel ("card, | a of zero") it clips the next word's start. Each sentence was
    spoken on its own (spoken_parts), so a sentence always ends in such a gap; a comma the voice ran straight through
    gets no stop. Cutting, rather than synthesizing each phrase on its own, keeps the voice's own intonation across a
    comma. Returns the clip's new length and its words' new times."""
    w, sr = sf.read(wav, dtype="float32")
    hop, slow = int(0.005 * sr), int(0.02 * sr)
    x = w - np.convolve(w, np.ones(slow) / slow, mode="same")   # the level without the slow rumble under the voice
    e = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, mode="same") + 1e-12)
    db = 20 * np.log10(e / float(np.percentile(e, 95)))
    start, end, shift = list(start), list(end), [0.0] * len(words)
    pieces, last, added = [], 0, 0.0
    fade = int(CUT_FADE * sr)
    for k, want in breath_plan(words, cues):
        lo = int(max(0.0, (start[k] + end[k]) / 2) * sr); hi = int(min(len(w) / sr, (start[k + 1] + end[k + 1]) / 2) * sr)
        if hi - lo < hop or lo <= last: continue
        gap = quiet_run(db, sr, lo, hi)
        if not gap: continue   # the voice leaves no gap here: a cut would be heard
        l, r = gap; cut = (l + r) // 2
        add = rng.uniform(*want) - (r - l) / sr   # the voice is already quiet this long
        if add < 0.04: continue
        piece = w[last:cut].copy()
        if len(piece) > fade: piece[-fade:] *= np.linspace(1, 0, fade)
        pieces += [piece, np.zeros(int(add * sr), dtype="float32")]
        last = cut; added += add
        if cut + fade < len(w): w[cut:cut + fade] *= np.linspace(0, 1, fade)
        for j in range(k + 1, len(words)): shift[j] += add
    pieces.append(w[last:])
    out = np.concatenate(pieces)
    sf.write(wav, out, sr, subtype="PCM_16")
    return len(out) / sr, [s + d for s, d in zip(start, shift)], [x + d for x, d in zip(end, shift)]


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
    short = meta.get("kind") == "short"
    if short:   # a short's terminal shows `rustc main.rs`, so it builds like that, warnings and all
        compile_cmd = tuple(x for i, x in enumerate(compile_cmd) if not (x == "-A" or (i and compile_cmd[i - 1] == "-A")))
    home = pathlib.Path(a.script).resolve().parent
    name, build = home.name, home / "build"
    section = re.fullmatch(r"s\d\d", home.name) and re.fullmatch(r"ch\d\d", home.parent.name)
    if section: name = f"{home.parent.name}-{home.name}"   # a section video, videos/<book>/chNN/sMM/: named chNN-sMM
    if a.only:
        heads = [i for i, s in enumerate(segs) if any(c["op"] == "goto" for c in s["cues"])]
        goto = lambda i: next(c["arg"] for c in segs[i]["cues"] if c["op"] == "goto")
        hit = next((i for i in heads if goto(i).split("|")[0].strip() == a.only), None)  # a scene id exactly, else any text in the goto
        if hit is None: hit = next((i for i in heads if a.only.lower() in goto(i).lower()), None)
        if hit is None: sys.exit(f"narrate: no {{goto}} contains {a.only!r}")
        meta["scene"] = goto(hit).split("|")[0].strip()
        carded = "|" in goto(hit)
        cards = [i for i in heads if "|" in goto(i)]   # a part runs to the next card, through any {goto editor} or dip inside it
        segs = segs[hit:next((i for i in (cards if carded else heads) if i > hit), len(segs))]
        if not carded and not any(c["op"] == "scene" for s in segs for c in s["cues"]):
            segs[0]["cues"].insert(0, {"w": 0, "op": "scene", "arg": ""})  # a scene inside a part has no card to lift: lift the cover
        part = re.sub(r"\W+", "-", a.only.lower()).strip("-")
        name += "-" + part; build /= part
    problems = lint(segs) + bridge_lint(segs) + [f"unfinished front matter: {k}: {v}" for k, v in meta.items() if isinstance(v, str) and "TODO" in v]
    # a code video: every {code} names a snapshot, and every {run} gets its program's real output
    runs, current = {}, meta.get("start")
    if current and current not in meta["code"]: problems.append(f"start: @{current} is not a snapshot")
    for s in segs:
        for c in s["cues"]:
            if c["op"] == "code":
                current = c["arg"].split()[0]
                if current not in meta["code"]: problems.append(f"{{code {current}}}: no ```rust @{current} block")
            if c["op"] == "run" and current in meta["code"] and current not in runs:
                runs[current] = rust(meta["code"][current], build, c["arg"].strip() == "error", compile_cmd, short, meta.get("file") or lang.get("file", "main.rs"))
    if problems and not a.no_lint: sys.exit("script lint failed:\n  " + "\n  ".join(problems))
    ear = ear_lint(segs)
    if ear: print(f"{name}: {len(ear)} sentences written for the eye, not the ear (write-video-script voice.md):\n  " + "\n  ".join(ear), flush=True)
    tag = "silent" if a.silent else f"{engine}-{voice}"
    out = build / tag; (out / "raw").mkdir(parents=True, exist_ok=True)
    speed, stretch = PACE.get(meta.get("kind"), (SPEED, 1.0))
    base = int(meta.get("seed", 1))
    res = []
    # One pace for the whole video. A short with no page is in the editor from the start and talks at code pace; a page
    # video keeps its page pace after {goto editor}: switching voices halfway is what a viewer hears as "slowed down".
    # Where the code is really dense, the script gives it room with a {pause} or an {await}, not a slower voice.
    sp, st = PACE["code"] if short and not meta.get("page") else (speed, stretch)
    pace, allcues = {}, {}
    for i, s in enumerate(segs):
        words = s["text"]; text = " ".join(words)
        # each block's breath comes from its own words, so an edit in one part leaves every other part's timing alone
        # (assemble.js re-records only the parts whose timing changed)
        rng = random.Random(f"{base}|{text}")
        rec = {"i": i, "text": text, "words": words, "cues": [c for c in s["cues"] if c["op"] not in ("say", "beat")], "then": s["then"], "gap": round(gap_after(s, rng) * st, 3), "dur": 0.0, "wav": None}
        pace[i] = sp   # kept out of the manifest, so the parts assemble.js caches keep their hashes
        allcues[i] = s["cues"]   # {beat} included: breathe() places it, studio.js never sees it
        res.append(rec)
        if not words: continue
        rec["parts"] = spoken_parts(words, s["cues"])   # said a sentence at a time (breathe)
        rec["say"] = " ".join(rec["parts"])
        # a clip spoken as written keeps its old cache key; one with a respelling gets its own, and so does one said in
        # several sentences (a one-sentence clip sounds just as it did in one take)
        rec["key"] = hashlib.md5((f"{tag}|{sp}|{text}" + ("" if rec["say"] == text else f"|say:{rec['say']}")
                                  + ("|sentences" if len(rec["parts"]) > 1 else "")).encode()).hexdigest()[:12]
    if a.silent:
        for r in res:
            # 0.3 s a word while talking, plus the middle of each stop breathe() will open: about 150 words a minute
            stop = [0.0] * len(r["words"])
            for k, (lo, hi) in breath_plan(r["words"], allcues[r["i"]]): stop[k] = (lo + hi) / 2
            t, r["start"], r["end"] = 0.0, [], []
            for k in range(len(r["words"])):
                r["start"].append(t); r["end"].append(t + 0.3); t += 0.3 + stop[k]
            r["dur"] = t
    else:
        todo = [r for r in res if r["words"]]
        for attempt in range(RETRIES + 1):
            need = [({"text": r["say"], "parts": r["parts"], "out": str(out / "raw" / f"{r['key']}.wav"), "seed": base + attempt * 101 + r["i"]}, pace[r["i"]]) for r in todo if not (out / "raw" / f"{r['key']}.wav").exists()]
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
                # the breaths go in after the Whisper check, so the cached word times stay the voice's own
                r["dur"], r["start"], r["end"] = breathe(clean, r["words"], r["start"], r["end"], allcues[r["i"]], random.Random(f"{base}|breath|{r['text']}"))
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
    # a chapter's long form is named after the book's chapter (ch06-heapsort.mp4), a section video after the book's section
    # (book.json sections); silent passes and parts after the voice
    chapter = (book.get("chapters") or {}).get(home.name, {}).get("book")
    if section: chapter = (book.get("sections") or {}).get(home.parent.name, {}).get(home.name)   # ch02-s01-insertion-sort.mp4
    stem = f"{name}-{'silent' if a.silent else long_form_name(chapter) if chapter and not a.only else voice}"
    if meta.get("kind") == "short" and not a.silent: stem = name   # a short is named after its folder: 001-1-the-slower-computer-wins.mp4
    src = meta.get("file") or lang.get("file", "main.rs")   # the editor's tab, and the command its run panel shows (a short names it after its topic)
    (out / "manifest.json").write_text(json.dumps({"meta": meta, "code": meta["code"], "runs": runs, "file": src, "run_cmd": f"rustc {src} && ./{pathlib.Path(src).stem}","name": name, "out": str(home / f"{stem}.mp4"), "voice": a.voice, "silent": a.silent, "segments": res}, indent=1, default=float))
    words = sum(len(r["words"]) for r in res); dur = sum(r["dur"] + r["gap"] for r in res)
    print(f"{name}: {len(res)} blocks, {words} words, about {dur / 60:.1f} min of speech. → {out}/manifest.json")


if __name__ == "__main__":
    main()
