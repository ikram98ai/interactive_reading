# Writing the copy

- Story first, jargon second. Short sentences. Everyday pictures (a school, a bakery, a post office, a library, a
  football match…). Introduce a technical word in **bold** only once the idea is already clear.
- Never talk down, no baby talk, no emoji. Friendly, precise, a bit playful.
- "What the book says" is for grown-ups: the book's precise terms, the systems it names, its caveats and numbers. 3–5
  compact paragraphs, faithful to the text. **Curly quotes mean the book's exact words** — if you are paraphrasing, don't
  use them. (`tools/static/factcheck.py` enforces this.)
- Captions narrate cause and effect ("Because X, Y happens"), not just "done".
- Use varied, international first names.

## Explain it simply

The reader is a curious person who can program a little and has forgotten most school maths. Assume nothing else. The
class names below are CLRS's (`algo.css`); other books follow the same rules with their own markup.

1. **Concrete first.** Open with one specific situation with real numbers. The general rule comes after it.
2. **A one-line gist under every `<h2>`** (`.gist`). One sentence, at most 25 words, no symbols and no jargon. If someone
   reads only the gists, they should still get the chapter's story.
3. **Short and plain.** One idea per sentence. Most sentences under 20 words. Common words: "use", not "utilize".
   Banned: clearly, obviously, trivially, simply, note that, it is easy to see, we observe.
4. **Name things last.** Explain the idea, then give it the book's name. Mark a word in `<b>` or `<span class="term">`
   the first time, with its meaning in that same sentence. Every `.term` needs an entry in "Words to know" (use
   `data-w="…"` when the text says it differently, such as a plural).
5. **Every formula gets a `.decode` box**: the formula, what each symbol means in plain words, and a **With numbers**
   line with the arithmetic worked out. Say it in words before showing symbols. Never leave a symbol on the page that
   the reader hasn't been told the meaning of.
6. **Reasons, not proofs.** `.whyworks` gives the intuition for why a method works, in 1–3 sentences. Formal lemmas and
   proofs belong in "What the book says". Use `.mixup` only for a confusion readers really do have.
7. **Check the analogy.** An everyday picture must match the mechanism. If it breaks somewhere important, say where.
8. **Warm up when needed.** If a chapter needs maths the reader may have lost (complex numbers, modular arithmetic,
   matrix equations), add a warm-up scene before its first use, with its own machine. Its eyebrow starts `warm-up ·`,
   and its toc entry uses `<span class="n">start</span>`. Keep it elementary and short, and list it in your report.
9. **Keep rigour too.** "What the book says" stays precise and faithful. Simple copy is not vague copy: nothing in a
   story, caption or gist may be false. If a simplification hides a condition that matters, state the condition.
10. **If the book looks wrong.** Say so only after working the book's own example by hand. Then quote the book exactly,
    mark the correction as this page's reading, and raise it first in your report.
