/* Book manifest. Loaded before assets/kit.js.
   To add a chapter simulation: write chNN.html here and raise `built` to that number. */
window.BOOK = {
  slug: "csapp",
  title: "Bitville",
  book: "Computer Systems: A Programmer's Perspective",
  author: "Randal E. Bryant & David R. O'Hallaron",
  edition: "3rd edition",
  blurb: "What really happens between your program and the machine that runs it.",
  accent: "mint",
  built: 12, // chapters 1..12 have pages
  chapters: [
    { n: 1, short: "The tour", title: "A Tour of Computer Systems", kid: "What happens to your program between typing it and seeing it run." },
    { n: 2, short: "Bits & numbers", title: "Representing and Manipulating Information", kid: "Everything is bits — and why computer numbers sometimes lie." },
    { n: 3, short: "Machine code", title: "Machine-Level Representation of Programs", kid: "The tiny instructions your code turns into." },
    { n: 4, short: "Processor", title: "Processor Architecture", kid: "Building the machine that runs those instructions." },
    { n: 5, short: "Optimizing", title: "Optimizing Program Performance", kid: "Making programs faster by working with the hardware, not against it." },
    { n: 6, short: "Memory hierarchy", title: "The Memory Hierarchy", kid: "Fast tiny memory, slow huge memory, and the caches in between." },
    { n: 7, short: "Linking", title: "Linking", kid: "Gluing separately written pieces into one running program." },
    { n: 8, short: "Control flow", title: "Exceptional Control Flow", kid: "Interruptions: how the machine juggles many things at once." },
    { n: 9, short: "Virtual memory", title: "Virtual Memory", kid: "Every program believes it owns all the memory. A polite lie." },
    { n: 10, short: "File I/O", title: "System-Level I/O", kid: "Reading and writing files the way the system really does it." },
    { n: 11, short: "Networking", title: "Network Programming", kid: "How one machine talks to another over the internet." },
    { n: 12, short: "Concurrency", title: "Concurrent Programming", kid: "Doing several things at the same time without tangling them." },
  ],
};
