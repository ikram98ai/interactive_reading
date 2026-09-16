/* Book manifest. One of these per book; loaded before assets/kit.js.
   To add a chapter simulation: add/flip its entry here and set `built` to the highest finished chapter. */
window.BOOK = {
  slug: "ddia",
  title: "Data Town",
  book: "Designing Data-Intensive Applications",
  author: "Martin Kleppmann & Chris Riccomini",
  edition: "2nd edition",
  blurb: "A picture-book tour of how real data systems work, with machines you can poke, break, and fix.",
  accent: "blue",
  built: 10, // chapters 1..10 have pages; the rest show as "coming soon"
  chapters: [
    { n: 1, short: "Trade-offs", title: "Trade-Offs in Data Systems Architecture", kid: "There's no perfect answer — only choices with pros and cons." },
    { n: 2, short: "Requirements", title: "Defining Nonfunctional Requirements", kid: "What makes an app fast, dependable, able to grow, and easy to fix?" },
    { n: 3, short: "Data models", title: "Data Models and Query Languages", kid: "Tables, documents, and graphs: different ways to organize the same stuff." },
    { n: 4, short: "Storage", title: "Storage and Retrieval", kid: "How a database files things away and finds them again super fast." },
    { n: 5, short: "Encoding", title: "Encoding and Evolution", kid: "Turning data into bytes, and changing apps without breaking old ones." },
    { n: 6, short: "Replication", title: "Replication", kid: "Keeping copies of data on many computers so nothing gets lost." },
    { n: 7, short: "Sharding", title: "Sharding", kid: "Splitting a giant pile of data into pieces across many computers." },
    { n: 8, short: "Transactions", title: "Transactions", kid: "All-or-nothing changes, even when many people act at once." },
    { n: 9, short: "Distributed trouble", title: "The Trouble with Distributed Systems", kid: "Networks lose messages, clocks lie, and computers pause." },
    { n: 10, short: "Consensus", title: "Consistency and Consensus", kid: "How many computers agree on one answer." },
    { n: 11, short: "Batch", title: "Batch Processing", kid: "Crunching a mountain of data in one big job." },
    { n: 12, short: "Streams", title: "Stream Processing", kid: "Handling events the moment they happen, forever." },
    { n: 13, short: "Streaming philosophy", title: "A Philosophy of Streaming Systems", kid: "Building apps from logs of events that flow everywhere." },
    { n: 14, short: "Doing right", title: "Doing the Right Thing", kid: "Data is about people — use it fairly and kindly." },
  ],
};
