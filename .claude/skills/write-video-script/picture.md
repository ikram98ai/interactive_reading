# The picture

Dark mode only, at 1920×1080. Studio sets this.

## The chapter's machine

- **Nothing is on screen until it's named.** The code panel and stats start hidden and the picture is centred.
  `{show stats}` brings the counters in, and `{split}{show panel}` the code panel. Hide layers the video doesn't explain: `{hide s1ptr}`, where
  `s1ptr: css:#s1-svg [data-part=pointers]` is in the script's `targets:`.
- **One change at a time.** Aim for six to ten changes a minute, with the machine still most of the time.
- **No silent motion.** Talk over every `{click Play}` and `{click Run}`, and raise `{speed}` until the narration outlasts
  the animation.
- **Cues sit on the noun.** Put `{focus}`, `{label}` and `{click}` right before the word that names the thing.
- **Tools:** `{label}` gives a small heading for the current idea; `{focus}` draws a thin ring and dims nothing;
  `{card big | small}` is for the one takeaway a video or part should leave.
- **Finding the steps:** `make video-trace PAGE=books/<slug>/chNN.html SCENE=<id> ARGS='"Mode"'` prints a machine's
  listing, numbered as `{focus code:N}` counts it, and what every press of Step lights, with its values and caption. Write
  from that, so each `{click Step xN}` lands on the line you name and each value you say has a
  `{check .is-full .caption ~ …}`.

## The editor (code videos)

`studio.js` records the editor, both in a code video (`kind: code`) and in a page video's RUST part (`{goto editor}`),
with the `{code}`, `{select}`, `{unselect}`, `{run}` and `{close}` cues below.

`tools/video/editor.html`: one file in the book's language, zoomed so about fifteen lines fill the frame. Its tab shows
the file's name (`main.rs`), with the Rust logo in front of a `.rs` file.

- **Snapshots:** the script keeps each state of the file as a fenced block, ` ```<language> @name ` (` ```rust @name ` for
  CLRS), which is never spoken. `{code name}` types from the current text to that snapshot while the voice goes on;
  `{code name fast}` is for long blocks the narration summarises.
- **Pointing:** `{select text}` highlights code while you talk about it, the way you'd select it with a mouse;
  `{unselect}` clears it.
- **Running:** `{run}` opens the run panel with the program's real output, because `narrate.py` compiles and runs each
  snapshot (`book.json` `language.compile`). `{run error}` shows the compiler's real error, which is how a video teaches
  the language's rules: write the natural thing, run it, read the error, then fix it. `{close}` hides the panel before
  the next edit.
- **Problems** are set as comments in the editor: the function's name, an example input and output, and the
  constraint.

## Boards

**Not recordable yet:** `studio.js` has no `{board}`, `{bullet}`, `{sub}` or `{mono}` cues. The rules below are for
when it does.

`kind: board` gives a heading and lines that appear as they're said: `{board heading}`, `{bullet …}`, `{sub …}`,
`{mono …}`. A second `{board}` starts a fresh one.
