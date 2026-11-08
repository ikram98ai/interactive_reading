---
title: What Algorithms Are, and Why They Matter
kicker: Introduction to Algorithms · Chapter 1
page: books/clrs/ch01.html
scene: race
seed: 1
targets:
  size: svg:8,8,340,30
  laneA: svg:8,46,112,60
  laneB: svg:8,138,112,60
  barA: svg:130,48,520,56
  barB: svg:130,140,520,56
  growA: svg:130,106,260,22
  growB: svg:130,198,260,22
  verdict: svg:150,240,360,34
  cross: stat:A wins while n
  rateA: slider:1
  counters: css:.is-full .statrow > *
  s1input: css:#s1-svg [data-part=input]
  s1ptr: css:#s1-svg [data-part=pointers]
  s1lines: css:#s1-stats > :nth-child(3)
  cells: svg:96,114,468,76
  s1checks: svg:22,240,616,48
  tinput: svg:22,12,420,28
  tcells: svg:105,44,448,62
  budget: svg:20,150,620,40
  checks: svg:20,192,620,46
  tverdict: svg:20,241,620,46
  bug: code:3
  meter: svg:16,224,628,88
  roads: svg:14,20,480,262
  tourmap: svg:40,40,385,235
  tours: stat:tours
  ratio: stat:ratio
  array: svg:18,14,560,86
  list: svg:18,146,560,86
  chip: svg:20,40,300,250
  power: svg:320,40,320,230
---

{scene}{focus laneA} Here are two computers. This computer is a thousand times faster than {focus laneB} that computer. {focus size} We give them both the same job, to sort ten million numbers. {focus off} So which one finishes first?

{speed 2}{click Race}{focus barA+barB} Both computers start at the same moment. {await}

{speed 1}{check #s21-svg ~ 19.4 minutes}{focus barB} The slow computer finishes in under twenty minutes. {check #s21-svg ~ 5.6 hours}{focus barA} The fast one needs more than five and a half hours. {focus off} The slow computer wins, by a lot, and the reason is the algorithm it runs.

{title} This is chapter one of Introduction to Algorithms, the classic textbook. By the end of this video, you'll know exactly why that race went the way it did. Here's what we'll cover.

{item What an algorithm is} We'll start with what an algorithm actually is, {item What makes one correct} and what it means for one to be correct. {item Which problems algorithms solve} Then we'll look at the problems algorithms solve, {item When no fast algorithm is known} and the ones nobody knows how to solve fast. {item Why data structures matter} After that, data structures, {item New kinds of computers} new kinds of computers, {item Why algorithms beat hardware} and finally, we'll come back to this race.

Along the way, we'll write the algorithms in Rust, and see how Rust keeps track of who owns your data. You don't need any math to follow along. So let's get started.

{goto algorithms | Part 1 of 7 | What is an algorithm?}{hide s1input+s1ptr+s1lines}{pause 0.6}

{scene} Here's a list of numbers, and we want to put them in order. {label The sorting problem} This is called the sorting problem. And this specific list, with these six numbers, is called an instance of the problem.

An algorithm is a well-defined procedure for solving a problem like this. It takes some input, which is our list, and it produces some output, which is the same numbers in order. And it does that in a finite amount of time.

So how can we sort this list? {label Insertion sort} We're going to use an algorithm called insertion sort, because it works the way you sort playing cards in your hand.

We start with the first card. There's nothing to compare it with, so on its own, {click Step} it's already sorted. Now we {click Step} pick up the second card, and we compare it with {click Step x2} the card on its left. Thirty-one isn't bigger than forty-one, so our card is already in the right place, and {click Step} we put it back.

{click Step x5} The next card is fifty-nine. It's bigger than the card before it, so it stays where it is.

Now here's where it gets interesting. {click Step x4} The next card is twenty-six, and fifty-nine is bigger. {click Step x2} So fifty-nine slides one place to the right, and that opens up a gap. {click Step} Forty-one is bigger too, {click Step x2} so it slides over. {click Step x3} So does thirty-one. {click Step} We've run out of cards to compare, {click Step} so twenty-six drops into the gap at the front.

{check .is-full .caption ~ drop the key 26} So that's the whole idea. We lift a card, slide the bigger ones to the right, and drop it into the gap.

{split}{show panel}{label} And here's that same idea, written as a procedure. {focus code:1} This loop picks the next card. {focus code:2} This line lifts it out. {focus code:5-7} This inner loop slides the bigger cards to the right. {focus code:8} And this line drops the card into the gap. {focus off}

Now the computer repeats that for the cards we have left. {speed 1.5}{click Play} Each one comes out, the bigger cards slide over, and it drops into place. {await}

{speed 1}{check .is-full .caption ~ permutation}{focus cells} Now the numbers are in order, and the procedure has stopped. {focus s1checks} We have the same numbers we started with, and each one is no bigger than the next. {focus off} That's what makes it an algorithm. It's precise enough for a machine to follow, and it always finishes.

{check .is-full .statrow ~ comparisons9}{check .is-full .statrow ~ shifts5}{show stats} So how much work did it do? We made nine comparisons and five shifts. But what if the list is already sorted?

{label Already sorted}{click Already sorted}{pause 0.2}

{speed 2.5}{click Play} Each card gets one quick look at its neighbor, finds that it's already in the right place, and goes straight back. {await}

{speed 1}{check .is-full .statrow ~ comparisons5}{check .is-full .statrow ~ shifts0} That's five comparisons, and no shifts at all. Now let's try the same numbers in reverse.

{label Reversed}{click Reversed}{pause 0.2}

{speed 4}{click Play} This time, almost every card has to travel all the way to the front. So nearly every comparison ends with a shift, and the work piles up with each new card. {await}

{speed 1}{check .is-full .statrow ~ comparisons15}{check .is-full .statrow ~ shifts14} We have the same algorithm and the same numbers, but three times as many comparisons. So the work an algorithm does depends on its input. Keep that in mind, because we'll come back to it.

{label In Rust}{hide stats}{rust}{click Book's instance}{pause 0.3}

Now let's write the same algorithm in Rust, because Rust makes you think about something most languages hide, and that's who owns your data.

{focus rs:16} Here, main creates a vector with our six numbers. {focus stack} The vector itself is small. It lives on the stack, {focus heap} and it points to a buffer on the heap, where the numbers actually live. {focus off} In Rust, every value has exactly one owner, and the owner of this vector is the variable v.

{focus rs:17} Now we call insertion sort. But we don't give the vector away. We lend it. {click Step}{focus stack} The function gets its own frame on the stack, with a reference called a, that points into the very same buffer.

{focus rs:2} This ampersand mut means it's a mutable borrow. The function can change the numbers, but it doesn't own them, so it can't throw them away.

{click Step}{focus rs:4} When we lift a card, key gets a copy of it. Copying a small number is cheap, so Rust just copies it, and the original stays in the buffer until a shift writes over it.

{focus off}{speed 5}{click Play} Let's finish the sort, and watch the buffer on the heap change as the cards move. {await}

{speed 1}{check .is-full .caption ~ permutation}{focus stack} When the function returns, its frame is gone, and so is the borrow. Nothing was copied, and nothing was freed. Main still owns the vector, and now its numbers are in order.

{focus off} So that's ownership and borrowing in a nutshell. Every value has one owner. You can lend it out, and a mutable borrow lets the borrower change it, while you keep owning it.

{goto correct | Part 2 of 7 | What does correct mean?}{pause 0.6}

{scene} So how do you know an algorithm works? The book has a strict definition. An algorithm is correct if, for every possible input, it stops, and it gives the right answer. Not most of the time. Every time.

{focus checks} This machine checks exactly that. Did the procedure stop? Are all the numbers still there? And are they in order?

{focus budget} We also give each procedure a step budget. From the outside, a slow program and a stuck program look the same, so at some point we have to stop waiting.

{focus off}{label Bubble sort} We have three procedures to test. The first one is bubble sort. {speed 1.6}{click Run} It keeps swapping neighbors that are out of order, until nothing is out of place. {await}

{speed 1}{check .is-full .caption ~ BUBBLESORT is correct}{focus checks+tverdict} It stopped, nothing's missing, and everything's in order. That's what we want.

{focus off}{label One pass}{click Wrong answer}{pause 0.2} The second one is the same code, without the outer loop. {click Run} So it makes one pass over the list, and then it stops. {await}

{check .is-full .caption ~ Halting is not enough}{focus tverdict} It stopped, but the answer is wrong. There's no crash and no error message. That's the first way an algorithm can fail.

{focus off}{label A one-character bug}{click Never halts}{pause 0.2}{split}{show panel}{focus bug} The third one has a one-character bug on this line. It says less than, where it should say less than or equal to. {pause 0.3}

{focus off}{speed 1.6}{click Run}{pause 0.6}{focus tcells} Look at the two equal numbers in the middle. They keep trading places, over and over, and the procedure never moves on. {focus budget} And there goes the budget. {await}

{speed 1}{check .is-full .caption ~ never halts}{focus tverdict} It never stops. That's the second way to fail.

{focus off}{label No repeated values}{click No repeated values}{pause 0.2} Now let's run the same buggy code on a list with no repeated numbers. {speed 2}{click Run} This time, no two numbers are equal. {await}

{speed 1}{check .is-full .caption ~ correct}{focus checks+tverdict} It passes. If this was your only test, you'd ship this bug.

{focus off}{card One passing test doesn't prove your code is correct. | Correct means every input, every time.} So a passing test doesn't prove your code is correct. When you test, always include the awkward cases. Duplicates, empty lists, and input that's already sorted.

{goto error-rate}{pause 0.3}

{label Wrong on purpose} But here's a twist. Some useful algorithms are allowed to be wrong, as long as we can control how often. This one tests whether a number is prime, and tests like this are how computers make the keys that keep your payments secure.

It picks a random number and runs a quick check. If the check fails, we know for sure that the number isn't prime. If it passes, the number is probably prime, but a few numbers can fool it. {show stats}{click Run} Let's test ninety-one. It's seven times thirteen, so it isn't prime, but the test doesn't know that. {await}

{check .is-full .caption ~ COMPOSITE} It found proof, so the answer is certain. Ninety-one isn't prime.

{focus meter} The point is that we can control how often a test like this is wrong. Each extra round at least halves the chance. {slider 0 10} With ten rounds, the chance of a wrong answer is below a tenth of a percent. {focus off} So an algorithm doesn't always have to be right, as long as we know how often it's wrong, and we can make that as small as we like.

{goto shortest | Part 3 of 7 | Which problems do algorithms solve?}{pause 0.6}

{scene} Sorting is just one problem. Algorithms also find routes, power search engines, secure your payments, and compress your files.

What most of these problems have in common is this. There's a huge number of possible answers, and almost all of them are wrong.

{focus roads}{label Shortest path} Take navigation. We want the shortest drive from A to F. The obvious solution is to list every possible route, and keep the shortest one. {focus off}{show stats}{speed 1.8}{click Play} Each time it reaches F, it writes down the route, then backs up and tries a different road. It keeps going until no road is left untried. {await}

{speed 1}{check .is-full .statrow ~ routes found13}{check .is-full .caption ~ 1,262,816}{focus counters} That's thirteen routes, for just six crossings. On a small grid of city streets, that number is already over a million. So this approach doesn't scale.

{focus off}{label Dijkstra's algorithm}{click Dijkstra}{pause 0.2} Here's a better way. This is Dijkstra's algorithm, and it never lists any routes. {speed 2}{click Play} It always picks the closest crossing it hasn't finished with, then updates the distances to its neighbors. Each crossing is finished once, and never looked at again. {await}

{speed 1}{check .is-full .caption ~ F = 13}{focus roads} It found the same route, and it didn't have to list a single one. That's what a good algorithm does. It finds the answer without checking every possibility.

{goto hard | Part 4 of 7 | When no fast algorithm is known}{pause 0.6}

{scene} But that doesn't always work. Here's a problem that looks very similar.

{focus tourmap}{label The traveling salesperson} A delivery van leaves the depot, visits every stop, and comes back. We want the shortest round trip. This is called the traveling salesperson problem.

{show stats}{check .is-full .statrow ~ 360}{focus tours} Here, there are three hundred and sixty possible tours. {focus off}{speed 1.5}{click Play} Let's check them all. {await}

{speed 1}{focus tourmap} That works for a few stops. But every new stop multiplies the number of tours, so with twenty stops, this is out of the question.

{focus off} Nobody has ever found a fast algorithm for this problem. And nobody has proved that one can't exist. Problems like this are called NP-complete.

They show up in real work, so you should learn to recognize them. If you have one, don't spend your time looking for a perfect solution. Use an approximation algorithm, which is fast and gets close to the best answer.

{label An approximation}{click Approximate}{pause 0.2}{speed 2.2}{click Play} This one builds the cheapest tree that connects every stop. Then it visits the stops in the order it meets them, walking around that tree, and goes back to the depot. {await}

{speed 1}{check .is-full .statrow ~ 1.36}{focus ratio} This tour is about a third longer than the best one. But it took a handful of steps, instead of hundreds of tours. In the real world, that's often a good deal.

{goto ds | Part 5 of 7 | There is no best data structure}{pause 0.6}

{scene} Algorithms work on data, so the way you store that data matters. A data structure is a way to store and organize data, so it's easy to access and change.

{focus array} This is an array. The items sit side by side in memory. {focus list} This is a linked list. Each item can live anywhere, and it points to the next one.

{focus off}{label Add to the front}{click Insert 25 at front}{pause 0.2} Let's add a number to the front. {speed 0.4}{click Play}{pause 0.4}{focus array} The array has no gap, so every item has to shift one place to the right. {focus list} The list just creates a new node, and points it at the old first item. {await}

{show stats}{check .is-full .statrow ~ array steps5}{check .is-full .statrow ~ list steps2}{focus counters} The list wins. Now let's read the third item.

{focus off}{label Read the third item}{click Read 3rd item}{pause 0.2} {speed 0.4}{click Play}{pause 0.4}{focus array} The array calculates the position, and jumps straight there. {focus list} The list has to start at the front, and follow the pointers one by one. {await}

{check .is-full .statrow ~ array steps1}{check .is-full .statrow ~ list steps3}{focus counters} This time, the array wins.

{focus off}{card No data structure is best at everything. | Choose based on what your program does most.} So no single data structure is best at everything. You choose one based on what your program does most.

{scene}{label In Rust}{hide stats}{split}{show panel}{rust}{click Insert 25 at front}{pause 0.3}

Now let's see how Rust stores these two. {focus heap} On the heap, the array's numbers share one block. But every node of the list is its own box, wherever there was room.

A box is a pointer that owns what it points to. So the list owns its first node, that node owns the second, and so on, all the way down the chain. {focus off}

{speed 0.6}{click Play} When we add twenty-five, Rust takes the old chain out of the list's head, and moves it into the new node. Nothing is copied. The ownership just moves. {await}

{speed 1}{focus heap} And because every node has exactly one owner, freeing the list is automatic. When the list goes away, it frees its first node, which frees the next one, all the way down. {focus off} You never free memory yourself, and you can't free the same node twice.

{goto parallel | Part 6 of 7 | New kinds of computers}{pause 0.6}

{scene}{label The clock wall} For a long time, computers got faster because their clocks got faster. {focus chip} This chip has two cores, running at two gigahertz each.

{focus power} Let's push the clock. {slider 0 4.5} At four and a half gigahertz, the chip does more work. But the heat grows much faster than the speed, and this chip would melt. {check .is-full .caption ~ 4.5}

{slider 0 2} So chip makers stopped raising the clock, and added cores instead. {focus chip}{slider 1 8} Eight cores at the same clock do four times the work, and each core stays just as cool. {check .is-full .caption ~ 16} {focus off}

But there's a catch. Extra cores only help if the algorithm can split its work into pieces that run at the same time. That's why the book has a whole chapter on parallel algorithms.

{goto online}{pause 0.3}

{label Online algorithms} Here's another change to the usual setup. Some algorithms have to decide before they know what's coming. They're called online algorithms.

Let's say you need to get to the tenth floor. The stairs take ten minutes. The elevator takes one minute, but you don't know when it will arrive. So, do you wait, or do you climb?

{show stats}{label Always take the stairs}{click Try every m} Let's try every possible arrival time. {await}

{check .is-full .caption ~ competitive ratio, 10} If you always take the stairs, your worst case is when the elevator was about to arrive. You spend ten minutes, when one minute was enough. That's ten times slower than someone who knew the future.

{label Wait, then climb}{click Wait k, then climb}{pause 0.2}{click Try every m} Now let's wait ten minutes for the elevator, and if it hasn't come, take the stairs. {await}

{check .is-full .caption ~ competitive ratio, 2} Whatever happens, we're never more than about twice as slow as someone who knew the future. That number is called the competitive ratio, and a good online algorithm keeps it small.

{goto race | Part 7 of 7 | Why better algorithms beat better hardware}{pause 0.6}

{scene} Now let's go back to our race. {focus laneA} Computer A has every advantage. It runs ten billion instructions a second, and its code was written by the best programmer around, in machine language.

{focus laneB} Computer B runs ten million instructions a second. Its code was written by an average programmer, using an inefficient compiler.

{focus growA+growB} B has only one advantage, and that's its algorithm. A runs insertion sort, the one you saw earlier. B runs a different algorithm, called merge sort.

{speed 2}{click Race}{focus barA+barB} Let's run that race again. {await}

{speed 1}{check #s21-svg ~ 19.4 minutes}{check #s21-svg ~ 5.6 hours}{focus verdict} And B finishes more than seventeen times sooner. So why?

{focus growA+growB} It comes down to how the work grows. With insertion sort, the work grows with the square of the input. Double the list, and you get four times the work. With merge sort, double the list, and you get just over twice the work.

{focus off} A faster computer divides your running time by a fixed amount. A better algorithm changes how that time grows. So the bigger the input, the bigger the gap.

{label One hundred million numbers} Let's see that in action. {click 100 million}{pause 0.3}

{speed 2}{click Race}{focus barA+barB} This is ten times the numbers, on the same two computers. {await}

{speed 1}{check #s21-svg ~ 3.7 hours}{check #s21-svg ~ 23.1 days}{focus barA+barB} Computer A now needs more than three weeks. Computer B needs under four hours. And this isn't a made-up size. The book points out that more than a hundred million emails are sent every minute.

{show stats} To be fair, computer A doesn't always lose. {check #s21-stats ~ 471,000}{focus cross} Below about half a million items, it wins, because on small inputs, raw speed matters more. That turning point is called the crossover point. Past it, computer A never catches up.

{focus off}{label A faster computer} So what if we just buy a faster computer? {click 10 million} Let's go back to ten million numbers, {focus rateA} and make computer A ten times faster. {slider 1 11}{pause 0.5}

{speed 2}{click Race}{focus barA+barB} Ten times the hardware, against a better algorithm. {await}

{speed 1}{check #s21-svg ~ 33.3 minutes}{focus barA+barB} Computer A still loses. That's ten times the hardware, and the better algorithm is still ahead.

{focus off}{label}{card Algorithms are a technology. | System performance depends on them as much as on hardware.} That's why the book treats algorithms as a technology, just like hardware. The performance of your system depends on both.

{card Machine learning is algorithms too. | For well-understood problems, a designed algorithm usually does better.} What about machine learning? It doesn't replace any of this. Machine learning is itself a collection of algorithms. And for problems we understand well, an algorithm designed for the job usually does better.

{goto race | Recap | What you learned}{pause 0.6}

{scene}{card An algorithm turns input into output, in finite time.} Let's recap. An algorithm is a precise procedure that turns input into output, in a finite amount of time.

{card Correct means every input, every time. | Unless the error rate is known, and tiny.} It's correct only if it stops with the right answer, on every input. Some useful algorithms are wrong on purpose, but only rarely, and by a known amount.

{card Good algorithms don't check every possibility. | For some problems, no fast algorithm is known.} Good algorithms find the answer without checking every possibility. And for some problems, nobody knows a fast one.

{card No data structure is best at everything. | In Rust, every value has one owner.} No single data structure is best at everything. And in Rust, every value has one owner, which you can lend out, or move.

{card More cores, and decisions made in advance. | Parallel and online algorithms.} New kinds of computers need new kinds of algorithms, for many cores, and for decisions made before the facts arrive.

{card Better algorithms beat better hardware. | The bigger the input, the bigger the gap.} And as your input grows, a better algorithm beats better hardware.

{card Try every machine yourself. | The link is in the description.} All of these machines are interactive, and the link is in the description. Start with the race, and see if you can find the point where computer A starts to lose. In the next video, we'll look at insertion sort more closely, and learn how to measure exactly how fast an algorithm is. {pause 0.4}
