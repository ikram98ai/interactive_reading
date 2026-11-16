# tools/

Local checks for chapter pages. Nothing here is published — the deploy workflow only ships
`index.html`, `assets/` and `books/`.

## Layout

```
authoring/   extract.py: the book text a chapter is built from (the process is in .claude/skills/)
static/      audit, factcheck, rustcheck, check-site: checks that need no browser
browser/     smoke, play, steps, rustview, interact: checks in headless Chrome, sharing browser.js
video/       narration and recording
```

`package.json` and `pyproject.toml` stay at the top and cover all of them. The `Makefile` at the repository root runs
everything: `make` lists the commands, and extra flags go in `ARGS`.

## One-time setup

```
make setup    # uv sync (tools/pyproject.toml → tools/.venv) and npm install, for everything here, video included
```

`smoke.js` and `play.js` look for Chrome or Chromium in the usual places; set `CHROME_PATH` if yours
lives elsewhere. `audit.py`, `factcheck.py` and `check-site.js` need nothing installed.

## Building a chapter

```
make extract PDF=books/ddia/DDIA.pdf ARGS=--list      # see the PDF's outline
make extract PDF=books/ddia/DDIA.pdf ARGS="ddia 11"   # → tools/.text/ddia/ch11.txt
```

DDIA's outline says "Chapter 11. …", so the number is enough. CS:APP's doesn't, so pick the entry by
title or give the pages: `… csapp 7 --title Linking` or `… csapp 7 --pages 696-746`.

Then build the page with the [build-chapter-page](../.claude/skills/build-chapter-page/SKILL.md) skill, given the
book slug, chapter number and chapter outline; the book's `books/<slug>/book.json` names its reference chapter,
helpers and extra checks. Afterwards bump `built` in `books/<slug>/book.js` **and** in
`books/books.js`.

## Checking a chapter

| Command                                             | What it catches                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make smoke PAGE=books/ddia/ch11.html ARGS=--light` | Clicks every control in every simulation, rapidly and mid-animation. Fails on JS errors, SVG labels clipped by their viewBox, and sideways scrolling on a phone. Saves before/after screenshots of each stage.                                                                                                          |
| `make play PAGE=books/ddia/ch11.html ARGS=--light`  | Presses each simulation's main button, waits for it to settle, and screenshots that. It never fails on looks — **you have to open the PNGs**. This is where overlapping labels and stray parcels show up. `--seg=1` plays each sim's second mode; `--presses=8` fills sandboxes.                                        |
| `make steps PAGE=books/clrs/ch27.html ARGS=--light` | CLRS step-through machines (`AL.walk`): visits every step of every mode, and fails on overlapping or clipped labels, an empty caption, or a picture that differs depending on whether you got there by Next, Back or the slider. Saves evenly spaced screenshots (`--shots=N`).                            |
| `make rustview PAGE=books/clrs/ch27.html`           | Steps every `AL.walk` machine in the Rust view and reports steps where the listing lights up nothing, so a missing line-map entry doesn't leave the panel dead. `--detail` names the lines. It reports and never fails, because some steps really have no Rust line.                                                    |
| `make interact PAGE=books/clrs/ch27.html`           | Uses each `AL.walk` machine as a reader would, at normal speed: the real animation, Back mid-animation, arrow keys, Pause, Rust during a run, full screen, reduced motion, touch at phone size, and every dotted word. Fails on what breaks.                                                                            |
| `make audit PAGE=books/ddia/ch1*.html`              | Duplicate ids, links to missing anchors, scenes missing from the table of contents, unlabelled SVGs, hard-coded colours, emoji, a quiz whose right answer is always in the same spot.                                                                                                                                   |
| `make factcheck BOOK=ddia CH=11`                    | Every name, number and “quoted phrase” in the epigraph and the "What the book says" boxes must appear in the chapter's text. Exits 1 on a quotation that isn't the book's exact words.                                                                                                                                  |
| `make rustcheck PAGE=books/clrs/ch01.html`          | CLRS only: compiles and runs every Rust listing on the page (`<script type="text/x-rust">`) with `rustc --edition 2021`, and fails on a build error or warning, a crash, output that differs from the page's `-out` block, a line over 80 characters, or a comment run longer than two lines. Needs `rustc`. |
| `make site`                                         | The same parse-and-links check the deploy workflow runs, for the whole site. If this passes, the push will deploy.                                                                                                                                                                                                      |

`--light` / `--dark` only set the browser's `prefers-color-scheme`. The pages ignore it: they follow their own
sun/moon switch, light by default. To see the dark theme, run `K.applyTheme("dark")` in the page before the
screenshot (see the build-chapter-page skill's `testing.md`). `--only=N` re-runs a single stage while you
fix it (stage 0 is the hero); it skips the page-wide checks, so finish with a full run.

Screenshots land in `tools/.shots/<book>-<chapter>/`. That folder, `tools/.text/` (book text is
copyrighted, like the PDFs), `node_modules/` and `.venv/` are all gitignored.

## What these checks can't tell you

- `factcheck.py` is a hallucination detector, not a proof. A wrong claim made entirely of words the book
  uses will pass, and it only reads the grown-up boxes — not the stories, captions or quiz. It does not
  replace reading the chapter.
- `smoke.js` proves a page doesn't throw; it can't tell whether a simulation teaches the right thing.
- `interact.js` covers reduced motion and arrow keys, but only on CLRS's `AL.walk` machines. Nothing tests other
  books' pages for them, full keyboard-only use, or a screen reader.

## Narrated scene videos (`tools/video/`, legacy)

Older tooling, kept for reference: no scene scripts exist today (`videos/scripts/` is gone, and `make-all.sh` still
looks for the old `algo-ch01-*.json` names). Chapter videos use the next section.

`make record SCENE=videos/scripts/<script>.json OUT=<out.mp4>` records one interactive scene in its
full-screen view (machine, controls, live caption, code panel and memory strip), pressing the buttons the script
lists while a narration plays. A script is JSON: the page, the scene id, a title card, a `voice`, an optional `seed`
(fixes `Math.random` so random scenes repeat) and `steps`, each with `say` (the narration), `click` (a button's
label), `slider: [index, value]`, `rust` / `pseudo` (switch the code panel), `speed` (the page's speed control),
`delay` (ms before the action) and `settle`. Each step waits for the animation and for the narration to finish, and
the log prints the live caption and counters after every step so the narration can be checked against what happened.

Voice `kokoro:af_heart` is Kokoro-82M (Apache 2.0) run locally by `tts_kokoro.py`; any other voice name is passed to
macOS `say`. One-time setup: `make setup models`. Needs `ffmpeg`. `make scenes` records every chapter-1 script into `videos/`
(gitignored). Output is 1280×720; audio is loudness-normalised.

## Videos for YouTube (`tools/video/`, 1080p60, dark mode, highlights)

The skills in [`.claude/skills/`](../.claude/skills/) are how every chapter's videos are made: [write-video-script](../.claude/skills/write-video-script/SKILL.md) (steps, the long form, voice, picture), [judge-video-script](../.claude/skills/judge-video-script/SKILL.md) (the truth check `narrate.py` requires, recorded by `judgement.py`), [record-video](../.claude/skills/record-video/SKILL.md) (rendering, the quality bar) and [publish-video](../.claude/skills/publish-video/SKILL.md) (uploading). Each book's outputs, language, playlists and title formats are in `books/<slug>/book.json`. `plan.py` inventories a chapter page's machines; `qa.py` measures the finished video. Every book with videos gets one long-form video per chapter, in `videos/<book>/<ch>/`: `script.md`, `build/` and the finished video with its `.srt`. Scripts are kept off GitHub: `videos/` has its own local-only git repo, with no remote, that tracks each `script.md` and the upload metadata. A script is plain spoken text, with `{cues}` that fire on the word they sit in front of.
Each paragraph is one breath group, and the numbers on screen are left for the viewer to read: `narrate.py` refuses a
script with digits, symbols, a sentence reciting more than two numbers, or a sentence over 34 words.

```
{focus laneA+barA}         a thin ring, with nothing dimmed (names come from the script's targets: block; or svg:x,y,w,h · css: · stat: · btn: · code:1-2 · slider:0)
{show panel} {hide stats}  fade something in or out (built in: panel, stats, memory; else a css: target): keep it hidden until the narration names it
{center} {split}           the picture alone in the middle, or on the left beside the code panel
{label Insertion sort}     a small heading at the top of the frame · {label} clears it
{click Race} {click Step x3}   press a button (or a tappable SVG card, by its aria-label), unseen: no cursor and no controls on screen · {slider 1 11} · {speed 0.5} (the page's animation speed)
{await}                    hold the narration until the animation ends · {pause 0.8}
{check #s21-stats ~ 5.6 hours}   the run fails if the page does not show what the narration claims
{card Big line | small line}     full-screen takeaway · {scene} leaves the title card
{goto correct | Part 2 | What correct means}{pause 0.6}   one video, several scenes: a section card covers the switch, {scene} lifts it, and each goto becomes a chapter in <video>.chapters.txt
```

A long form is recorded with `make video-long SCRIPT=…` (the record-video skill): `narrate.py`, then `assemble.js`, which
records each part (the intro, and each section card on) with `studio.js` on its own, caches it, and joins the parts
into one video with a `.srt` and `.chapters.txt` for YouTube. After an edit, only the parts whose words or cues changed
are recorded again. A change to the chapter page, or to `studio.js`, re-records every part, unless
`ARGS="--page-scenes=<ids>"` names the scenes the page edit touched; `ARGS=--dry-run` lists what would be recorded. `make series VOICE=<voice> ONLY=<book>/<folder>` records a folder of numbered videos, such as a day of the
100-day course. To try one part first, `make video-part SCRIPT=videos/clrs/ch01/script.md ONLY="Part 1 of"` narrates
that part (the `{goto}` whose text contains it) and records it. `narrate.py` speaks every block with Kokoro, transcribes the clip with Whisper (`faster-whisper`, on the CPU, downloaded
on first use), reports clips that don't say what the script says, and uses the word times to place the cues. Both are cached in
the chapter's `build/`, so only changed blocks are redone. The voice for YouTube is `kokoro:bm_fable` (the default; `kokoro:am_liam` was tried and rejected); any other
Kokoro voice also works. `--silent` skips the speech (150 words a minute), for checking highlights fast.
`make metrics WAV="a.wav b.wav"` reports pitch, pitch range and pause spread.
