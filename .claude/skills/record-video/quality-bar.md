# The quality bar

`make video-qa VIDEO=…` measures a video against the bar for its kind (read from the script beside it) and exits 1 on a
FAIL. The numbers come from measuring the reference course video by video.

| Measure                                               | Concept     | Code            | Board       |
| ----------------------------------------------------- | ----------- | --------------- | ----------- |
| Pace, words over the whole running time               | 150–172 wpm | 135–160 wpm     | 131–178 wpm |
| Talking pace, words over the time the voice talks     | 205–260 wpm | 205–260 wpm     | 205–260 wpm |
| Breaths, stops of a tenth of a second to 1.2 s        | 34–50 a min | 34–50 a min     | 34–50 a min |
| Long stops, over 1.5 s on a still picture             | under 0.5 a min | under 1.5 a min | under 0.5 a min |
| Picture moving                                        | 5–11%       | (typing)        | under 12%   |
| Visual changes                                        | 6–10 a min  | (typing)        | under 14    |
| Longest pause, excluding the title card and the end   | under 3 s   | under 3.5 s     | under 3 s   |
| Silent motion, the picture moving with nobody talking | under 1.5 s | under 3 s       | under 1.5 s |
| Clutter, the share of the frame that isn't background | under 6%    | (code fills it) | under 15%   |
| Clipped stops, a pause that cuts into a sound         | none        | none            | none        |

The overall pace is slower than the reference teacher's (about 180) by the author's choice, but the talking pace and the
breaths are the teacher's: a video is slowed by stopping more, never by a slower voice. Too few breaths is a script
written for the eye (sentences with no commas: fix them, voice.md "Breathing"); a talking pace under the bar means
someone slowed the voice in `narrate.py`; too many long stops is dead air (narrate over the animation, or shorten it).

A clipped stop is a pause cut through the middle of a sound: a few milliseconds out, one edge is still louder than
−15 dB and the other louder than −32 dB, and a viewer hears it as a chop or a glitch (a voice that stops by itself is
below −21 dB by then). A word can start sharply on its own after a real silence, so a stop loud on one side only isn't
failed: QA lists it, with any edge between −18 and −15 dB, under "listen to". Listen to each one. It's a `narrate.py` `breathe()` bug, not a script one: fix the cut there and
narrate again, never hide it with a comma.

Fix every FAIL. Fix every WARN, or write down why it stays.
