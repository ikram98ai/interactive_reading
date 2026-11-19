// thumb.js <script.md> [out.jpg] [part] — the YouTube thumbnail for a video: its chapter and title in large type, sized to be
// read at the small size YouTube shows thumbnails (a phone feed is about 360 px wide). The title and kicker come from the
// script's front matter, the same words as the video's title card. Default out: <script folder>/<folder name>-bm_fable.thumb.jpg.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const [scriptPath, outArg, partArg] = process.argv.slice(2); // partArg: the line above the title, in place of the kicker's (a section video's "Section 2.1")
if (!scriptPath) { console.error("usage: node tools/video/thumb.js <script.md> [out.jpg]"); process.exit(2); }
const src = fs.readFileSync(scriptPath, "utf8");
const front = (src.match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
const field = (k) => ((front.match(new RegExp(`^${k}:\\s*(.+)$`, "m")) || [])[1] || "").trim();
const title = field("title"), kicker = field("kicker");
if (!title) { console.error(`thumb: ${scriptPath} has no title in its front matter`); process.exit(1); }
const [book, kickerPart] = kicker.includes("·") ? kicker.split("·").map((s) => s.trim()) : ["", kicker];
const part = partArg || kickerPart;
const dir = path.dirname(path.resolve(scriptPath));
const out = outArg || path.join(dir, `${path.basename(dir)}-bm_fable.thumb.jpg`);
// a section video's line reads "Chapter 2" with the section's ".1" small beside it (passed as "Section 2.1")
const partHtml = (p) => { const m = p.match(/^Section (\d+)\.(\d+)$/i); return m ? `Chapter ${m[1]}<span class="sec">.${m[2]}</span>` : esc(p); };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Same palette and type as the video's title card (studio.js), but sized for a thumbnail: the title fills the frame.
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=JetBrains+Mono:wght@700&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; width: 1280px; height: 720px; background: #0b0f1a; overflow: hidden; }
  .frame { position: absolute; inset: 0; padding: 40px 60px 120px; display: flex; flex-direction: column; justify-content: center; gap: 26px;
    background: radial-gradient(1100px 620px at 85% 110%, rgba(166,142,255,.20), transparent 60%); }
  .part { font: 700 80px 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: #a68eff; }
  .part .sec { font-size: .5em; letter-spacing: .02em; }
  .title { font: 800 230px/0.98 'Bricolage Grotesque', system-ui, sans-serif; letter-spacing: -.025em; color: #f3f5ff; text-wrap: balance; }
  .book { position: absolute; left: 60px; bottom: 40px; font: 700 50px 'JetBrains Mono', monospace; letter-spacing: .04em; color: #8ea2ff; }
</style></head><body><div class="frame">
  <div class="part">${partHtml(part)}</div><div class="title" id="t">${esc(title)}</div>
</div>${book ? `<div class="book">${esc(book)}</div>` : ""}</body></html>`;

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // shrink the title until it fits in three lines and leaves room for the book line: big as the frame allows
  const size = await page.evaluate(() => {
    const t = document.getElementById("t");
    let px = 230;
    const fits = () => t.getBoundingClientRect().bottom <= 720 - 130 && t.scrollWidth <= t.clientWidth && t.getBoundingClientRect().height <= px * 3.05;
    while (px > 72 && !fits()) { px -= 4; t.style.fontSize = px + "px"; }
    return px;
  });
  await page.screenshot({ path: out, type: "jpeg", quality: 92 });
  await browser.close();
  console.log(`wrote ${out}  (title at ${size}px)`);
})().catch((e) => { console.error(e); process.exit(1); });
