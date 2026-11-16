---
name: judge-video-script
description: Judge whether a video script (videos/<book>/**/script.md, such as a chapter's long form) is true — to the book, the arithmetic, the screen and the code — and record a pass or fail verdict that narrate.py requires. Use after writing or editing any script and before narrating it; run it as the script-judge agent, never in the writer's own context.
---

# Judge a video script

Every `script.md` goes through this before it is narrated, when it is new and again whenever its words change. If the
script's folder has a README with judging rules of its own, apply those too. It is step 5 of the write-video-script skill, between writing and the silent pass.

The build already proves some things. `{check}` proves that the voice and the screen agree, and `{run}` proves that the
code compiles. Neither proves that what is said is true: a script can pass every check and still teach something false.
This step catches that. These rules come from the audit of CLRS Chapter 1's videos; every check is there because a
script got it wrong.

## How to judge

1. **Be a fresh reader.** Run as the `script-judge` agent, or in a context that didn't write the script. Work from the
   script paths, the book text and these files only — not the writer's notes or reasoning: a reviewer who is told the
   script is right tends to agree.
2. **Read the book's profile**, `books/<slug>/book.json`.
3. **Read the chapter first, in full**, from `book.json` `text` with NN filled in. If that file is missing, make it with
   `tools/authoring/extract.py` (see its header). Don't judge from memory of the book.
4. **Go sentence by sentence.** Ignore cues and code blocks, but judge every comment typed into the editor, and every
   label, card, board line and agenda item, since the viewer reads those. For each sentence, ask every question in
   [judgements.md](judgements.md) that applies.
5. **Check against the real sources, not against what seems likely:**
   - the book text, for what the book says
   - the machine's source in `books/<slug>/chNN.html`, for what the screen shows: names, counts, captions, and which
     procedure is running (`make video-trace` prints what each step shows)
   - the compiler and the language's own docs, for anything about the code
   - your own arithmetic, for every number
6. **Write the report** (format below) and record the verdict. Don't edit the script: the writer fixes it and sends it
   back, and you judge again every sentence that changed and every sentence that refers to it.

## Severity

| Severity       | Meaning                                                                   | Gate                       |
| -------------- | ------------------------------------------------------------------------- | -------------------------- |
| **Wrong**      | Contradicts the book, a source, the arithmetic or the screen              | Fix before narrating       |
| **Misleading** | Each word is true, but a viewer will come away believing something false  | Fix before narrating       |
| **Imprecise**  | A careful expert would flag it, though a learner wouldn't be misled       | Fix, or write down why not |
| **Omission**   | The chapter covers something the script skips                             | List it in the report      |

The verdict is **pass** when no Wrong or Misleading finding is left, and every Imprecise finding is fixed or has a reason
written beside it. Otherwise it is **fail**.

## The report

One table per chapter. Quote the sentence exactly, and give its file and line.

```
| File:line                          | Sentence (quoted)                | # | Severity   | Source / evidence                 | Fix                                  |
| ---------------------------------- | -------------------------------- | - | ---------- | --------------------------------- | ------------------------------------ |
| 100days/…/2-rust/script.md:81      | "it's based on merge sort"       | 3 | Imprecise  | slice.rs docs: driftsort          | "a hybrid built on merge sort and…"  |
```

Then list what you checked and found right: the numbers you recomputed, and the claims you matched to a page of the
book. That way the next reader knows what doesn't need checking again. End with the omissions, and the verdict.

## Recording the verdict

For each script, save its part of the report to a file and record it:

```
python3 tools/video/judgement.py record videos/<book>/chNN/script.md --verdict pass --report /tmp/chNN-report.md
```

This writes `script.judgement.json` beside the script, with the verdict, the report, and a hash of what viewers read or
hear in it. `narrate.py` refuses to narrate unless `judgement.py check` passes, and any later change to those words makes
the verdict stale. Record **fail** too, so the writer sees the findings; a failing verdict blocks narration the same way.
