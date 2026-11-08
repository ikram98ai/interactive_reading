---
title: Big O, Omega, and Theta
kicker: Introduction to Algorithms · Chapter 3
page: books/clrs/ch03.html
scene: big-o
seed: 1
targets:
  s1plot: svg:62,28,482,240
  s1fname: svg:546,32,104,36
  s1gname: svg:546,68,104,36
  s1cross: svg:440,30,108,234
  s5plot: svg:62,30,552,182
  s2plot: svg:76,30,580,206
  s2chips: svg:110,262,530,40
  s3plot: svg:62,36,594,222
  s3lamps: svg:64,290,532,40
  s4arr: svg:24,8,620,130
  s4up: svg:24,202,300,156
  s4low: svg:334,202,240,134
  s8claims: svg:8,10,254,262
  s8c0: svg:12,38,244,34
  s8plot: svg:300,30,350,236
  s8verdict: svg:10,290,640,52
  s10plot: svg:56,30,372,248
  s10table: svg:440,20,214,250
  s11ruler: svg:20,20,630,130
  s11wobble: svg:52,116,426,32
  s11verdict: svg:24,230,612,46
  s13clock: svg:24,26,270,270
  s13work: css:#s13-svg [data-part=work]
  s13rust: css:#s13-svg [data-part=rust]
  s13b: css:#s13-svg [data-part=b]
  s13class: css:#s13-svg [data-part=class]
  s15n0: css:#s15-svg [data-part=n0]
  s13result: svg:310,44,240,80
  s13rem: svg:310,124,168,42
  s13euclid: svg:476,124,178,42
  s13eq: svg:310,178,342,66
  s15plot: svg:40,20,610,260
  s16row2: svg:10,70,640,80
  s16row10: svg:10,225,640,70
  s18chain: svg:10,70,640,110
  s20cards: svg:58,34,600,296
---
<!--
QA (make video-qa, bm_fable, 15:50): pace 179 wpm (near), moving 6.7%, changes 13.5 a minute (WARN), longest pause 2.9 s,
silent motion 0.6 s, clutter 4.0%. The changes WARN stays: what is left is mostly the machines' own runs (scans, dot sweeps,
slider drags, claim checks) plus one ring per named thing. Rings already linger instead of fading between sentences;
cutting more would leave nouns unmarked. Chapter 1 measures 12.2.
-->


{click c·n²}{slider 0 10}{pause 0.2}

{scene}{check #s1-svg ~ 10⁶·n²}{focus s1fname} Here's a function that grows like n cubed. {focus s1gname} And here's a ceiling, a million times n squared. That's an enormous head start. So does the ceiling stay on top forever?

{speed 2}{click Play}{focus s1plot} We double n, again and again, and each time we check that the function is still under the ceiling. {await}

{speed 1}{check .is-full .caption ~ not O(n²)}{check #s1-svg ~ 142,8}{focus s1cross} For a long time, it is. But past a hundred thousand, the function breaks through, and it never comes back. A bigger constant only lifts the line. It can't make it steeper, and in the long run, the steeper line always wins.

{title} This is chapter three of Introduction to Algorithms, the classic textbook. It answers one question: how do you describe how fast an algorithm is, without drowning in details? Here's what we'll cover.

{item What big O promises} We'll start with what big O actually promises, {item Floors and tight bounds} and then its two siblings, omega and theta. {item Why insertion sort is Θ(n²)} We'll use them on insertion sort, {item Which running time you mean} and see why you have to say which running time you mean. {item Bounds that aren't tight} Then come bounds that aren't tight, {item Remainders, and a Rust trap} the remainders hiding in every hash table, {item Which functions grow fastest} and finally, which functions grow fastest.

Along the way, we'll look at the Rust versions of these checks, and see how Rust borrows, clones and handles a missing value. You don't need any calculus to follow along. So let's get started.

{goto big-o | Part 1 of 7 | What does big O promise?}{click c·n³}{slider 0 4}

{scene} In the last chapter, we found the exact running time of insertion sort. It was a long formula full of constants, and then we threw almost all of it away. This chapter is about why that's allowed.

{focus s1plot} Here's our function again. Its biggest term is seven n cubed, so we say it grows at the rate n cubed. The smaller terms, and even the seven, don't change that.

{focus off}{label Big O} Big O gives an upper bound. When we say f is big O of n cubed, we mean that some constant times n cubed sits on or above f, once n is large enough.

So let's try a ceiling of eight n cubed. {speed 2}{click Play} On small inputs, the function pokes above it, because the n squared term still counts there. {await}

{speed 1}{check .is-full .caption ~ return 64}{check #s1-svg ~ 99.8}{focus s1plot} But from about a hundred on, every dot stays under the ceiling. So f is big O of n cubed.

Notice the axes. They're both logarithmic, so every power of n becomes a straight line, and the power is its slope. The constant only slides the line up or down.

That's why no constant could save n squared. Its line isn't as steep, and a steeper line always passes a shallower one in the end.

{click c·n⁴}{pause 0.2}{speed 2}{click Play} And f is also big O of n to the fourth, because that ceiling is steeper still. {await}

{speed 1}{check .is-full .caption ~ O(n⁴)} An upper bound doesn't have to be tight. It only has to hold.

{goto formal-o}{pause 0.3}

{label The formal definition} Now let's make that precise. f is big O of g if we can name two positive constants. A factor c, and a starting point n zero, so that f is at most c times g for every n from n zero on.

{focus s5plot} The book's trick is to divide both sides by g. So this plot shows the ratio, f over g, and the test is simple. To the right of n zero, the blue curve has to stay under the line c.

This time, the function is four n squared, plus smaller terms with big coefficients. We'll start at ten, and let the machine find the smallest c that works. {speed 2}{click Find c} It scans every n, and raises c whenever the curve pokes above it. {await}

{speed 1}{check .is-full .caption ~ c = 19} Starting at ten, c has to be nineteen. {focus off}{slider 0 0} If we start at one, {speed 2.5}{click Find c} the curve is much higher there. So c has to be six hundred and four. {await}

{speed 1}{check .is-full .caption ~ c = 604}{slider 0 6}{speed 2.5}{click Find c} And if we start at a hundred, the constant drops to just over five. {await}

{speed 1}{check .is-full .caption ~ c = 5.05}{focus s5plot} A later start buys a smaller constant. But c can never get down to four, because the ratio never drops that low. So big O is a ceiling. What about a floor?

{goto omega | Part 2 of 7 | What do omega and theta add?}{pause 0.6}

{scene}{label Omega} Omega is the mirror image of big O. It's a lower bound. When we say f is omega of n cubed, we mean that some constant times n cubed stays on or under f, once n is large enough.

{check #s2-svg ~ 10⁻³·n⁴}{focus s2plot} Here's the same function, over a floor of a thousandth of n to the fourth. On small inputs, the floor hugs the axis. It looks perfectly safe.

But these claims are about the long run, so the honest test is to zoom out. {speed 1.5}{click Play} Ten times more n, then ten times more again. Each time, we check that the floor is still under f, at the right edge. {await}

{speed 1}{check .is-full .caption ~ not Ω(n⁴)}{focus s2chips} For three windows, the floor holds. Then it comes up through f, and it stays above. A smaller constant only moves the break further out. So f is not omega of n to the fourth.

{goto theta}{pause 0.3}

{label Theta} Theta is both at once. It's a tight bound. f is theta of n cubed when it stays between two multiples of n cubed, a floor and a ceiling, from some point on.

{focus s3plot} This plot divides everything by n cubed, so the floor and the ceiling become two flat lines. {focus off}{speed 2}{click Play} Let's check every n again. Each dot is the ratio, f over n cubed. {await}

{speed 1}{check .is-full .caption ~ Θ(n³)}{focus s3plot} The ratio starts high, then slides into the band and settles at seven, the leading coefficient. {focus s3lamps} The ceiling holds, the floor holds, so f is theta of n cubed.

{slider 1 5}{pause 0.2} Now let's lower the ceiling to exactly seven. {speed 3}{click Play} Then we check every n again, from the very start, against the new ceiling. {await}

{speed 1}{check .is-full .caption ~ O half fails}{focus s3lamps} The ratio is always a little above seven, so the ceiling fails, and so does theta.

{focus off}{card Θ means O and Ω. | A tight bound is a ceiling and a floor, from some n₀ on.} The book states this as a theorem. A function is theta of g exactly when it's both big O and omega of g. And the two constants don't have to match.

{goto insertion | Part 3 of 7 | Why is insertion sort Θ(n²)?}{pause 0.6}

{scene} Now let's use these tools on insertion sort. In the last chapter, we found its worst case by adding up exact sums. Here, we'll get it with two quick arguments, one for each bound.

{focus s4up}{label The ceiling} First, the ceiling. The outer loop runs once for each card. For each card, the inner loop shifts at most the cards on its left. So the shift runs fewer than n squared times, on every input. That's big O of n squared.

{focus s4arr}{label The floor} Now the floor. For that, we need a nasty input. We split the array into thirds, and put the largest values in the first third.

Each of those values has to end up in the last third. But a shift only moves a value one place at a time. So each one has to step through every position in the middle third.

{speed 2}{click Play} Let's run it. {focus s4up} On the left, every shift fills one slot, and they all fit inside the square. {focus s4low} On the right, a slot fills each time a big value steps into a middle position. {await}

{speed 1}{check .is-full .statrow ~ forced moves9 / 9}{focus s4low} All nine moves happened, as they had to. A third of the values, times a third of the positions, is n squared over nine.

That's omega of n squared. And together with the ceiling, insertion sort's worst case is theta of n squared.

{label Already sorted}{click Sorted}{pause 0.2}

{speed 2}{click Play} But mind the word worst. On an array that's already sorted, every card is already in place. {await}

{speed 1}{check .is-full .statrow ~ line 6 runs0}{focus s4up} The shift never runs at all, and the whole sort takes linear time. So insertion sort isn't theta of n squared on every input. And that turns out to matter.

{goto running-times | Part 4 of 7 | Which running time do you mean?}{pause 0.6}

{scene} An algorithm doesn't have just one running time. It has one for every input. Its worst case takes the slowest input of each size, and its best case takes the fastest.

{focus s8claims} Here are some claims about insertion sort. Some of them name a case, and some don't. A claim with no case named is a blanket statement, so it has to hold for every input.

{focus s8plot} The dots are real runs, on sorted, random and reversed inputs, up to about two thousand numbers.

{focus s8c0}{label Worst case} The first claim says the worst case is theta of n squared. {focus off}{check .is-full .caption ~ n₀ = 16}{click Check} The checker fits a band at sixteen, then tests every larger n, and only the reversed inputs count. {await}

{check .is-full .caption ~ TRUE}{focus s8verdict} Every run stays inside the band, so it's true.

{focus off}{label No case named}{click Claim: insertion sort's running time is Θ(n²)}{pause 0.2} Now let's drop the word worst. {click Check} This time, all three colors count. Watch the sorted dots. {await}

{check .is-full .caption ~ Overstated}{focus s8plot} They slide right out of the band, because sorted input takes linear time. So the blanket claim is false. Insertion sort's running time is big O of n squared, and omega of n. But it isn't theta of either.

{focus off}{label O isn't Θ}{click Merge sort}{click Claim: merge sort's beats O(n²) insertion sort}{pause 0.2}

Here's a mistake people make all the time. Merge sort runs in n log n time, so it must beat an algorithm that's big O of n squared, right? {click Check} Let's compare them, input by input. {await}

{check .is-full .caption ~ FALSE}{focus s8verdict} On sorted input, insertion sort wins at every size. Big O is only a ceiling, so a big O of n squared algorithm might really run in linear time. If you mean a tight bound, say theta.

{focus off}{label In Rust}{hide stats}{split}{show panel}{rust}{click Insertion sort}{pause 0.3}

Now let's see how the Rust version runs these checks, because it can't just hand the input to the sort.

{click Step x2}{focus rs:112} Sorting changes an array in place. But the same input has to be checked again, for the next claim. So this line makes a clone. {focus heap} A clone is a brand-new buffer on the heap, with its own owner, the variable a.

{focus rs:113} Then the sort borrows the clone mutably. {focus stack} Its frame gets a mutable reference to that buffer, and nothing else.

While the sort runs, nobody else can touch that buffer, because a mutable borrow is exclusive. And the input itself was only read, through a shared borrow, so it's still there, untouched.

{focus off}{speed 3}{click Check} Let's finish the check. Each run gets a fresh clone, and the input stays unsorted for the next one. {await}

{speed 1}{focus rs:118} At the end of each pass through the loop, the clone goes out of scope, and Rust frees its buffer. So here's the pattern. When you need to change data, but also keep the original, clone it, and change the copy.

{goto little-o | Part 5 of 7 | What if a bound isn't tight?}{pause 0.6}

{scene} Two n is big O of n squared. That's true, but n squared grows so much faster that the bound says almost nothing. The book calls a bound like that not asymptotically tight, and gives it its own notation.

{label Little o} Little o turns some constant into every constant. f is little o of g when, for every positive c, however tiny, f eventually drops below c times g.

{focus s10plot} The blue line is the ratio of two n to n squared. The purple one is two n squared over n squared. {focus off}{slider 0 0} Let's drag c all the way down to a thousandth.

{check .is-full .caption ~ n₀ = 2,001}{focus s10plot} The blue ratio still drops below it. It just takes until about two thousand. A smaller c only pushes that point to the right. But the purple ratio sits at two forever, so it never gets under any c below two.

{focus off}{speed 2.5}{click Play} Now the machine runs that search for four values of c, smaller and smaller, on both functions. {focus s10table} For the blue function, every c finds a starting point. For the purple one, none of them do. {await}

{speed 1}{check .is-full .caption ~ 2n = o(n²)}{focus s10table} So two n is little o of n squared, but two n squared is not. For an engineer, little o means strictly smaller. A cost that's little o of n squared falls below any fraction of n squared, once n is large enough.

{goto comparing}{pause 0.3}

{label Comparing functions} So the five notations work like comparing numbers. Big O is like less than or equal, and omega is like greater than or equal. Theta is like equal, little o is like less than, and little omega is like greater than.

{focus s11ruler} We can picture common growth rates as points on a ruler. {check #s11-svg ~ Some(Less)}{focus s11verdict} Here, n sits to the left of n log n, so it's little o of it, and big O of it too.

But one rule from numbers doesn't carry over. Any two numbers can be compared. Not every two functions can. {click n^(1+sin n)}{pause 0.3}{focus s11wobble} This function is n to the power one plus sine n. Its exponent swings between zero and two, forever.

{check #s11-svg ~ None}{focus s11verdict} So against n log n, it's neither big O nor omega. In Rust terms, the comparison returns None. Functions are only partially ordered.

{goto modular | Part 6 of 7 | Why is −7 mod 5 equal to 3?}{hide s13work+s13rust+s13b+s13class}{pause 0.6}

{scene} Remainders are everywhere in programs. A hash table picks a slot with the key mod n, and a ring buffer wraps around the same way. The book pictures a mod n on a clock.

{focus s13clock} This clock has five positions. We want minus seven mod five. So we start at the top and walk backwards. {speed 1.5}{click Play} Each time the hand passes the top, going back, that's one more lap. {await}

{speed 1}{check .is-full .statrow ~ a mod n3}{show s13work}{focus s13result} We end up on three. That's two laps back, then three steps forward. {show s13b}{focus s13eq} The second hand walked forward to the same slot. Numbers that land on the same slot are called equivalent, modulo five.

{show s13rust}{focus s13rem}{label A Rust trap} Now here's the trap. Rust's percent operator isn't the book's mod. Like C and Java, it truncates toward zero, so the answer keeps the sign of the number you started with. Here, that's minus two, a slot that doesn't exist. {focus s13euclid} The method rem euclid gives the book's answer.

{label In Rust}{hide stats}{split}{show panel}{rust}{pause 0.3}

{focus rs:21} Here's a ring buffer with five slots. {focus rs:23} With the book's mod, the index is three, and it picks slot D.

{check .is-full .memstrip ~ 18446744073709551614}{focus rs:25} Now let's use percent instead, and turn minus two into an index. An index can't be negative, so the conversion wraps around, to a number near eighteen quintillion.

{focus rs:26-28} Indexing with that would crash the program. So instead, we call get, which returns an Option. That's either Some, holding the value, or None, when there's nothing there. Here, it's None.

This is how Rust replaces the book's NIL. The type itself says the answer might be missing, and the compiler won't let you use it until you've handled both cases.

{goto exponentials | Part 7 of 7 | Which functions grow fastest?}{hide s15n0}{pause 0.6}

{scene} Running times are built from a handful of functions. Powers, exponentials, logarithms, and factorials. So which ones grow fastest?

{label Exponentials beat powers}{focus s15plot} Here's n to the tenth, against one point one to the n. On a log scale, the exponential is a straight line, while the power bends over. {focus off}{click Find n₀} The machine looks for the point where the exponential takes the lead, for good. {await}

{check .is-full .caption ~ n ≥ 686}{focus s15plot} For a while, the power is ahead. {show s15n0} But at about seven hundred, the exponential passes it, and the gap only grows.

{focus off}{hide s15n0}{slider 1 40}{pause 0.3} So let's give the power a bigger head start, n to the fortieth. {click Find n₀} This time, the machine has to walk much further to the right, before the exponential finally takes over. {await}

{show s15n0}{focus s15plot} The crossing moved, but it's still there. Any exponential with a base above one grows faster than any power of n. {focus off}

{goto logarithms}{pause 0.3}

{label Logarithms} Logarithms go the other way. How many times can you cut a thousand in half, before less than two is left? {speed 1.5}{click Play} On a log axis, every cut is the same stride. {await}

{speed 1}{check .is-full .statrow ~ cuts9}{focus s16row2} Nine. That count is the log base two of a thousand, rounded down. That's why log base two shows up wherever an algorithm splits a problem in half.

{click b = 10}{pause 0.2}{focus s16row10} Cut by ten instead, and we take fewer, longer strides. But the ratio between the two logs never changes. Changing the base only multiplies a log by a constant. So inside big O, the base doesn't matter, and the book just writes log n.

{goto iterated}{pause 0.3}

{label The iterated logarithm}{focus s18chain} Here's the slowest one of all. Log star of n counts how many times we take the log before we get down to one. {check #s18-svg ~ 19,729}{speed 1.5}{click Play} This number has almost twenty thousand digits. {await}

{speed 1}{check .is-full .statrow ~ lg* n5}{focus s18chain} Five steps, and we're at one. That number is far bigger than the number of atoms in the universe. So for any input you'll ever meet, log star of n is at most five.

{goto p3-3}{pause 0.3}

{label Putting it in order}{focus s20cards} Let's finish with an exercise from the book. Here are twelve functions, in no particular order, and the job is to rank them, with the fastest growing on top.

{focus off}{click Solve} The machine compares logarithms of the values, because the values themselves would overflow any number type. It sorts the cards, then checks which neighbors grow at the same rate. {await}

{check .is-full .caption ~ Ranked}{focus s20cards} The factorial is on top, then the exponentials, then the powers of n, and then the logs. A few were in disguise. Four to the log n is just n squared. And n to the one over log n is the constant two.

{focus off}{card n! ≫ 2ⁿ ≫ n² ≫ n lg n ≫ lg n ≫ lg* n | Exponentials beat powers, and powers beat logs.} So that's the ladder. Exponentials beat powers, powers beat logs, and the base of a log is only a constant.

{goto big-o | Recap | What you learned}{pause 0.6}

{scene}{card Big O is a ceiling. Ω is a floor. | Each one holds from some n₀ on, up to a constant.} Let's recap. Big O says a function grows no faster than another, and omega says it grows at least as fast, up to a constant, from some point on.

{card Θ is both at once. | A tight bound: a ceiling and a floor.} Theta is both at once, a tight bound.

{card Insertion sort is Θ(n²) in the worst case. | On sorted input, it's Θ(n).} Insertion sort's worst case is theta of n squared. But on sorted input it's linear.

{card Say which running time you mean. | In Rust: clone what you keep, borrow what you read or change.} So say which running time you mean, and use theta when you mean a tight bound. In Rust, clone what you need to keep, and borrow what you only read or change.

{card o and ω are strict. | Some functions can't be compared at all.} Little o and little omega are strict, and some functions can't be compared at all.

{card a mod n is never negative. | Rust's % can be, and get returns an Option.} The book's mod is never negative, but Rust's percent can be. And instead of crashing, get returns an Option.

{card Exponentials beat powers. Powers beat logs. | A log's base is only a constant.} And as inputs grow, exponentials beat powers, and powers beat logarithms.

{card Try every machine yourself. | The link is in the description.} All of these machines are interactive, and the link is in the description. Try dragging the constants, and see if you can find a ceiling that holds. In the next video, we'll look at divide and conquer, and how to find the running time of an algorithm that calls itself. {pause 0.4}
