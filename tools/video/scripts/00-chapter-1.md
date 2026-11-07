---
title: What Algorithms Are, and Why They Matter
kicker: Introduction to Algorithms · Chapter 1
page: books/algo/ch01.html
scene: race
seed: 1
targets:
  size: svg:8,6,450,28
  laneA: svg:10,36,180,78
  laneB: svg:10,124,180,78
  barA: svg:196,48,454,44
  barB: svg:196,136,454,44
  axis: svg:190,204,464,38
  verdict: svg:150,248,360,50
  timeA: stat:A's time
  timeB: stat:B's time
  cross: stat:A wins while n
  rateA: slider:1
  growth: code:1-2
  input: svg:22,14,400,30
  cells: svg:96,106,468,72
  all: svg:22,40,616,150
  recipe: css:.is-full .cp-body ol
  stats: css:.is-full .statrow > *
  shape: css:.is-full #s1-seg
  tinput: svg:22,12,420,28
  tcells: svg:105,44,448,62
  budget: svg:20,150,620,40
  checks: svg:20,192,620,46
  tverdict: svg:20,241,620,46
  procs: css:.is-full #s2-seg
  bug: code:3
  data: btn:No repeated values
  roads: svg:14,20,480,262
  tourmap: svg:40,40,385,235
  tours: stat:tours
  ratio: stat:ratio
  array: svg:18,14,560,86
  list: svg:18,146,560,86
  ops: css:.is-full #s14-seg
---
{scene}{focus laneA} Here are two computers. This computer is a thousand times faster than {focus laneB} that one. {focus size} They both have to sort ten million numbers. {focus off} Let's race them.

{click Race}{focus axis}{await}

{check #s21-stats ~ 19.4 minutes}{focus timeB} The slower computer finishes in under twenty minutes. {check #s21-stats ~ 5.6 hours}{focus timeA} The faster one takes more than five and a half hours.

{focus off} By the end of this video, you'll know why that happens. You'll also learn what an algorithm really is, what makes one correct, and why some problems have no known fast solution.

All of this comes from chapter one of Introduction to Algorithms, the classic textbook. You don't need any math to follow along. So let's get started.

{goto algorithms | Part 1 of 6 | What is an algorithm?}{pause 0.6}

{scene}{focus input} An algorithm is a well-defined procedure. It takes some input, and it produces some output, in a finite amount of time.

Here's an example. We have a list of numbers, and we want to put them in order. That's called the sorting problem. And this specific list is called an instance of the problem.

{focus recipe} On the right, we have a procedure that solves it. It's called insertion sort, and it works the way you sort playing cards in your hand.

{focus all} The first card is already sorted, because there's nothing to compare it with. So we start with the second card. {click Step}{pause 0.6}

{click Step} We lift it out. {pause 0.5}

{click Step}{pause 0.3}{click Step} We compare it with the card on its left. That card isn't bigger, so our card is already in the right place. {pause 0.3}

{click Step} So we put it back. That's one round. Lift a card, find its spot, and put it down.

{focus off} Now the computer repeats that for every card. {speed 1.4}{click Play}{pause 0.5} When a card is too big, it slides one place to the right, and that opens up a gap. {await}

{speed 1}{check .is-full .caption ~ permutation}{focus cells} Now the numbers are in order, and the procedure has stopped. That's what makes it an algorithm. It's precise enough for a machine to follow, and it always finishes.

{focus stats} These counters show how much work it did. {focus shape} Now let's run it on the same numbers, already sorted. {click Already sorted}{pause 0.2} {focus off}{speed 2}{click Play}{await}

{check .is-full .statrow ~ shifts0}{focus stats} One quick look at each card, and nothing moves. {focus shape} Now let's try them backwards. {click Reversed}{pause 0.2} {focus off}{speed 3.5}{click Play}{await}

{speed 1}{check .is-full .statrow ~ comparisons15}{check .is-full .statrow ~ shifts14}{focus stats} Same algorithm, same numbers, and three times as many comparisons. So the work an algorithm does depends on its input. Keep that in mind, because we'll come back to it.

{goto correct | Part 2 of 6 | What does correct mean?}{pause 0.6}

{scene}{focus tinput} So how do you know an algorithm works? The book has a strict definition. An algorithm is correct if, for every possible input, it stops, and it gives the right answer. Not most of the time. Every time.

{focus checks} This machine checks exactly that. Did the procedure stop? Are all the numbers still there? And are they in order?

{focus budget} We also give each procedure a step budget. From the outside, a slow program and a stuck program look the same, so at some point we have to stop waiting.

{focus procs} We have three procedures to test. {focus off} The first one is bubble sort. {click Run}{await}

{check .is-full .caption ~ BUBBLESORT is correct}{focus checks+tverdict} It stopped, nothing's missing, and everything's in order. That's what we want.

{focus procs} The second one is the same code, without the outer loop. {click Wrong answer}{pause 0.2} {focus off}{click Run}{await}

{check .is-full .caption ~ Halting is not enough}{focus tverdict} It stopped, but the answer is wrong. There's no crash and no error message. That's the first way an algorithm can fail.

{focus procs} Now the third one. {click Never halts}{pause 0.2}{focus bug} It has a one-character bug on this line. It says less than, where it should say less than or equal to. {pause 0.3}

{focus off}{click Run}{pause 1.2}{focus tcells} Look at the two equal numbers in the middle. They keep trading places. {focus budget} And there goes the budget. {await}

{check .is-full .caption ~ never halts}{focus tverdict} It never stops. That's the second way to fail.

{focus data} Now let's run the same buggy code on a list with no repeated numbers. {click No repeated values}{pause 0.2} {focus off}{speed 2}{click Run}{await}

{speed 1}{check .is-full .caption ~ correct}{focus checks+tverdict} It passes. If this was your only test, you'd ship this bug.

{focus off}{card One passing test doesn't prove your code is correct. | Correct means every input, every time.} So a passing test doesn't prove your code is correct. When you test, always include the awkward cases. Duplicates, empty lists, and input that's already sorted.

{goto shortest | Part 3 of 6 | Why the obvious solution is too slow}{pause 0.6}

{scene} Sorting is just one problem. Algorithms also find routes, power search engines, secure your payments, and compress your files.

What most of these problems have in common is this. There's a huge number of possible answers, and almost all of them are wrong.

{focus roads} Take navigation. We want the shortest drive from A to F. The obvious solution is to list every possible route, and keep the shortest one. {focus off}{click Play}{await}

{check .is-full .statrow ~ routes found13}{check .is-full .caption ~ 1,262,816}{focus stats} That's thirteen routes, for just six crossings. On a small grid of city streets, that number is already over a million. So this approach doesn't scale.

{focus off} Here's a better way. {click Dijkstra}{pause 0.2} This is Dijkstra's algorithm, and it never lists any routes. {speed 1.5}{click Play} It always picks the closest crossing it hasn't finished with, then updates the distances to its neighbors. {await}

{speed 1}{check .is-full .caption ~ F = 13}{focus roads} It found the same route, and it didn't have to list a single one. That's what a good algorithm does. It finds the answer without checking every possibility.

{goto hard | Part 4 of 6 | When no fast algorithm is known}{pause 0.6}

{scene} But that doesn't always work. Here's a problem that looks very similar.

{focus tourmap} A delivery van leaves the depot, visits every stop, and comes back. We want the shortest round trip. This is called the traveling salesperson problem.

{check .is-full .statrow ~ 360}{focus tours} Here, there are three hundred and sixty possible tours. {focus off}{speed 1.5}{click Play} Let's check them all. {await}

{speed 1}{focus tourmap} That works for a few stops. But every new stop multiplies the number of tours, so with twenty stops, this is out of the question.

{focus off} Nobody has ever found a fast algorithm for this problem. And nobody has proved that one can't exist. Problems like this are called NP-complete.

They show up in real work, so you should learn to recognize them. If you have one, don't spend your time looking for a perfect solution. Use an approximation algorithm, which is fast and gets close to the best answer.

{click Approximate}{pause 0.2}{speed 1.5}{click Play}{await}

{speed 1}{check .is-full .statrow ~ 1.36}{focus ratio} This tour is about a third longer than the best one. But it took a handful of steps, instead of hundreds of tours. In the real world, that's often a good deal.

{goto ds | Part 5 of 6 | There is no best data structure}{pause 0.6}

{scene} Algorithms work on data, so the way you store that data matters. A data structure is a way to store and organize data, so it's easy to access and change.

{focus array} This is an array. The items sit side by side in memory. {focus list} This is a linked list. Each item can live anywhere, and it points to the next one.

{focus ops} Let's add a number to the front. {click Insert 25 at front}{pause 0.2} {focus off}{speed 0.4}{click Play}{pause 0.4}{focus array} The array has no gap, so every item has to shift one place to the right. {focus list} The list just creates a new node, and points it at the old first item. {await}

{check .is-full .statrow ~ array steps5}{check .is-full .statrow ~ list steps2}{focus stats} The list wins. Now let's read the third item.

{focus ops}{click Read 3rd item}{pause 0.2} {focus off}{speed 0.4}{click Play}{pause 0.4}{focus array} The array calculates the position, and jumps straight there. {focus list} The list has to start at the front, and follow the pointers one by one. {await}

{check .is-full .statrow ~ array steps1}{check .is-full .statrow ~ list steps3}{focus stats} This time, the array wins.

{focus off}{card No data structure is best at everything. | Choose based on what your program does most.} So no single data structure is best at everything. You choose one based on what your program does most.

{goto race | Part 6 of 6 | Why better algorithms beat better hardware}{pause 0.6}

{scene} Now let's go back to our race. {focus laneA} Computer A has every advantage. It runs ten billion instructions a second, and its code was written by the best programmer around, in machine language.

{focus laneB} Computer B runs ten million instructions a second. Its code was written by an average programmer, using an inefficient compiler.

{focus laneA+laneB} B has only one advantage, and that's its algorithm. A runs insertion sort, the one you saw earlier. B runs a different algorithm, called merge sort.

{check #s21-stats ~ 19.4 minutes}{check #s21-stats ~ 5.6 hours}{focus verdict} And B finished more than seventeen times sooner. So why?

{focus growth} It comes down to how the work grows. With insertion sort, the work grows with the square of the input. Double the list, and you get four times the work. With merge sort, double the list, and you get just over twice the work.

{focus off} A faster computer divides your running time by a fixed amount. A better algorithm changes how that time grows. So the bigger the input, the bigger the gap.

Let's see that in action. {click 100 million}{pause 0.3}

{click Race}{focus axis} This is ten times the numbers, on the same two computers. {await}

{check #s21-stats ~ 3.7 hours}{check #s21-stats ~ 23.1 days}{focus timeA+timeB} Computer A now needs more than three weeks. Computer B needs under four hours. And this isn't a made-up size. The book points out that more than a hundred million emails are sent every minute.

To be fair, computer A doesn't always lose. {check #s21-stats ~ 471,000}{focus cross} Below about half a million items, it wins, because on small inputs, raw speed matters more. That turning point is called the crossover point. Past it, computer A never catches up.

{focus off} So what if we just buy a faster computer? {click 10 million} Let's go back to ten million numbers, {focus rateA} and make computer A ten times faster. {slider 1 11}{pause 0.5}

{click Race}{focus axis}{await}

{check #s21-stats ~ 33.3 minutes}{focus timeA+timeB} Computer A still loses. That's ten times the hardware, and the better algorithm is still ahead.

{focus off}{card Algorithms are a technology. | System performance depends on them as much as on hardware.} That's why the book treats algorithms as a technology, just like hardware. The performance of your system depends on both.

{card Machine learning is algorithms too. | For well-understood problems, a designed algorithm usually does better.} What about machine learning? It doesn't replace any of this. Machine learning is itself a collection of algorithms. And for problems we understand well, an algorithm designed for the job usually does better.

{goto race | Recap | What you learned}{pause 0.6}

{scene}{card An algorithm turns input into output, in finite time.} Let's recap. An algorithm is a precise procedure that turns input into output, in a finite amount of time.

{card Correct means every input, every time.} It's correct only if it stops with the right answer, on every input.

{card Good algorithms don't check every possibility. | For some problems, no fast algorithm is known.} Good algorithms find the answer without checking every possibility. And for some problems, nobody knows a fast one.

{card No data structure is best at everything.} No single data structure is best at everything.

{card Better algorithms beat better hardware. | The bigger the input, the bigger the gap.} And as your input grows, a better algorithm beats better hardware.

{card Try the race yourself. | The link is in the description.} All of these machines are interactive, and the link is in the description. Start with the race, and see if you can find the point where computer A starts to lose. {pause 0.4}
