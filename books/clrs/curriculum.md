# Rust for Introduction to Algorithms (CLRS)

This book's code language is Rust ([book.json](book.json), `language`). This file is everything the video skills need
about it: where it appears, how lessons teach it, the order the series introduces it, and how a judge checks what's said
about it.

## Where Rust appears

- **Lessons:** yes. The reference courses teach in Java; ours teach in Rust. A `code` lesson shows the same idea as the
  concept lesson before it, typed live: first with the standard library, then built from scratch.
- **Long-form chapter videos** (`videos/clrs/chNN/script.md`): **no Rust at all.** No `{rust}` cue, no stack or heap, and
  no ownership or borrowing, in the narration, the agenda or the recap. Rust belongs to the code lessons. In its place,
  every algorithm is read in the book's pseudocode, one line at a time.
- **Pages:** every scene has a complete Rust program beside the book's pseudocode ([authoring.md](authoring.md)).

## How a lesson teaches Rust

- **One idea at a time, at the moment the algorithm needs it**, usually through a real compiler error: write the natural
  thing, run it, read the error, then fix it. `{run error}` shows the compiler's real error.
- **Every snapshot that is run is compiled with `rustc`** (`book.json` `language.compile`) by `narrate.py`, and `{run}`
  shows the program's real output. The build fails if a snapshot doesn't compile, unless the cue is `{run error}`.
- **Snapshots** are fenced ` ```rust @name ` blocks in the script, never spoken.
- **Say symbols as words:** "ampersand mut", not `&mut`. The lint stops digits and symbols in speech.
- **Don't re-teach.** Use a Rust idea an earlier chapter taught, with a short reminder ("as you learned, ampersand mut
  lends the vector").

## The order, across the series

Follow this order, and don't re-teach what an earlier chapter covered:

1. Ownership: every value has one owner. Passing a `Vec` moves it (ch01, insertion sort: E0382)
2. Borrowing: `&mut` lends without giving away, and small values are copied (ch01)
3. Moves and `Box`: `take()` moves out of a borrow, ownership passes along a chain, and freeing is automatic (ch01, linked list: E0507)
4. Shared `&` borrows: many readers at once, or one writer (ch01 duplicates; ch02)
5. `clone()` for data you change but also keep, then `Option` instead of NIL: `get` returns `None` instead of crashing (ch03)
6. Slices and splitting a borrow, as in divide and conquer: `to_vec()` and `split_at_mut` (ch02)
7. `#[derive(Clone, Copy)]` for small types of your own, and what a borrow costs: a slice is an address and a
   length, the same size whatever it covers (ch04)
8. A `Vec` grows by doubling its capacity, and a `Vec` of `Vec`s is many separate allocations, all freed when the outer
   one drops; then generic functions over `T`, and `&mut` for state that changes on every call, such as a seeded
   pseudorandom generator (ch05)
9. Lifetimes, only when a chapter's data structure needs them

## Checking what a script says about Rust

For the `judge-video-script` skill's check on code claims:

- The primary source is the toolchain itself: `rustc`, and the standard library's docs and source at
  `$(rustc --print sysroot)/lib/rustlib/src/rust/library/`. Don't rely on what used to be true.
  > ✗ "Under the hood, it's based on merge sort." Rust's docs say `sort` is driftsort, which "combines the fast average
  > case of quicksort with … mergesort". ✓ "Under the hood, it's a hybrid built on merge sort and quicksort."
- A quoted compiler error must match the real error's words and code (for example E0382 or E0507).
- Ownership, borrowing, copying, moving and freeing must be described exactly as Rust does them.
  > ✗ "Rust has no null pointers." Raw pointers can be null. ✓ "Safe Rust has no null references."
- Every API used must exist on stable Rust. Note any API that is recent, such as `is_sorted`, which is stable since 1.82.
