# The quality bar

`make video-qa VIDEO=…` measures a lesson against the bar for its kind (read from the script beside it) and exits 1 on a
FAIL. The numbers come from measuring the reference courses lesson by lesson.

| Measure                                               | Concept     | Code            | Board       |
| ----------------------------------------------------- | ----------- | --------------- | ----------- |
| Pace, words over the whole running time               | 180–195 wpm | 150–175 wpm     | 140–190 wpm |
| Picture moving                                        | 5–11%       | (typing)        | under 12%   |
| Visual changes                                        | 6–10 a min  | (typing)        | under 14    |
| Longest pause, excluding the title card and the end   | under 3 s   | under 3.5 s     | under 3 s   |
| Silent motion, the picture moving with nobody talking | under 1.5 s | under 3 s       | under 1.5 s |
| Clutter, the share of the frame that isn't background | under 6%    | (code fills it) | under 15%   |

Fix every FAIL. Fix every WARN, or write down why it stays.
