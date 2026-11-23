# The judgements

Ask each question that applies to a sentence.

## 1. Does it say what the book says?

A definition must keep the book's meaning, even when it uses plainer words. When the book hedges a claim ("under certain
assumptions", "typically", "roughly"), keep the hedge or narrow the claim to the case on screen.

> ✗ "Use an approximation algorithm, which is fast and gets close to the best answer." The book says this only holds
> "under certain assumptions". For general TSP, no algorithm can guarantee a near-best tour unless P = NP.
> ✓ "…which, for maps like this one, is fast and gets close to the best answer."

## 2. Is every number right?

Recompute each number from first principles: the book's formula, a trace by hand, or a count. `{check}` only proves that
the machine and the voice agree. If both are wrong, it still passes.

> ✓ The race: 2·(10⁷)² / 10¹⁰ = 20,000 s, which is more than 5.5 hours. Insertion sort on 31, 41, 59, 26, 41, 58 makes 9
> comparisons and 5 shifts, traced line by line. 6 stops give 6!/2 = 360 tours.

Rounded words must round the right way: "more than", "under", "about".

## 3. Is every claim from outside the book backed by a primary source?

The language, its standard library, later chapters and real-world facts all need a source you have actually opened: the
language's docs, the later chapter's text, or the compiler's output. Don't rely on what used to be true.

## 4. Is every absolute literally true?

Stop at every "no", "never", "always", "every", "nothing", "only", "one step" and "can't". An expert will look for the
exception.

> ✗ "Nothing was copied." The same video said earlier that `key` gets a copy.
> ✓ "The vector was never copied."

## 5. Does it match the screen, now and earlier?

What the voice says must agree with what the viewer sees and with what they saw earlier in the section. This includes
the summary, which is easy to write from memory.

> ✗ The summary says a linked list "adds to the front in one step", but the machine's counter showed 2 list steps.
> ✓ "…in a fixed number of steps, however long the list is."

## 6. What will the viewer infer?

Order and framing make claims of their own. If a sentence leads the viewer to believe something false, it is wrong even
when each word is true.

> ✗ "The first one is bubble sort… The second one is the same code… The third one has a one-character bug." That implies
> the third is a buggy bubble sort, but on screen it is GNOME-SORT.
> ✓ "The third one is a different sort, called gnome sort. It has a one-character bug…"

Analogies count here too. Say where an analogy stops working before the viewer runs into it.

## 7. Is it consistent?

The same name, number and advice must hold within a video, and across the videos that build on it.

> ✗ "…even if it takes half an hour… Spend fifteen minutes on it." Pick one.

## 8. Is each simplification honest?

Simplifying is the job. A simplification is fine when it is true for the case on screen and isn't stated as a general
rule. Otherwise, say so: "for simplicity", or "that's an advanced topic".

> ✓ "Problems like this are called NP-complete." The book says the same in its main text, and puts the yes/no nuance in
> a footnote.

## 9. Is what it says about the code true?

The compiler proves that the code compiles. It doesn't prove what the voice says about it.
- A quoted compiler error must match the real error's words and code.
- What the voice says the language does (copying, moving, borrowing, freeing, typing) must be exactly what it does.
- Every API used must exist in the stable language. Note any API that is recent.
- An explanation of the output must match the output: ordering, stability, and trailing spaces.
- **A CLRS Short** (`videos/shorts/clrs/plan.md`): its program must be the book's procedure (any departure, such as a
  loop for a tail call, said once), meet the bound the voice claims, and print what the machine ended on. Its new Rust
  concepts are the ones the Shorts' ledger gives it, and it never points to the book or another Short. A CS:APP RUST
  part follows its own book's plan and ledger the same way.
  A claim about std ("`Vec` never shrinks by itself") is checked against the installed `rustc`'s docs.

## 10. Are references to other videos and the book true?

These include "Next, we're going to…", "We'll see this later", "The book has a whole chapter on…" and "as in Chapter
22". Check each one against what the video it points to really covers, the next section's or chapter's text, or the book's
table of contents. For a CLRS chapter video, a pointer must name the chapter that teaches the idea
(`videos/clrs/plan.md`, the ledger), and a "previously" beat must say only what that earlier chapter taught.

## 11. Does the recap claim only what was taught?

Skipping parts of a chapter is fine. A recap or closing line that mentions a topic the video never covered is not. List what was skipped in the report, so the skipping is a choice and not an accident.

## 12. Can a first-year student follow it on one hearing?

A true script can still teach nothing, if the viewer is lost by the second sentence. Read each paragraph as a student
who has the earlier videos but not this section, hearing it once at the voice's speed, with no way to rewind. Flag it
as **Hard to follow** when:

- a term is used before it's explained, or a symbol is read before the viewer knows what it stands for;
- one sentence carries two new ideas, or defines a thing and uses it at once;
- a step of a walk has no reason ("Line four sets j to i minus one." with no "so j points at …");
- a definition or result that matters goes by with no plain-words restatement, and nothing after it to let it land;
- a question is answered in the same breath it's asked, when the viewer was meant to think about it;
- the paragraph follows the book's order of statements where a student's question would come first ("why start at two?"
  answered three sentences after the student asked it).

> ✗ "The input is a sequence of n numbers. The output is a permutation in which each one is less than or equal to the
> next." The viewer hears "permutation" before learning what it is.
> ✓ "The output is the same numbers, reordered, so each one is no bigger than the next. A reordering like that is called
> a permutation."

Give the fix as the sentence the student would understand. The `narrate.py` lint already flags sentences too long to
say in one breath, so don't list those here; judge whether the idea gets across.
