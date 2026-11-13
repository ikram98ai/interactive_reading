/* The shelf. Add one entry per book you read, pointing at its folder under books/; the slug is that folder's name. */
window.LIBRARY = [
  {
    slug: "csapp",
    path: "books/csapp/index.html",
    title: "Computer Systems: A Programmer's Perspective",
    author: "Randal E. Bryant & David R. O'Hallaron",
    spine: "CS:APP · 3rd ed.",
    accent: "mint",
    blurb:
      "What really happens between your program and the machine that runs it — bits, instructions, caches and processes.",
    chapters: 12,
    built: 12,
  },
  {
    slug: "clrs",
    path: "books/clrs/index.html",
    title: "Introduction to Algorithms",
    author: "Cormen, Leiserson, Rivest & Stein",
    spine: "CLRS · 4th ed.",
    accent: "lilac",
    blurb:
      "The book's pseudocode, beside runnable Rust, acted out by machines you can step through, line by line.",
    chapters: 35,
    built: 35,
  },
  {
    slug: "ddia",
    path: "books/ddia/index.html",
    title: "Designing Data-Intensive Applications",
    author: "Martin Kleppmann & Chris Riccomini",
    spine: "DDIA · 2nd ed.",
    accent: "blue",
    blurb:
      "How real data systems store, copy, and agree on data — as machines you can poke, break, and fix.",
    chapters: 14,
    built: 14,
  },
];
