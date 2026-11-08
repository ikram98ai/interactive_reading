---
title: Probability, and Algorithms That Roll Dice
kicker: Introduction to Algorithms · Chapter 5
page: books/clrs/ch05.html
scene: birthday
seed: 1
targets:
  calendar: svg:24,54,334,134
  bhead: svg:8,6,380,44
  bplot: css:#s8-svg [data-part=plot]
  bnames: css:#s8-svg [data-part=names]
  plotarea: svg:362,40,290,284
  ranks: svg:24,36,612,92
  office: svg:26,176,302,70
  tray: svg:332,176,302,70
  s1cost: css:#s1-svg [data-part=cost]
  costbar: svg:24,254,612,56
  orders: svg:20,12,620,72
  current: svg:20,86,620,42
  s2hist: svg:60,140,540,212
  coins: svg:88,38,470,56
  indicators: svg:88,100,470,40
  total: svg:560,104,92,32
  s4lin: css:#s4-svg [data-part=linearity]
  lin: svg:100,150,460,22
  s4hist: svg:50,176,580,136
  s5row: svg:8,10,644,96
  s5bars: css:#s5-svg [data-part=bars]
  bars: svg:8,110,644,128
  s5stack: css:#s5-svg [data-part=stack]
  stackarea: svg:8,238,644,82
  s6in: svg:8,8,644,66
  s6out: svg:8,96,644,64
  s6hist: svg:8,172,644,146
  s7cells: svg:30,34,262,140
  s7choices: svg:316,8,330,124
  s7inv: css:#s7-svg [data-part=invariant]
  s7hist: svg:8,180,644,130
  bins: svg:16,12,628,152
  s9chart: svg:8,170,644,156
  applicants: svg:16,36,628,160
  firstk: svg:16,40,226,152
  s11chart: css:#s11-svg [data-part=chart]
  chartarea: svg:16,202,636,148
---

<!--
Plan: a cold open on the birthday room, then seven parts. RANDOM(a, b) (s3), streaks (s10) and problems 5-1 and 5-2
are left for the page. Rust segments (BLUEPRINT.md item 8): how a Vec grows and a Vec of Vecs is many allocations, in Part 2
(s2); a generic shuffle<T> and a seeded generator borrowed with &mut self, in Part 4 (s6). Borrows, slices and to_vec
are ch02's and are only referred back to.
-->

{hide bnames+bplot}{scene}{focus calendar} Here's a calendar, with one square for every day of the year. {focus off} People walk into a room one at a time, and each one marks their birthday. So how many people does it take before two of them share a day?

{speed 2.5}{click Play} Each yellow square is somebody's birthday. A red one means two people share it. {await}

{speed 1}{check #s8-svg ~ k = 20 people}{focus bhead} That took just twenty people. But was it luck? {slider 0 23} Let's put twenty-three people in the room, {click Simulate 1000 rooms} and try it in a thousand rooms. {await}

{show stats}{check #s8-stats ~ people k23} About half of them have a shared birthday. That's twenty-three people, and three hundred sixty-five days. The trick is that we're not counting people. We're counting pairs.

{title} This is chapter five of Introduction to Algorithms, the classic textbook. It's about randomness, how to analyze it, and how to use it on purpose. Here's what we'll cover.

{item The cost of hiring} We'll start with a hiring problem, and what it costs. {item Averaging over every input} Then we'll average that cost over every possible input, {item Indicator random variables} and learn a trick that makes those averages easy. {item Randomized algorithms} After that, we'll use randomness to beat an opponent, {item Shuffling fairly} and learn how to shuffle fairly. {item Birthdays and bins} Then we'll come back to the birthdays, {item Choosing only once} and finally, we'll hire someone with only one chance to choose.

Along the way, we'll write the code in Rust, and see how a vector grows, and what a random-number generator really is. You don't need any probability theory to follow along. So let's get started.

{goto hiring | Part 1 of 7 | What does hiring cost?}{hide s1cost}{pause 0.6}

{scene} Let's say you need an office assistant. An agency sends you one candidate a day, and you interview each one. {focus ranks} The number on each card is how good that candidate is. Higher is better.

{focus office} You always want the best person you've seen so far. So whenever a candidate beats the assistant you have, you let the assistant go, and hire the new one. {focus off}

{show s1cost}{focus costbar} Interviews are cheap. Here, each one costs one. But hiring is expensive, because the agency charges a big fee every time you hire. Here, it's ten. {focus off}

{split}{show panel}{label HIRE-ASSISTANT} Here's that procedure. {focus code:1} It starts with a dummy candidate, who's worse than everybody. {focus code:3} It interviews each candidate in turn, {focus code:4-6} and if they're better than the current assistant, it hires them. {focus off}

{speed 2}{click Play} Every time a candidate beats the one at the desk, we pay the hiring fee again, and the old assistant goes home. {await}

{speed 1}{check #s1-stats ~ hires m4}{show stats} We hired four times, out of eight candidates. {focus costbar} And most of the bill is hiring fees. {focus off}

We always interview everyone, so that part of the bill never changes. What changes is how many times we hire, and that depends only on the order the candidates arrive in.

{label The worst order}{click Increasing (worst)}{pause 0.2} So what's the worst order? {speed 3}{click Play} If every candidate is better than the one before, every candidate is the best so far. So we hire every single one. {await}

{speed 1}{check #s1-stats ~ hires m8} That's the worst case. We pay the hiring fee for all of them.

{label The best order}{click Decreasing (best)}{pause 0.2} {speed 3}{click Play} And if the best one comes first, nobody after can beat them. {await}

{speed 1}{check #s1-stats ~ hires m1} So we hire just once.

{label}{focus off} This pattern shows up everywhere. Any time you scan a list for its biggest value, you keep a current winner, and the hires are how often that winner changes. But we don't control the order. So what happens on a typical day?

{goto prob-analysis | Part 2 of 7 | What happens on a typical day?}{pause 0.6}

{scene} To keep things small, let's take four candidates. {click Step x2}{focus orders} Here's every order they can arrive in. Any of the four can come first, then any of the three that are left, and so on. That's twenty-four orders.

{focus off} We don't know which order the agency will send. So let's assume every order is equally likely. That's called a uniform random permutation.

{label Probabilistic analysis} Now we run hire assistant on every order, and average the number of hires. This is called probabilistic analysis, and its answer is called the average-case cost.

{speed 3.5}{click Play}{focus s2hist} Each order drops into a column for the number of hires it makes. The taller a column, the more orders land in it. {await}

{speed 1}{check #s2-stats ~ 2.0833}{show stats} Only the order sorted from worst to best hires all four. On average, we hire just over two times.

{focus off}{label Often weakest first}{click Often weakest first}{pause 0.2} But this answer is only as good as our assumption. What if the agency usually sends the weakest candidate first? {check #s2-stats ~ 3.0417}{focus s2hist} Now the sorted order is far more likely, and the same algorithm averages about three hires.

{focus off} So probabilistic analysis only works when you know how your inputs are spread out. Keep that in mind, because we'll fix it soon.

{label In Rust}{hide stats}{split}{show panel}{rust}{click Uniform}{click Reset}{pause 0.3}

Now let's see this in Rust. {label}{click Step}{focus rs:31} Here, main makes an empty vector called all. {focus stack} Its length is zero, and so is its capacity. It hasn't allocated anything yet.

{click Step}{focus rs:33} Then we fill it with every order. {focus stack} Now its length is twenty-four, but its capacity is thirty-two. That's because a vector grows by doubling. When it runs out of room, it moves to a buffer twice as big, so most pushes don't allocate at all.

{focus heap} And look at what's inside. Each of those slots is a small vector of its own, pointing to its own little buffer. So a vector of vectors isn't one grid. It's twenty-five separate allocations.

{click Step x3}{focus rs:38} As we saw in chapter two, the loop only borrows each order, and hires reads it through a slice. {focus heap} So nothing is copied. The arrows just point into buffers that all already owns.

{focus off}{speed 5}{click Play} Let's run the other orders, and watch each one get lent out and handed back. {await}

{speed 1}{focus heap} When main ends, all is dropped. It frees every small buffer first, and then its own, so all twenty-five allocations are gone. {focus off} And if you know how many items you'll need, you can ask for that capacity up front, and skip the moving.

{goto indicator | Part 3 of 7 | How many hires should we expect?}{hide s4lin}{pause 0.6}

{scene} Averaging over every order worked for four candidates. But with ten, there are more than three million orders. So we need a better way, and it starts with a coin.

{focus coins} Here are ten coins. {focus indicators} Under each coin, we write a one if it lands heads, and a zero if it lands tails. {focus off}{label Indicator random variables} That's called an indicator random variable. It turns an event into a number.

{speed 3}{click Play} Let's flip them. Each coin adds its one or its zero to the total, so the total counts the heads. {await}

{speed 1}{focus indicators} Here's why this helps. Each indicator is one half the time, so on average, it's worth one half. {show s4lin}{focus lin} And the average of a sum is the sum of the averages. That's called linearity of expectation. So with ten coins, we expect five heads. {focus off}

{show stats}{click Run 1000}{focus s4hist} Let's check that with a thousand experiments. {await}

{check #s4-stats ~ E[X] = n/25} The average lands right on five, even though most experiments don't give exactly five.

{focus off}{label Copies of coin 1}{click Copies of coin 1}{pause 0.2} Now here's where it gets interesting. Let's make every coin copy the first one. {click Run 1000}{focus s4hist} Now we get no heads or ten heads, and nothing in between. {await}

{check .is-full .caption ~ never anything in between} And the average is still five. Linearity works even when the coins depend on each other, and that's what makes it so useful.

{goto hiring-analysis}{hide s5bars+s5stack}{pause 0.3}

{label Back to hiring}{focus s5row} Now let's use this on hiring. Here are ten candidates, in a random order. We give each one an indicator, that's one if we hire them. Then the number of hires is the sum.

{focus off}{speed 3}{click Play} Candidate number i is hired only if they're the best of the first i. {await}

{speed 1} So what's the chance of that? In a random order, any of the first i candidates is equally likely to be the best of them. So candidate i is hired with a chance of one in i.

{show s5bars}{focus bars} These outlines show one, then a half, then a third, and so on. {show stats}{click Run 1000} Let's interview a thousand random orders. {await} The blue bars fill the outlines.

{focus off}{speed 2}{click Add up}{show s5stack}{focus stackarea} Now linearity adds them up. One, plus a half, plus a third, all the way to a tenth. {await}

{speed 1}{check #s5-stats ~ 2.929} That sum is called the harmonic number, and it grows like the natural log of n. So out of ten candidates, we expect to hire fewer than three. Out of a million, about fourteen.

{focus off}{card About ln n hires, not n. | When the candidates arrive in a random order.} That's the average-case cost of hiring. It's tiny, but only if the order really is random.

{goto rand-hire | Part 4 of 7 | What if the agency is against us?}{pause 0.6}

{scene} So what if it isn't? {focus s6in} Remember, if the agency sends the candidates from worst to best, we hire every one of them. And the agency gets paid for every hire.

{focus off}{label Shuffle the list yourself} So let's stop hoping the order is random, and make it random. Before the first interview, we shuffle the list ourselves.

{speed 1.5}{click Play}{focus s6out} Every candidate moves to a random place. Then we run hire assistant as usual, on the shuffled list. {await}

{speed 1}{show stats}{click Run 1000}{focus s6hist} Let's do that a thousand times. {await}

{check #s6-stats ~ plain hires10} The plain algorithm hires ten times on this list, every single time. The shuffled one averages under three.

{focus off}{label Any input}{click A3}{pause 0.2}{click Run 1000} And it doesn't matter which list we're given. {focus s6hist} Here's a different one, and the average hardly moves. {await}

{label Randomized algorithms}{focus off} An algorithm like this is called randomized, because what it does depends on its input, and on random numbers. Now no input is bad. Even your worst enemy can't hand you a slow list, because the shuffle throws the order away.

The words change a little, too. When we average over the inputs, that's the average-case cost. When we average over the algorithm's own random choices, on any input, that's the expected cost.

{label In Rust}{hide stats}{split}{show panel}{rust}{click A1}{pause 0.3}

Now let's look at the shuffle in Rust. {label}{focus rs:25} This shuffle is generic. The T means it works on a slice of any type, so the same function could shuffle names, or cards, or numbers.

{click Step}{focus rs:47} Here, it shuffles a copy of the ranks. {focus stack} As in chapter two, it borrows that copy mutably, so your list never changes.

{focus rs:25} But look at its second argument. The random-number generator is borrowed with ampersand mut too, {focus rs:6} because every roll changes it.

{focus rs:3} The whole generator is one number, and each call scrambles it into the next. That's a pseudorandom generator. It only looks random, and if you start from the same seed, you get the same rolls.

{click Step x2}{focus off}{speed 4}{click Play} Let's finish the interviews, on the shuffled copy. {await}

{speed 1}{focus heap} When the function returns, the copy is freed, and input is untouched. {focus off} And because the seed is fixed, this program prints the same answer every time you run it. That's exactly what you want when you're testing randomized code.

{goto permute | Part 5 of 7 | How do you shuffle fairly?}{hide s7inv}{pause 0.6}

{scene} We keep saying, shuffle the list. But a shuffle is an algorithm too, and it's easy to get wrong. A fair shuffle has to make every order equally likely.

{label Randomly permute}{focus s7cells} Here's the book's version, on three letters. For each position, we pick a random element from the ones that aren't placed yet, and swap it in.

{click Play} The first letter can come from all three. The second comes from the last two, and the last one has no choice at all. {await}

{focus s7choices} That's three factorial sequences of choices. That makes six, and each one ends in a different order. {focus off}

{show stats}{speed 2}{click Run 6000}{focus s7hist} Let's shuffle six thousand times. {await}

{speed 1} Every order comes out about one time in six. That's a uniform random permutation.

{focus off}{label Permute with all}{click PERMUTE-WITH-ALL}{pause 0.2} Now let's make one tiny change. Instead of picking from the elements that are left, we pick from the whole array, every time. That sounds even more random, right?

{speed 2}{click Run 6000}{focus s7hist} But now three of the orders come out more often than the others. {await}

{speed 1}{check .is-full .caption ~ 5/27} So why? {focus s7choices} Now every step has three choices, so there are twenty-seven sequences. And twenty-seven can't be split evenly between six orders.

{focus off}{card A fair shuffle makes n! equally likely choices. | One for every possible order.} So a fair shuffle makes exactly n factorial choices, one for every order. With any other count, some orders have to win.

{goto birthday | Part 6 of 7 | When do random things collide?}{hide bnames}{pause 0.6}

{scene}{slider 0 23} Now let's go back to the birthdays. Here are twenty-three people. {focus calendar} With three hundred sixty-five days, it looks like plenty of room.

{focus off} But a match doesn't have to involve you. Any two people will do. And twenty-three people make two hundred fifty-three pairs.

{label Indicators again} So let's give each pair an indicator, that's one if they share a birthday. Each pair matches with a chance of one in three hundred sixty-five. And by linearity, the expected number of matches is the number of pairs, divided by the number of days.

{show bplot}{focus plotarea} This blue curve is the exact chance of a shared birthday. It crosses one half at twenty-three people. The lilac curve is the expected number of matching pairs, and it reaches one at twenty-eight. {focus off}

{label On Mars}{click Mars · 669}{pause 0.2} On Mars, a year has six hundred sixty-nine days, almost twice as many. {focus plotarea} But it only takes thirty-one people. {focus off}

The number of people grows like the square root of the number of days. That's why random things collide much sooner than you'd expect, and it's exactly what happens to keys in a hash table.

{goto balls-bins}{pause 0.3}

{label Balls and bins}{focus bins} Here's the opposite question. We toss balls into ten bins, at random. How many tosses until every bin has a ball?

{focus off}{speed 2.5}{click Play} The first few tosses almost always land in an empty bin. But as the bins fill up, more and more tosses miss. {await}

{speed 1}{focus s9chart} Each bar is how long we waited for the next empty bin, and the dashed outlines are what we expect. When a single bin is left, only one toss in ten finds it. So the last outline is the tallest.

{show stats}{click 1000 runs}{check #s9-stats ~ expected b·H(b)29.29} Over a thousand runs, it takes about twenty-nine tosses to fill them all. That's ten, times the same harmonic number we saw with hiring. It's called the coupon collector's problem. {focus off}

{goto online-hiring | Part 7 of 7 | What if you can only choose once?}{hide s11chart}{pause 0.6}

{scene} Here's one last version of the hiring problem. This time, you hire exactly once. After each interview, you have to offer the job on the spot, or turn the candidate away for good.

So how do you give yourself the best chance of hiring the very best one? {focus firstk} The book's strategy is to interview the first few candidates, and reject them all, however good they are. They just set the bar. {focus off}

{speed 1.5}{click Play} Then we hire the first candidate who beats all of them. Here, we reject the first seven, out of twenty. {await}

{speed 1}{check #s11-stats ~ best ✓}{focus applicants} This time, the candidate we hired was the best of all. {focus off} So how many should we reject? Too few, and the bar is too low. Too many, and the best one was probably among the ones we turned away.

{show s11chart}{click Every k}{focus chartarea} Let's try every choice, a thousand times each. {await} The chance peaks when we reject about the first thirty-seven percent. Then we hire the very best candidate more than a third of the time, however many there are.

{focus off}{card Reject the first n/e, then take the next best. | You get the very best candidate about 37% of the time.} This is called the secretary problem, and that thirty-seven percent is one over e. You'll see that number again, whenever you have to decide before you've seen everything.

{goto birthday | Recap | What you learned}{pause 0.6}

{scene}{card Hiring cost depends on the order. | In the worst case, you hire every candidate.} Let's recap. The cost of hiring depends on the order the candidates arrive in, and in the worst case, you hire all of them.

{card Average-case cost assumes how inputs are spread. | It's only as good as that assumption.} Probabilistic analysis averages over every input. But it's only as good as its assumption about the inputs.

{card Indicators turn events into zeros and ones. | Linearity adds them up: about ln n hires.} Indicator random variables turn events into numbers, and linearity of expectation adds them up, even when they depend on each other.

{card Randomize, and no input is bad. | In Rust: the same seed replays the same rolls.} A randomized algorithm makes every input equally good, and its expected cost holds for any list you're handed.

{card A fair shuffle makes n! equally likely choices.} A fair shuffle has exactly one sequence of choices for every order.

{card Random things collide sooner than you think. | 23 people for even odds. About b ln b tosses to fill b bins.} Random collisions come much sooner than you'd expect, and filling every bin takes much longer.

{card Reject the first n/e, then take the next best.} And when you only get one choice, look at the first thirty-seven percent, and then leap.

{card Try every machine yourself. | The link is in the description.} All of these machines are interactive, and the link is in the description. Start with the birthday room, and guess before you press play. In the next video, we'll build a heap, and use it to sort any input fast, with no luck involved. {pause 0.4}
