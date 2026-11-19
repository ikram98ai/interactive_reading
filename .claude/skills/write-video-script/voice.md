# The voice

- **Pace by video kind:** concepts at about 175 words a minute, code videos at about 150, boards in between (the
  reference course's pace, slowed about 7% by choice). `narrate.py` sets Kokoro's speed and the gaps for each `kind`; don't add `{pause}` to slow it down.
- **One pace per video.** A page video's RUST part keeps the page's pace: the voice never slows down for the editor,
  because a viewer hears a change of speed as a different speaker. Where the code is really dense, give it a breath the
  viewer won't notice: an `{await}` on the machine beside the editor, or a short `{pause}` after the hardest line.
- **Section cards are read aloud.** A card (`{goto id | Part 3 of 6 | How does the book write it?}`) shows only its
  question; "Part 3 of 6" names the part for the tools and is never on screen. `narrate.py` has the voice read the
  question while the card is up, then breathe before the scene, so write the question to be heard: short, plain, no
  digits or symbols (the lint checks it like speech).
- **Person:** say "we" for the work you're doing together, and keep "you" for the viewer's own code.
- **Sentences:** short and declarative, with the occasional longer one that carries a "because" or a "so".
- **Show, then name:** "That's called the sorting problem." Then give the definition, in the book's words when it has
  them.
- **Signposts:** "Now", "So", "Let's say", "There you go", "Look, we have a compilation error", sparingly: at most one
  sentence in ten opens with "So", "Now" or "Let's" ([long-form.md](long-form.md), "Watch the openers"). Ask a question
  just before a surprise ("So what do you think is going to happen?").
- **Numbers:** never read numbers off the screen. The lint stops a sentence that recites more than two, and it stops
  digits and symbols: write "ampersand mut", not `&mut`.
- **Pronunciation:** write math the way a person reads it aloud ("theta of n squared", "log base b of a", "the floor of
  n over two", "c sub one"), and say "log", never "lg". The voice reads the variable a, and the letter A in "A of i", as
  the article "uh". Put `{say Eh}` right before each variable a (`{say Eh}a mod n`). It changes only what the voice says:
  the captions, the judged words and the screen keep "a". A capital A that names something (array A, computer A),
  "lg" and a few names (von Neumann, Dijkstra, Rabin) are respelled for the voice automatically by
  `tools/video/pronounce.tsv`. When a word comes out wrong, check how Kokoro phonemizes it, look up how it's really
  said, and add a rule there (with its source) rather than misspelling the script.
- **Checks:** check every number you say against the machine or the run with `{check selector ~ text}`. In the editor,
  the run panel is `#out`. A run fails when the page disagrees with the narration. A `{check}` proves the voice and the
  screen agree, not that either is right: the judge recomputes the numbers.
- **Warmth:** keep a little ("Now here's where it gets interesting", "Beautiful"), with no hype and no filler.
- **Our own voice:** never name another channel, tutor or course in a video — not in narration, cards, labels, titles,
  captions or descriptions. `narrate.py`'s banned-name lint enforces this for scripts.

## Sounding like a person

The reference course sounds like a teacher at a keyboard, not a narrator reading a script. These habits do that, and
every video should have a few of them. They are not filler: each one carries a reason, a warning, or a choice.

- **First person for your own actions:** "I'm going to add a function here", "let me show you a shortcut", "I'd rather
  not convert this twice, so let's store it in a variable". Keep "we" for the reasoning you do together.
- **Say why you did it:** "I made this private, because it's an implementation detail", "I'm using a small example, so
  we can see every step".
- **Ask, then answer:** "What do you think is going to happen? Well, let's take a look." Use it before every run whose
  result could surprise, and before every compiler error.
- **Judge your own code out loud:** "This works, but it looks repetitive", "That's better", "There's a problem with
  this".
- **Honest asides:** "That's an advanced topic, so let's not worry about it for now", "In a real program, you'd also
  check for an empty list", "This one comes up a lot in interviews".
- **Encourage on an exercise:** "Do your best to solve it on your own, even if it takes half an hour. Trust me, it's easier
  than you think", then the time to spend on it — the same time, said once.
- **Small reactions:** "There you go", "Beautiful", "Easy, right?", "Look at that". About one a minute.
- **Simplify on purpose, and say so:** "For simplicity, let's assume all the numbers are positive", "we can always
  improve this later".
