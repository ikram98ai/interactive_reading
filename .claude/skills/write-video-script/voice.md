# The voice

- **Pace by lesson kind:** concepts at about 190 words a minute, code lessons at about 160, exercises and boards in
  between. `narrate.py` sets Kokoro's speed and the gaps for each `kind`; don't add `{pause}` to slow it down.
- **Person:** say "we" for the work you're doing together, and keep "you" for the viewer's own code.
- **Sentences:** short and declarative, with the occasional longer one that carries a "because" or a "so".
- **Show, then name:** "That's called the sorting problem." Then give the definition, in the book's words when it has
  them.
- **Signposts:** "Now", "So", "Let's say", "There you go", "Look, we have a compilation error". Ask a question just before
  a surprise ("So what do you think is going to happen?").
- **Numbers:** never read numbers off the screen. The lint stops a sentence that recites more than two, and it stops
  digits and symbols: write "ampersand mut", not `&mut`.
- **Checks:** check every number you say against the machine or the run with `{check selector ~ text}`. In the editor,
  the run panel is `#out`. A run fails when the page disagrees with the narration. A `{check}` proves the voice and the
  screen agree, not that either is right: the judge recomputes the numbers.
- **Warmth:** keep a little ("Now here's where it gets interesting", "Beautiful"), with no hype and no filler.
- **Our own voice:** never name another channel, tutor or course in a video — not in narration, cards, labels, titles,
  captions or descriptions. `narrate.py`'s banned-name lint enforces this for scripts.

## Sounding like a person

The reference course sounds like a teacher at a keyboard, not a narrator reading a script. These habits do that, and
every lesson should have a few of them. They are not filler: each one carries a reason, a warning, or a choice.

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
- **Encourage on exercises:** "Do your best to solve it on your own, even if it takes half an hour. Trust me, it's easier
  than you think", then the time to spend on it — the same time, said once.
- **Small reactions:** "There you go", "Beautiful", "Easy, right?", "Look at that". About one a minute.
- **Simplify on purpose, and say so:** "For simplicity, let's assume all the numbers are positive", "we can always
  improve this later".
