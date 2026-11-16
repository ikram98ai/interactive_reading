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

The same name, number and advice must hold within a video, across the videos that build on it, and between a book's
own videos (such as CLRS's 100-day course) and the chapter's long-form `script.md`.

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

## 10. Are references to other videos and the book true?

These include "Next, we're going to…", "We'll see this later", "The book has a whole chapter on…" and "as in Chapter
22". Check each one against what the video it points to really covers, the next chapter's text, or the book's table of
contents.

## 11. Does the recap claim only what was taught?

Skipping parts of a chapter is fine. A recap or closing line that mentions a topic the video never covered is not. List what was skipped in the report, so the skipping is a choice and not an accident.
