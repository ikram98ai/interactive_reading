# The voice

- **Slow comes from stopping, not from a slow voice.** The voice talks at a person's speed (about 230 words a minute
  while it talks) and the video comes out at about 160, because it stops the way a teacher does: at every comma, between
  sentences, after a question, and longer after a result. A TTS slowed down stretches every sound evenly, and that is
  what sounds like a computer, so never ask for a slower voice. `narrate.py` opens the stops at the script's
  punctuation (`breathe`) and leaves longer gaps for code and boards; the script decides where they fall. Measured
  2026-11-22: the reference teacher pauses 40 to 45 times a minute, and this series' older videos 22.
- **One pace per video.** Wherever code is typed (a Short, a CS:APP RUST part), the voice keeps the video's pace and
  never slows down for the editor, because a viewer hears a change of speed as a different speaker. Where the code is
  really dense, give it a `{beat}` after the hardest line, or an `{await}` on the machine beside the editor.

## Breathing

The voice can only stop where the script lets it. Kokoro runs a phrase with no comma straight on, even across "and",
"which" or "because", so a sentence with no commas sounds read, not spoken.

- **A breath every six to ten words.** That's how often a person stops. Put commas where you'd breathe saying it aloud:
  after an opening phrase ("Here, the key is two."), around an aside, before a "but" or a "because". The lint warns
  about a run of more than sixteen words with nowhere to breathe.
- **Punctuation is timing.** A comma is a short breath (a quarter of a second), a colon or a dash a longer one, a full
  stop about half a second, and a question mark nearly a second. Write the stop you want: "There's a catch: it only
  works on sorted input." stops before the catch; "There's a catch that it only works on sorted input" doesn't.
- **Only a sentence end is a sure stop.** The voice says each sentence on its own, so every full stop and question mark
  gets its pause. A comma, colon or dash gets one only where Kokoro itself leaves a little silence; where it runs the
  words together, a cut would clip them (the end of a t or an s, or the start of a variable like a), so `narrate.py`
  lets it run on. A stop that matters ends its sentence, and a `{beat}` goes after a sentence's end.
- **`{beat}` lets a result land.** Put it after a sentence the viewer should stop and take in, about 1.2 s of silence:
  a result ("So the loop never runs at all. {beat}"), a surprise, or a question you want them to think about before you
  answer ("What do you think happens when j reaches zero? {beat} Well, let's look."). About one a minute; more and the
  video drags. It's a timing cue, so adding or moving one needs no new judgement. Use `{pause N}` only for a set length
  over a still picture, and `{await}` to wait for an animation.

## Write for the ear

A viewer hears each sentence once, at the voice's speed, and can't reread it. A script is written to be heard, not read.

- **One idea a sentence**, usually eight to fifteen words. The lint warns over twenty-five words and fails over
  thirty-four. Split a sentence that defines two things, or defines one thing and uses it.
- **The point first, then the detail.** "Five is bigger than two, so it slides right" beats "Since the value at
  position j, which is five, is greater than the key, two, it slides right."
- **Intuition before the definition.** Show what happens, say it in plain words, then give the book's name and its
  definition ("Show, then name", below). A term never appears before it's explained.
- **Say the key idea twice, two ways.** After a definition or a result that matters, say it again in plain words:
  "In other words, the hand is always sorted." That's not repetition: the first time is the book's words, the second is
  the viewer's.
- **Say why, every time.** Each step of a walk gets its reason ("because the first card on its own is already sorted").
  A step with no reason is a fact to memorize; a step with one is understood.
- **Read it aloud before it's judged.** Say each paragraph aloud at a teacher's speed. Where you run out of breath, add
  a comma or split; where you stumble, rewrite; where you'd look up at the viewer, add a `{beat}`.
- **One lesson, not a run of titles.** A new part (`{goto id | Part 3 of 6 | How does the book write it?}`) is a
  dissolve through the page's background into its scene while the voice goes on. Nothing of the card is on screen or
  spoken: "Part 3 of 6" names the part for the tools, and the heading is the chapter's title in the YouTube timeline
  (short, plain, no digits or symbols). The move to the new topic is the script's own words, the way a teacher at a
  board moves on: the part's first sentence, spoken over the dissolve, picks up what the last part just found and
  turns it toward the new question ("Arithmetic and loads are one step each. Raising to a power is less clear-cut."),
  then the part answers it. Never read the heading, never open on a bare "Now let's look at …", and don't ask the
  question twice. Put the card at the head of the part's first paragraph: `{goto id | … | …}{scene} First words …`.
  `narrate.py` fails a card with no words over its dissolve, and a part that opens with its own heading.
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
- **Ask, wait, then answer:** "What do you think is going to happen? {beat} Well, let's take a look." Use it before
  every run whose result could surprise, and before every compiler error. The `{beat}` is the point: a question
  answered at once is a rhetorical flourish, and one with a moment to think is a question.
- **Judge your own code out loud:** "This works, but it looks repetitive", "That's better", "There's a problem with
  this".
- **Honest asides:** "That's an advanced topic, so let's not worry about it for now", "In a real program, you'd also
  check for an empty list", "This one comes up a lot in interviews".
- **Encourage on an exercise:** "Do your best to solve it on your own, even if it takes half an hour. Trust me, it's easier
  than you think", then the time to spend on it — the same time, said once.
- **Small reactions:** "There you go", "Beautiful", "Easy, right?", "Look at that". About one a minute.
- **Simplify on purpose, and say so:** "For simplicity, let's assume all the numbers are positive", "we can always
  improve this later".
