# Code panels

A code panel sits under a machine and shows the program or algorithm the machine is acting out, so the viewer can match
each animation to a line. **It is optional.** Decide scene by scene:

- **Real code** when the section is about how a program behaves and the reader will meet that code: CS:APP's C,
  assembly, machine-code bytes and `linux>` commands (a loop that misses the cache, a buffer overflow, a context switch).
- **Pseudocode** when the idea is an algorithm or protocol with steps the machine walks through, and there is no real
  code worth showing: DDIA's quorum reads and writes, leader election, compaction, a hash-partitioning rule, two-phase
  commit.
- **No panel** when the idea is a concept, a definition, a trade-off, a comparison or a piece of history: reliability vs
  scalability, data models, what "latency" means. Made-up code there only adds noise.

The test: would the viewer understand the machine better by following a highlighted line step by step? If not, leave
the panel out. A page can mix all three kinds. CLRS pages put a panel on every scene, pairing the
book's pseudocode with a Rust program.

## Pick the code

- Real code is in the book's language (`book.json` `language`) and does what the machine shows. **Verify it:** compile,
  run, assemble or disassemble it (`clang -target x86_64-linux-gnu` works on a Mac) and show the real output, bytes and
  instruction names — never ones recalled from memory. If the book's numbers disagree with the real output, show the real
  output and say so in a comment.
- Pseudocode follows the book's own description of the algorithm, not a textbook version from memory. Write it plainly
  (`for each replica`, `send`, `wait for w acks`, `return`), label the file `(pseudocode)`, and use `lang: "text"` (or
  `"c"` if it is C-like).
- If real code uses invented helper names (`load_and_run`, `keep_copy`), put `(sketch)` in the file name.
- Keep it short (4–16 lines), with short comments (a line under ~70 characters), so the live tags stay in view. When a
  scene has modes, give each mode its own files (`cv.setFiles`, or tabs that switch the mode through `onTab`).

## Make it live

- `cv.at([lines])` highlights what the machine is doing _now_ (`"on"`). Use `"on2"` for a second flow of control,
  `"dim"` for a paused one, and `"good"` / `"bad"` for outcomes.
- `cv.notes({ line: "i = 2" })` puts live values at the ends of lines; `cv.caret(line, col)` marks a single character;
  `cv.out(text)` / `cv.print(text)` show what the program printed.
- The highlight must move in step with the animation, and Reset clears it.
