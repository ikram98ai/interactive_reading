---
title: Proving and Measuring Algorithms
kicker: Introduction to Algorithms · Chapter 2
page: books/clrs/ch02.html
scene: growth
seed: 1
targets:
  formula: svg:16,8,240,36
  legend: svg:462,14,180,30
  row100: svg:20,140,624,30
  row10k: svg:20,206,624,30
  row1m: svg:20,272,624,30
  share: svg:448,48,76,256
  lines: svg:514,40,72,64
  plot3: svg:40,14,480,306
  n0a: svg:188,40,72,252
  n0b: svg:254,40,84,252
  inv: svg:18,6,510,28
  cells: svg:54,38,398,60
  hand: svg:54,38,398,108
  half1: svg:18,144,312,46
  half2: svg:330,144,312,46
  props: svg:18,236,624,66
  init: svg:18,236,208,66
  maint: svg:226,236,208,66
  term: svg:434,236,208,66
  s2halves: css:#s2-svg [data-part=halves]
  s2checks: css:#s2-svg [data-part=checks]
  s2props: css:#s2-svg [data-part=properties]
  table: svg:16,90,628,224
  costs: svg:226,90,50,224
  counted: svg:372,90,272,224
  line5: svg:16,211,628,27
  tis: svg:18,8,296,28
  total: svg:18,314,446,28
  s5total: css:#s5-svg [data-part=total]
  bars: svg:18,12,420,92
  readout: svg:450,38,90,56
  plot: svg:30,112,420,228
  worst: svg:446,118,124,44
  average: svg:446,192,124,44
  best: svg:446,265,124,44
  method: svg:18,8,540,34
  piles: svg:94,52,494,62
  leftrun: svg:96,52,234,62
  rightrun: svg:330,52,234,62
  mresult: svg:128,262,404,40
  s8method: css:#s8-svg [data-part=method]
  top: svg:50,40,560,52
  calls: svg:50,40,560,252
  root: svg:200,32,84,40
  level1: svg:8,80,470,36
  leafrow: svg:8,218,470,36
  sums: svg:480,30,140,230
  treetotal: svg:64,256,532,42
  s11sums: css:#s11-svg [data-part=sums]
---

{scene}{focus formula} Here's the running time of a program, written as a formula with three parts. {focus legend} There's a tiny n squared part, a much bigger part that grows with n, and a constant. {focus off} So when the input gets big, which part matters most?

{speed 3}{click Play} Let's work it out for bigger and bigger inputs, starting from a single item, and going all the way up to a million. {await}

{speed 1}{check #s7-svg ~ 1.0%}{focus row100} At a hundred items, the n squared part is just one percent of the total. {check #s7-svg ~ 50.0%}{focus row10k} At ten thousand, it's half. {check #s7-svg ~ 99.0%}{focus row1m} And at a million, it's almost all of it. {focus off} For big inputs, only the fastest-growing part matters, and that idea is how we'll compare algorithms from now on.

{title} This is chapter two of Introduction to Algorithms. By the end of this video, you'll know how to prove that an algorithm works, and how to measure how fast it is. Here's what we'll cover.

{item Proving an algorithm correct} We'll start by proving that insertion sort is correct, {item Counting the steps} and then count the steps it takes. {item Best and worst cases} We'll see why inputs of the same size can take very different times, {item Order of growth} and what really matters as inputs grow. {item Divide and conquer} Then we'll learn a new way to design algorithms, {item Merge sort} use it to build merge sort, {item How fast merge sort is} and finally, work out how fast it is.

Along the way, we'll write the algorithms in Rust, and see how Rust lets many readers share your data, and how it splits one array between two functions safely. You don't need any math to follow along. So let's get started.

{goto invariant | Part 1 of 7 | How do you know it works?}{hide s2halves+s2checks+s2props}{pause 0.6}

{scene} In the last video, we sorted six numbers with insertion sort, and it worked. But passing one test doesn't prove anything. So how do we know it works on every input, when we can't try them all?

{focus inv}{label Loop invariant} The book's answer is called a loop invariant. It's a sentence that's true every time the loop is about to start another lap.

{focus hand} For insertion sort, it says this. The cards to the left of the one we're placing are the cards that started there, but now in sorted order.

{focus off}{show s2halves} So before every lap, we check two things. {focus half1} Are those cards sorted? {focus half2} And are they the same cards that started there?

{focus off}{click Next check}{show s2checks} Before the first lap, there's just a single card on the left. A single card is always sorted, and it's the card that started there. So the invariant is true at the start.

{click Next check} Now the loop places the next card, and we check again. The hand is still sorted, and it still holds the right cards.

{speed 2.5}{click Play} Let's run the rest of the loop. Each lap lifts a card, slides the bigger ones to the right, and drops the card into the gap. And before every lap, both checks pass. {await}

{speed 1}{check .is-full .caption ~ Termination}{show s2props}{focus props} So what did we just prove? The book splits it into three properties. {focus init} Initialization. The invariant is true before the first lap. {focus maint} Maintenance. If it's true before a lap, it's still true before the next one. {focus term} And termination. The loop stops, and when it does, the invariant tells us something useful.

{focus off} Here, the loop stops when every card is on the left. So the invariant now covers the whole array, and it says the whole array is sorted.

If that sounds like a proof by induction, that's because it is. Initialization is the base case, and maintenance is the inductive step. The difference is that this induction stops when the loop does.

{label A planted bug}{click to n − 1}{pause 0.2} Now here's why we need all three. This version has a bug. Its loop stops a lap early. {speed 3}{click Play} Let's run it, and watch the checks. Each lap keeps the promise, just like before. {await}

{speed 1}{check .is-full .caption ~ never inserted}{focus cells} Every check passed, but the last card was never placed. {focus term} So termination fails. When the loop stops, the invariant only covers part of the array.

{label Another bug}{click no line 8}{pause 0.2} This version is missing the last line, the one that drops the card into the gap. {speed 3}{click Play} So each card gets lifted, the bigger ones slide over, and the card itself is never put back. {await}

{speed 1}{check .is-full .caption ~ indeed wrong}{focus half2} This time the hand stays sorted, but cards go missing. {focus maint} The very first lap broke the invariant, so maintenance fails.

{focus off}{label}{card A loop invariant is a promise kept on every lap. | It starts true, stays true, and proves the answer at the end.} So a loop invariant is a promise the loop keeps on every lap. Prove that it starts true, that it stays true, and that it gives you the answer when the loop ends.

{scene}{label In Rust}{split}{show panel}{rust}{click Correct}{pause 0.3}

Now let's look at the Rust version, which checks the invariant while it runs. {focus rs:3} This function, check, takes the array with an ampersand, but no mut. That's a shared borrow. Check can read the numbers, but it can't change them.

{focus rs:4} And this is a slice, a view of the first i items. Nothing is copied. It just points into the same array.

{focus rs:20} Here, insertion sort lends its array to check, and a copy of the input too. That's two shared borrows at once, and that's fine. Any number of readers can share data, as long as nobody writes to it.

{focus off} A mutable borrow is the opposite. While it exists, nothing else can read or write that data. {speed 3}{click Play} Rust checks both rules when it compiles your code, so a function that only reads can never change your data behind your back. {await}

{speed 1} So that's a shared borrow. You can have many readers at once, or a single writer, but never both.

{goto analysis | Part 2 of 7 | How long does it take?}{hide s5total}{pause 0.6}

{scene} So insertion sort is correct. But how long does it take? You could time it with a stopwatch. But that only tells you about one run, on your computer, with your compiler, on this input.

{label The RAM model} To predict the time for any input, the book counts steps instead, on a model computer called the random-access machine, or RAM. It runs one instruction at a time, and each instruction takes a constant amount of time.

{label Cost × times}{focus table} Here's insertion sort again, one line per row. {focus costs} Each line has a cost, the time it takes to run once. To keep things simple, every cost here is one, and the comment costs nothing.

{focus counted} Then we count how many times each line runs. {click Step} The for test runs, {click Step} we lift the key, {click Step x2} we set j, {click Step}{focus line5} and then the while test runs.

This while test is the interesting one. How many times it runs depends on the numbers. The book calls that count t sub i, for each card i.

{focus off}{speed 4}{click Play} Let's count the rest. Most lines run once for each card. But the while test runs once for every comparison, so it runs more often for some cards than for others. {await}

{speed 1}{check .is-full .statrow ~ T(n)53}{show s5total}{focus total} Now multiply each line's cost by its count, and add them all up. That's the running time, called T of n. With these costs, it's fifty-three steps.

{focus tis} Up here are the t sub i values for each card. They depend on how far each card had to travel. So the running time depends on the input, not just on its size. {focus off} Which raises a question. How different can two inputs of the same size be?

{goto cases | Part 3 of 7 | Why can the same size take different times?}{pause 0.6}

{scene}{focus bars} Here are eight numbers to sort, drawn as bars. {focus plot} And this plot will show the running time for each input size. {focus off}

{label Best case} Let's start with a list that's already sorted. {speed 2}{click Run} Each card gets one look at its neighbor, and stays where it is. {await}

{speed 1}{check .is-full .statrow ~ T(n) this run36}{focus readout} That's thirty-six steps, the fewest possible for eight numbers.

{focus off}{speed 3}{click All sizes} Now let's do the same for every size, from two up to sixteen numbers. Each run drops a dot on the plot. {await}

{speed 1}{check .is-full .caption ~ straight line}{focus best} The dots fall on a straight line. Double the input, and the time roughly doubles. This is the best case, and it grows linearly.

{focus off}{label Worst case}{click Reversed}{pause 0.2} Now let's reverse the list. {speed 3}{click All sizes} This time, every card has to travel all the way to the front. So each new card is compared with every card before it. {await}

{speed 1}{check .is-full .caption ~ parabola}{focus worst} These dots climb a curve, a parabola. Double the input, and the time goes up about four times. That's the worst case, and it's quadratic.

{focus off}{label Average case}{click Random}{pause 0.2} And what about a random list? {speed 3}{click All sizes} On average, a card is smaller than about half of the cards before it, so it travels about halfway. {await}

{speed 1}{check .is-full .caption ~ quadratic too}{focus average} So the dots scatter around a curve that's about half the worst case. But it's still a parabola. The average case is quadratic too.

{focus off}{label} For the rest of the book, we'll mostly look at the worst case. That's the longest running time for any input of a given size, and there are three good reasons for it.

{focus worst} First, it's a guarantee. No input of that size will ever take longer. Second, the worst case happens a lot. For example, searching a database for a record that isn't there. {focus average} And third, the average case is often about as bad as the worst case anyway. {focus off}

{card Analyze the worst case. | It's a guarantee: no input of that size takes longer.} So when you analyze an algorithm, start with its worst case. It's the number you can count on.

{goto growth | Part 4 of 7 | What matters as the input grows?}{pause 0.6}

{scene} The worst case of insertion sort comes out as a formula with the same shape as this one. A constant times n squared, plus a constant times n, plus another constant. {focus row1m} And we've already seen that for large inputs, the n squared term takes over. The rest is a rounding error.

{focus off}{label Order of growth} So the book keeps only that leading term, and drops the lower-order terms. Then it drops the constant in front of it, too. What's left is n squared. That's called the order of growth, or the rate of growth.

{focus share} We write it with the Greek letter theta. Insertion sort's worst case is theta of n squared, and its best case is theta of n. For now, read theta as roughly proportional to, when n is large.

{focus off} This gives us a way to rank algorithms. A lower order of growth is more efficient. But there's a catch, and it's the constants.

{label Constants don't decide}{click Θ(n²) vs Θ(n³)}{pause 0.3} Here are two running times. {focus lines} One is a hundred times n squared. The other is n cubed, with no constant at all. {focus plot3} Both axes use a log scale, so each running time is a straight line, and its slope is its order of growth.

{focus off}{click Find n₀} Let's find the point where the steeper line catches up, and passes the other one. {await}

{check .is-full .statrow ~ 101}{focus n0a} Below a hundred and one, the n cubed algorithm is actually faster. From there on, the n squared algorithm wins, and it keeps winning.

{focus off}{slider 0 3}{pause 0.3} Now let's make the n squared algorithm ten times slower, {speed 4}{click Find n₀} and look for the crossing again. Its line moves up, so the steeper line needs longer to catch it. {await}

{speed 1}{check .is-full .statrow ~ 1,001}{focus n0b} It moves to just past a thousand. But it still comes, because the steeper line always catches up in the end. {focus off}

{card A lower order of growth wins. | Past some input size, whatever the constants.} So for large enough inputs, the lower order of growth always wins, whatever the constants are. Insertion sort is theta of n squared. Next, let's see if we can beat that.

{goto merge | Part 5 of 7 | How do you divide and conquer?}{hide s8method}{pause 0.6}

{scene} Insertion sort is incremental. It grows a sorted hand, one card at a time. Merge sort takes a different approach.

{show s8method}{label Divide and conquer}{focus method} It's called divide and conquer, and it has three steps. Divide the problem into smaller problems of the same kind. Conquer each one recursively, which means the algorithm calls itself. And combine their answers into one.

When a problem is small enough, we just solve it directly. That's called the base case.

{focus off}{label Merge} The hard part of merge sort is the combine step, and it's called merge. {focus piles} Here are two piles of cards. Each pile is already sorted, {focus leftrun} this one, {focus rightrun} and this one. {focus off}

{speed 2}{click Step x11} First, we copy each pile into its own array, called L and R. That frees up the original spots for the merged result. {await}

{speed 1.2}{click Play} Now we compare the two top cards, and the smaller one goes back into the array. That uncovers a new top card, so we compare again. When one pile runs out, the rest of the other pile goes straight in. {await}

{speed 1}{check .is-full .statrow ~ basic steps6}{check .is-full .statrow ~ copied back8}{focus mresult} Every card was copied back exactly once. So merging n cards takes time proportional to n. That's theta of n.

{label In Rust}{focus off}{split}{show panel}{rust}{click Reset}{pause 0.3}

Let's see how Rust handles those two new arrays. {click Step x3}{focus rs:7} This line takes a slice of the array, the left pile. A slice is just a view into part of an array. Then to vec copies that slice into a brand new vector.

{focus heap} So left gets its own buffer on the heap, {speed 2}{click Step x8} and so does right. Merge owns both of them. {focus off}

{speed 3}{click Play} Now the merge runs, and writes the cards back into the original array, through the mutable borrow it was given. {await}

{speed 1}{focus rs:31} When merge returns, left and right go out of scope. {focus heap} So Rust frees both buffers automatically. {focus off} A slice lets you look at part of an array without copying it. And when you do make a copy, you own it, and it's freed when you're done.

{goto mergesort | Part 6 of 7 | How does merge sort work?}{pause 0.6}

{scene}{focus top} Here are eight numbers to sort. Merge sort on the whole array does three things. It splits the array in the middle. It sorts each half, by calling itself. And it merges the sorted halves.

{focus calls} Each box here is a call of merge sort. The dashed boxes are calls that haven't happened yet. {focus off}

{click Step x3} The first call splits the array, and calls itself on the left half. {click Step x3} That call splits its half, and calls itself again. {click Step x4} And again, until a call gets just one number.

{check .is-full .caption ~ bottoms out}{label Base case} A single number is already sorted, so this call returns right away. That's the base case, where the recursion bottoms out.

{label}{speed 2}{click Play} From here, it's the same pattern all the way through. Each call waits for its halves to come back sorted, and then merges them. The sorted runs keep doubling in size, until the whole array is a single sorted run. {await}

{speed 1}{check .is-full .caption ~ is sorted}{focus calls} So merge sort splits all the way down to single numbers, and then merges all the way back up. {focus off}

{label In Rust}{split}{show panel}{rust}{click Reset}{pause 0.3}

In Rust, merge sort works on slices, and it has a problem to solve. Each call needs to change its half of the array. That means two mutable borrows of the same array, at the same time, which is exactly what Rust forbids.

{click Step x3}{focus rs:9} This line solves it. Split at mut cuts one mutable borrow into two, left and right. {focus stack} Both live in this call's frame on the stack, {focus heap} and both point into the same buffer on the heap. But they cover different halves, so they can never overlap.

{focus rs:10-11} So the borrow checker lets both be alive at once, and each recursive call gets its own half. {focus off}{label}{speed 2.5}{click Play} Watch the stack. Every call adds a frame, and every return removes one. It only ever holds the chain of calls from the first one down to the current one. {await}

{speed 1}{focus rs:12} When both halves return, their borrows end, so the function can use the whole array again, and merge it. {focus off} That's splitting a borrow. Rust allows two mutable borrows, as long as they can never touch the same data.

{goto mergetree | Part 7 of 7 | How fast is merge sort?}{hide s11sums}{pause 0.6}

{card T(n) = 2T(n/2) + cn | A recurrence: a running time written in terms of itself.} So how fast is merge sort? Its running time on n numbers is the time for its two halves, plus the time to merge them. An equation like that, which describes a running time in terms of itself, is called a recurrence.

{scene}{focus root} Let's draw it as a tree, for sixteen numbers. {click Step} The first call costs c times n to split and merge. Here, that's forty-eight. And it leaves two problems, each half the size.

{focus level1}{click Step} Each of those costs half as much, and splits again. {focus off}{click Step x2} We keep going, until every problem has just one number. {focus leafrow} Those are the leaves, and each one costs a constant. {focus off}

{show s11sums}{focus sums} Now let's add up each level. {click Step} The top level costs forty-eight. {click Step} The next level has twice as many nodes, at half the cost each. So it costs forty-eight too. {click Step x2} And so does every level, all the way down. {click Step}{focus leafrow} Only the leaves are different.

{click Step}{focus treetotal} So the total is about the cost of a level, times the number of levels. And how many levels are there? Each level doubles the number of nodes, so n leaves need log n levels, plus one more for the leaves.

{check .is-full .statrow ~ lg n + 1 = 5}{focus off} So merge sort takes about c times n log n. That's theta of n log n.

{slider 0 5}{pause 0.4}{speed 2}{click Play} Let's double the input, to thirty-two numbers. We get one more level, and every level now costs twice as much. But the shape is the same. Every level costs the same, and there are only log n of them, plus the leaves. {await}

{speed 1}{check .is-full .statrow ~ c₂n = 96}{focus sums} Every level costs ninety-six now, and there's just one more of them. {focus off}

{label} Compared with insertion sort's theta of n squared, merge sort trades a factor of n for a factor of log n. And log n grows much more slowly than n. With a million numbers, n is a million. But log n is only about twenty.

{card Merge sort is Θ(n lg n). | Insertion sort is Θ(n²). For large inputs, merge sort wins.} That's why merge sort won the race in the last video. For large enough inputs, it always will. On tiny inputs, insertion sort's smaller constants can still win, so many real sorting libraries switch to insertion sort for small pieces.

{goto growth | Recap | What you learned}{pause 0.6}

{scene}{card A loop invariant proves a loop correct. | It starts true, stays true, and gives the answer at the end.} Let's recap. A loop invariant proves that a loop is correct. It's true at the start, it stays true after every lap, and when the loop ends, it gives you the answer.

{card Count steps, not seconds. | Each line's cost, times how often it runs.} To measure an algorithm, count its steps instead of timing it. Add up each line's cost, times how many times it runs.

{card Analyze the worst case. | It's a guarantee for every input of that size.} Inputs of the same size can take very different times. So we analyze the worst case, because it's a guarantee.

{card Keep only the order of growth. | For large inputs, the leading term decides.} For large inputs, only the leading term matters. We drop the rest, and write what's left with theta.

{card Divide, conquer, combine. | Merge combines two sorted piles in linear time.} Divide and conquer splits a problem into smaller ones of the same kind, solves them recursively, and combines the answers.

{card Merge sort splits down, and merges back up. | In Rust, shared borrows read, and split_at_mut gives each half its own.} Merge sort splits the array down to single numbers, and merges them back up. In Rust, many readers can share data, and split at mut gives each half its own mutable borrow.

{card Merge sort is Θ(n lg n). | Every level of its tree costs the same.} And merge sort runs in theta of n log n time, because every level of its tree costs the same, and there are only log n levels.

{card Try every machine yourself. | The link is in the description.} All of these machines are interactive, and the link is in the description. Try planting a bug in insertion sort, and see which check catches it. In the next video, we'll make theta precise, and meet its cousins, big O and big omega. {pause 0.4}
