---
title: Divide and Conquer, and How Fast It Really Is
kicker: Introduction to Algorithms · Chapter 4
page: books/clrs/ch04.html
scene: strassen
seed: 1
targets:
  cbars: svg:70,58,576,228
  clast: svg:590,204,48,82
  copsend: svg:540,160,100,126
  rec: svg:20,10,378,50
  call: svg:20,66,272,130
  cbox: svg:20,66,272,54
  fbox: svg:54,124,238,38
  tbox: svg:54,158,238,38
  plot: svg:314,56,330,238
  s1call: css:#s1-svg [data-part=call]
  s1plot: css:#s1-svg [data-part=plot]
  mA2: svg:64,180,174,140
  mB2: svg:244,28,176,144
  mC2: svg:244,180,176,140
  row1: svg:64,180,174,38
  col1: svg:244,28,46,144
  loops: svg:24,32,166,124
  s2side: css:#s2-svg [data-part=side]
  m3A: svg:74,34,136,118
  m3B: svg:244,34,136,118
  m3C: svg:443,34,138,118
  tree: svg:150,158,502,126
  troot: svg:328,160,150,36
  tmid: svg:154,208,498,34
  tleaves: svg:154,254,498,30
  rec3: svg:10,292,180,30
  s3tree: css:#s3-svg [data-part=tree]
  s3rec: css:#s3-svg [data-part=recurrence]
  wA: svg:18,32,126,84
  wB: svg:18,136,126,84
  wC: svg:18,238,126,84
  wS: svg:164,32,124,236
  wP: svg:380,32,224,166
  wCu: svg:380,224,226,98
  ladder: svg:18,30,624,236
  rung2: svg:132,156,82,48
  rung3: svg:448,156,82,48
  pbars: svg:84,56,556,222
  plast: svg:592,74,44,180
  rroot: svg:166,38,128,32
  rlvl1: svg:26,98,410,34
  rleaves: svg:20,220,424,32
  rcost0: svg:452,38,150,26
  rcost1: svg:452,98,160,32
  rtotal: svg:16,252,630,52
  mformula: svg:220,10,222,38
  mbars: svg:44,180,606,122
  mverdict: svg:12,304,636,38
  barr: svg:22,34,616,52
  lptr: svg:22,118,616,60
  lall: svg:22,184,616,60
  lsub: svg:22,250,616,60
---

{click As n doubles}{scene} Here's a way to multiply two big matrices. You cut each one into four smaller blocks, and multiply the blocks. The obvious method needs eight of those smaller multiplications. In nineteen sixty-nine, Strassen found a way to do it with seven.

One multiplication out of eight doesn't sound like much. So how much can it really save?

{speed 2}{click Play}{focus cbars} Each bar is the work Strassen's method does, as a share of the obvious method. Every time the matrices double in size, the bar shrinks again. {await}

{speed 1}{check .is-full .statrow ~ 0.23}{focus clast} With two thousand forty-eight rows, it does less than a quarter of the multiplications. {focus off} That's because the saving happens again inside every smaller multiplication, all the way down.

{title} This is chapter four of Introduction to Algorithms, on divide and conquer. By the end of this video, you'll know why that one saved multiplication matters so much, and how to work out the running time of algorithms like it. Here's what we'll cover.

{item Divide, conquer, combine} We'll start with how divide and conquer works, {item Multiplying matrices} then use it to multiply matrices, {item Strassen's seven products} and see Strassen's trick. {item Proving a running time} Next, we'll prove a running time, {item Recursion trees} find one by drawing a tree, {item The master theorem} and then learn a shortcut that solves most of them. {item The cost of passing an array} Finally, we'll see what it costs to hand an array to a function.

Along the way, we'll write these algorithms in Rust, and see what Rust copies, what it only borrows, and what each one costs. You don't need any math beyond multiplying and adding. So let's get started.

{goto recurrences | Part 1 of 7 | What is divide and conquer?}{hide s1call+s1plot}{pause 0.6}

{scene} Let's say a teacher has a pile of exam papers to sort. She gives half of them to each of two helpers. Each helper splits their pile again, and so on, until a pile is small enough to sort by hand. Then the sorted piles are merged back together.

{label Divide and conquer} This is called divide and conquer. If the problem is small enough, that's the base case, and you solve it directly. Otherwise, you do three things. You divide it into smaller copies of the same problem. You conquer each one, the same way. And you combine their answers.

That's how merge sort works. So how long does it take? {focus rec} We can write its running time like this. The time for n papers, T of n, is the time for two piles of half the size, plus n steps to divide and combine.

{label A recurrence}{focus off} An equation like this is called a recurrence, because it describes a cost in terms of itself, on smaller inputs.

{show s1call}{focus call} This machine works it out exactly, for every n up to a hundred and twenty-eight. {speed 4}{click Play} It starts with the base cases. Below three, the cost is just a constant. After that, every value is built from smaller ones it has already worked out, and kept in a table, so nothing is computed twice. {await}

{speed 1}{check .is-full .statrow ~ T(128) = 832}{focus cbox} Here's the last value, T of a hundred and twenty-eight. {focus fbox} It costs a hundred and twenty-eight to divide and combine. {focus tbox} Then it adds two calls of half the size, which the table already holds. {focus off}

{label}{show s1plot}{focus plot} This plot is T of n, divided by n log n, the answer the book gives for this recurrence. {check .is-full .statrow ~ 0.77–1.01} It wobbles, but it stays between two fixed numbers. That's what it means for T of n to grow like n log n.

The thin line rounds the half sizes up instead of down. The numbers change, but the shape doesn't. That's why the book usually leaves the rounding out. {focus off} Now let's use this on a real problem, multiplying matrices.

{goto matmul | Part 2 of 7 | How do you multiply matrices?}{hide s2side}{pause 0.6}

{scene} Here are two matrices. {focus mA2} This one is A, {focus mB2} and this one is B. {focus mC2} To multiply them, every entry of the answer, C, comes from one row of A and one column of B.

{focus row1+col1} We take the first row of A, and the first column of B. {click Step} We multiply the first pair, {click Step} then the next pair, and add it on. {click Step x2} After four products, the row has met the column, and this entry of C is done. {check .is-full .caption ~ row 1 of A has met column 1 of B}

{show s2side}{focus loops} That's three loops, one inside another. The outer loop picks the row, the middle loop picks the column, and the inner loop walks along them both. {focus off}{speed 3}{click Play} So the computer repeats this for every entry of C, one product at a time, until the whole matrix is filled in. {await}

{speed 1}{show stats}{check .is-full .statrow ~ 64 / 64} There are sixteen entries, and each took four products. That's sixty-four multiplications, or n cubed. So the obvious method takes n cubed time.

{goto matmul-rec}{hide s3tree+s3rec}{pause 0.3}

{label Split into blocks} Now let's try divide and conquer. {focus m3A+m3B+m3C} We cut each matrix into four quarters, called blocks. And here's the nice part. Blocks multiply just like numbers do.

{focus off}{click Step} Notice that cutting is free. A block is named by the row and column where it starts, so nothing gets copied. That's called index calculation.

{click Step} The top left block of C is a block of A times a block of B, plus a second product like it. Each quarter of C needs two of these, so that's eight multiplications, each half the size.

And each one is the same problem, just smaller, so we solve it the same way. {show s3tree}{focus tree} Here's every call, drawn as a tree. {focus troot} The first call makes eight smaller calls, {focus tleaves} and each of those makes eight more, on single numbers.

{focus off}{speed 4}{click Play} At size one, a block is just a number. That's the base case, so it does one multiplication, and adds it into C. {await}

{speed 1}{check .is-full .caption ~ 64 = 4³}{focus tleaves} The tree has sixty-four leaves, so it does sixty-four multiplications, exactly like the triple loop.

{show s3rec}{focus rec3} As a recurrence, that's eight calls of half the size, plus a constant for the split. It works out to n cubed. So on its own, divide and conquer made nothing faster.

{focus tmid} Merge sort splits into two and gets n log n. This tree has eight children per node instead of two. It's much bushier, so it has far more leaves. {focus off}

{label In Rust}{hide stats}{split}{show panel}{rust}{click Reset}{pause 0.3}

Now let's write this in Rust. {label}{focus stack} Main owns three vectors, {focus heap} and each one is a single buffer on the heap, with the numbers stored row after row.

{click Step}{focus rs:22} Every call borrows A and B to read them, and C to write the results, just like the borrows we saw in chapter two. What's new here is how a block gets passed around.

{click Step x2}{focus stack} Each call gets its own frame, with its own views. A view is a small struct, just two numbers, the row and column where its block starts. {focus heap} And every view points into the same buffers that main owns.

{focus stack} We marked View as Copy. So passing a view to a function copies its two numbers, and the caller keeps its own. That's why the same block of A can go to two calls in a row. A vector couldn't do that. Passing it would move it, and the second call wouldn't compile.

{focus rs:22} C works differently. It's a mutable borrow, and each call lends it on to the next one. Rust lends it again for every call, one at a time, so there's only ever one writer.

{speed 5}{click Play} Let's finish the multiplication. Every call reads from the same two buffers, and adds its products into the third one, in place. {await}

{speed 1}{check .is-full .caption ~ Done: 73 calls}{focus stack} When the last call returns, every borrow has ended, and main owns its vectors again, with C holding the answer.

{focus off} So a small type like View can be Copy. Copying it is as cheap as copying a number, so you never have to think about who owns it. But we still have n cubed. Can we do better?

{goto strassen | Part 3 of 7 | Can seven products replace eight?}{click 2 × 2 worksheet}{pause 0.6}

{scene} For a long time, many mathematicians assumed you couldn't multiply matrices faster than n cubed. Then, in nineteen sixty-nine, Strassen proved them wrong.

{label A small algebra trick} His idea has a small cousin in algebra. X squared minus y squared looks like it needs two multiplications. But it's the same as x plus y, times x minus y. That's one multiplication, and two additions.

For plain numbers, that's no real saving. But for big matrices, a multiplication costs far more than an addition, so trading one for a few additions pays off.

{label Strassen's algorithm}{focus wA+wB} Here are two small matrices from the book's exercises. Strassen splits them into blocks, like before. {focus wS} Then he builds ten sums and differences of those blocks. {focus wP} He multiplies them in just seven products. {focus wCu} And he adds and subtracts the products to build C. {focus off}

{speed 6}{click Play} Let's run it. First come the ten sums, then the seven products, and then the updates of C. Each line only uses blocks the algorithm already has. {await}

{speed 1}{check .is-full .caption ~ [[18, 14], [62, 66]]}{focus wC} C is exactly what the triple loop gives. {show stats}{check .is-full .statrow ~ 7 of 7}{focus stat:multiplications} But it took seven multiplications instead of eight. {check .is-full .statrow ~ additions22}{focus stat:additions} The price is a lot of extra additions.

{focus off}{label} The additions cost about n squared time. But each multiplication is a whole smaller problem.

{card Seven half-size products, instead of eight. | T(n) = 7T(n/2) + Θ(n²)} So the recurrence becomes seven calls of half the size, plus n squared for the additions.

{scene}{hide stats}{label Counting every operation}{click As n doubles}{click All operations} But do all those extra additions eat up the savings? {speed 3}{click Play} This time, we count every operation, additions included. For small matrices, Strassen's method does about twice the work. {await}

{speed 1}{check #s4-svg ~ pulls ahead from n = 1024}{focus copsend} It only pulls ahead at a thousand and twenty-four rows. {focus off} From there on, the saved multiplications outweigh the extra additions, and the gap keeps growing.

{label} We keep saying a recurrence works out to some answer. So how do you actually find that answer, and prove it?

{goto substitution | Part 4 of 7 | How do you prove a running time?}{pause 0.6}

{scene}{label The substitution method} The first method is called the substitution method, and it has two steps. You guess the form of the answer, and then you prove it by induction.

Let's try it on merge sort's recurrence. Our guess is that T of n is at most c times n log n, for some constant c.

{focus ladder} Picture a ladder. Each box is a rung, with the real value of T of n. Every rung stands on the rung at half its size. If the guess holds down there, the recurrence shows it holds up here too. That's the inductive step.

{focus rung2+rung3} But a ladder needs a foot. These two rungs have nothing smaller to stand on, so we check them directly. They're the base cases.

{focus off}{show stats}{speed 4}{click Play} Let's climb, with c equal to five. Each base case is checked against its real value, and every other rung leans on the rung below it. {await}

{speed 1}{check .is-full .caption ~ All 14 rungs}{focus ladder} Every rung holds, and the same step would keep climbing forever. So T of n grows no faster than n log n.

{label What if c is too small?}{focus off} Now let's lower c to one and a half. {slider 0 1.5}{pause 0.5}

{check .is-full .caption ~ base case 2 fails}{focus rung2} This base case fails its check. {focus ladder} So every rung standing on it is unproved, even where the bound is actually true.

{click n₀ = 3}{pause 0.3}{focus off}{check .is-full .caption ~ All 13 rungs} But we can start the ladder one rung higher. Now one and a half works everywhere. The constants are ours to choose, as long as the step and the base cases both hold.

{goto pitfalls}{pause 0.3}

{label A proof that lies} Here's a mistake that's easy to make. Let's prove that the same recurrence is just order n, and use big O inside the proof itself.

{speed 4}{click Play} At every level, we assume the smaller one is order n. Two of those, plus n more work, is still order n. Every line looks fine. {await}

{speed 1}{check .is-full .caption ~ the bars rose from 1 to 11}{focus pbars} But look at the bars. They show T of n divided by n, and they keep climbing. {focus plast} By the last level, the constant has grown from one to eleven. {focus off}

Big O hides a constant, and this proof quietly lets it grow at every level. Induction needs the same constant all the way up.

{label}{card Name your constants. | Never put big O inside an inductive hypothesis.} So keep big O out of your inductive hypothesis. Name the constant, and prove the exact claim. Substitution is powerful, but it only checks a guess. So where does a good guess come from?

{goto rtree | Part 5 of 7 | Where does a good guess come from?}{pause 0.6}

{scene}{label A recursion tree} You draw the recursion as a tree. Take a recurrence where each call does c times n squared work of its own, and hands three quarter-size jobs to helpers. {focus rroot} Here's the whole problem, with n equal to sixty-four.

{click Step}{pause 0.4}{focus rcost0} We expand it. The root does its own work, and that's the cost of the first level.

{click Step}{pause 0.4}{focus rlvl1} The next level has three nodes, each a quarter of the size. {focus rcost1} Together, they cost three sixteenths of the level above.

{focus off}{speed 1.5}{click Play} And every level after that costs three sixteenths of the one before it. The levels shrink fast, so even forever, the total could never pass sixteen thirteenths of the root. {await}

{speed 1}{check .is-full .caption ~ under (16/13)cn²}{focus rtotal} The whole tree adds up to just a bit more than the root. {focus rleaves} Even the leaves barely register. {focus off} So the root dominates, and the guess is n squared.

That's what the tree is for. It gives you a guess, and then the substitution method proves it. But adding up a tree every time is a lot of work. Is there a shortcut?

{goto master | Part 6 of 7 | Is there a shortcut?}{pause 0.6}

{scene} Most divide-and-conquer algorithms split a problem into some number of pieces, each a fixed fraction of the size, and spend some work to divide and combine. {label A master recurrence}{focus mformula} That's called a master recurrence. Here's Strassen's. Seven pieces, half the size, and n squared for the additions.

{focus off} The master theorem asks one question. Who pays the most? The root, the leaves, or every level equally?

{click Play} It compares two things. The work at the root, called the driving function, and the number of leaves, called the watershed function. For Strassen, the leaves grow faster. {await}

{check .is-full .caption ~ Case 1}{focus mbars} So the cost per level grows toward the leaves, and the leaves win. {focus mverdict} That's case one. The answer is n to the log of seven. That's about n to the two point eight one.

{label Eight pieces}{focus off}{slider 0 8} Now let's give it eight pieces, like our first recursive method. {check .is-full .caption ~ Θ(n3)}{focus mverdict} It's still case one, and now the answer is n cubed, which is exactly what we found.

{label Four pieces}{focus off}{slider 0 4}{check .is-full .caption ~ Case 2}{focus mbars} With four pieces, every level costs the same. That's case two. We multiply one level's cost by the number of levels, which adds a log.

{label Two pieces}{focus off}{slider 0 2}{check .is-full .caption ~ Case 3}{focus mbars} With two pieces, the levels shrink from the root down, so the root wins. That's case three, and the answer is just the work at the root.

{label Merge sort}{focus off}{slider 2 1}{check .is-full .caption ~ Θ(n lg n)}{focus mformula} And here's merge sort. Two halves, plus n to merge. Every level costs about n, so it's case two again, and the answer is n log n.

{focus off}{label} So instead of drawing a tree, you read off the recurrence, compare the two functions, and write down the answer. It doesn't cover everything, because there are gaps between the cases. Then you fall back on substitution, or a more general method called Akra-Bazzi.

{card Who pays most? | The root, the leaves, or every level equally.} So that's the master theorem. But all of this assumed something we haven't questioned. Handing an array to a function costs almost nothing. Does it?

{goto p4-2 | Part 7 of 7 | What does it cost to pass an array?}{pause 0.6}

{scene} When you pass an array to a function, two very different things can happen. You can hand over its address, which is one small number, whatever the size. Or you can copy the whole array.

The book always assumes the first one. A problem at the end of the chapter asks what happens if that's wrong.

{label Binary search}{focus barr} Here's binary search, looking for sixty in a sorted array of sixteen numbers. Sixty isn't there, so this is the worst case. {focus lptr} The first lane passes a pointer. {focus lall} The second copies every item on every call. {focus lsub} And the third copies only the part the call can still look at. {focus off}

{speed 3}{click Play} Each call checks the middle, and keeps the half where sixty would be. Watch how much each lane copies along the way. {await}

{speed 1}{check .is-full .caption ~ Copied: 0 by pointer, 80 copying all N}{focus lptr} By pointer, nothing was copied. {focus lall} Copying everything cost eighty items. {focus lsub} And copying just the range cost thirty. {focus off}

{focus lall} Copying everything adds the whole array's size to every call. So binary search goes from log n to n log n, which is worse than checking every item in order.

{label Merge sort}{focus off}{click Merge sort}{pause 0.2}{speed 6}{click Play} Now merge sort. It already does a linear amount of work in every call, to merge its halves, so some copying can hide inside that. {await}

{speed 1}{check .is-full .caption ~ copied 120 items}{focus lall} Copying the whole array on every call cost a hundred and twenty items. {check .is-full .statrow ~ merge writes24} The sort itself only made twenty-four writes. {focus off} That turns n log n into n squared. {focus lsub} Copying just the range costs about as much as merging, so it stays n log n.

{label In Rust}{hide stats}{split}{show panel}{rust}{click Reset}{click Follow by pointer in the memory strip and the Rust code}{pause 0.3}

Rust makes this choice visible in the types. {label}{focus rs:3} Here, merge sort takes a mutable slice, like the ones in chapter two. So what does passing one cost? A slice is just two numbers, an address and a length. {check #rs-s14-bs-out ~ 16-byte} That's sixteen bytes, however big the array is.

{click Step x3}{focus rs:8} Each call lends its left half to the next call, as a slice of its own slice. {focus stack} So every frame holds sixteen bytes, {focus heap} and they all point into the one buffer that main owns.

{focus rs:9} When the left half returns, its borrow ends, and then the right half is lent out. Neither call copies a single number. {focus off}

{speed 4}{click Play} Let's let the sort finish. Every merge writes straight into that one buffer, and nothing is ever copied between calls. {await}

{speed 1}{check .is-full .caption ~ Sorted with 15 calls}{click Follow copy all N in the memory strip and the Rust code}{click Reset}{click Step x3}{pause 0.3}

{focus heap} Here's the copying version instead. Every call owns its own copy of all eight numbers, {focus rs:22} because the code clones the whole vector on every call. A clone is a deep copy, so its cost grows with the array.

{focus off} So in Rust, passing a slice always costs the same sixteen bytes. A copy only happens where you write clone, or to vec, so the expensive choice is easy to spot.

{goto strassen | Recap | What you learned}{pause 0.6}

{scene}{card Divide, conquer, combine. | A recurrence gives the running time.} Let's recap. Divide and conquer splits a problem into smaller copies of itself, solves them the same way, and combines the answers. Its running time is a recurrence.

{card Eight half-size products are still n³. | In Rust, a small type can be Copy.} Splitting a matrix multiplication into eight smaller ones is no faster than the triple loop. And in Rust, a small type like a view can be Copy, so passing it never moves it.

{card Seven products instead of eight. | Strassen's algorithm: about n^2.81.} Strassen saves one multiplication at every level, and that saving compounds into a faster algorithm.

{card Guess, then prove it by induction. | Name your constants.} The substitution method proves a guess by induction, as long as the constants stay the same.

{card Draw the tree, and add up the levels. | It gives you a good guess.} A recursion tree adds up the cost level by level, and gives you a good guess.

{card The master theorem: who pays most? | The root, the leaves, or every level.} The master theorem solves most of these recurrences by asking who pays the most.

{card Passing a pointer is cheap. Copying isn't. | In Rust, a slice is an address and a length.} And handing over an array costs almost nothing, unless you copy it. A slice lends part of a buffer, without copying a thing.

{card Try every machine yourself. | The link is in the description.} All of these machines are interactive, and the link is in the description. Try Strassen's worksheet with random numbers, and check that C still comes out right. In the next video, we'll hire an assistant, and see how randomness can protect an algorithm from its worst inputs. {pause 0.4}
