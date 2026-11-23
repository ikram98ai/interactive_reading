// thumb.js <script.md> [out.jpg] [part] — the YouTube thumbnail for a video, sized to be read at the small size YouTube shows
// thumbnails (a phone feed is about 360 px wide). The part line comes from the script's front matter kicker (or `part`, a
// section video's "Section 2.1", drawn "Chapter 2" with a small ".1"). Default out: <script folder>/<folder name>-bm_fable.thumb.jpg.
//
// With a thumb.json beside the script, the thumbnail leads with the video's real title (front matter `title`, up to three
// lines), under it a hook, two short lines that open the question the video answers, and beside them one bold picture of
// the video's machine.
//   { "hook": ["1000× slower.", "*Still wins.*"],   lines; *words* take the accent colour
//     "accent": "green" | "red" | "yellow" | "violet",
//     "rust": true,                                  the Rust logo in orange, for a video ending in Rust
//     "visual": { "kind": "race" | "cards" | "curves" | "tree" | "products" | "hires", ... } }   see the drawers below for each kind's fields
// Without one, it is the plain title card: the chapter and title in large type.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const [scriptPath, outArg, partArg] = process.argv.slice(2);
if (!scriptPath) { console.error("usage: node tools/video/thumb.js <script.md> [out.jpg] [part]"); process.exit(2); }
const src = fs.readFileSync(scriptPath, "utf8");
const front = (src.match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
const field = (k) => ((front.match(new RegExp(`^${k}:\\s*(.+)$`, "m")) || [])[1] || "").trim();
const title = field("title"), kicker = field("kicker");
if (!title) { console.error(`thumb: ${scriptPath} has no title in its front matter`); process.exit(1); }
const [book, kickerPart] = kicker.includes("·") ? kicker.split("·").map((s) => s.trim()) : ["", kicker];
const part = partArg || kickerPart;
const dir = path.dirname(path.resolve(scriptPath));
const out = outArg || path.join(dir, `${path.basename(dir)}-bm_fable.thumb.jpg`);
const specPath = path.join(dir, "thumb.json");
const spec = fs.existsSync(specPath) ? JSON.parse(fs.readFileSync(specPath, "utf8")) : null;

// the Rust logo, for a video that ends in Rust: tools/video/rust-logo.svg, one path, the gear and R drawn in Rust orange
const RUST_LOGO = fs.readFileSync(path.join(__dirname, "rust-logo.svg"), "utf8").replace(/<!--[\s\S]*?-->\s*/, "").trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const partHtml = (p) => { const m = p.match(/^Section (\d+)\.(\d+)$/i); return m ? `Chapter ${m[1]}<span class="sec">.${m[2]}</span>` : esc(p); };
const C = { bg: "#0b0f1a", ink: "#f3f5ff", dim: "#8ea2ff", violet: "#a68eff", red: "#ff5468", green: "#3ee08f", yellow: "#ffd23f", rust: "#f74c00", card: "#1a2035", line: "#2b3352" };
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=JetBrains+Mono:wght@700;800&display=block" rel="stylesheet">`;
const mono = `font-family="JetBrains Mono, monospace" font-weight="800"`;

// ---- the pictures: each draws into a 600 × 600 SVG box, in strokes thick enough to survive a 360 px wide feed ----
const V = {
  // two runners, a bar each; the winner gets a check. rows: [{ label, sub, value, frac (0..1 of the bar), color, win }]
  race(v) {
    const rows = v.rows.map((r, i) => {
      const y = 90 + i * 300, w = Math.max(70, 560 * r.frac), col = C[r.color] || r.color;
      return `<text x="20" y="${y}" ${mono} font-size="50" fill="${C.ink}">${esc(r.label)}</text>
        ${r.sub ? `<text x="20" y="${y + 40}" ${mono} font-size="30" fill="${C.dim}">${esc(r.sub)}</text>` : ""}
        <rect x="20" y="${y + 66}" width="${w}" height="150" rx="20" fill="${col}" fill-opacity=".35" stroke="${col}" stroke-width="8"/>
        <text x="${r.frac > 0.5 ? 20 + w - 26 : 20 + w + 22}" y="${y + 160}" text-anchor="${r.frac > 0.5 ? "end" : "start"}" ${mono} font-size="64" fill="${col}">${esc(r.value)}${r.win ? " ✓" : ""}</text>`;
    });
    return rows.join("");
  },
  // a hand of cards: values, the first `sorted` of them held (violet), card `lift` raised with an arrow to slot `to`
  cards(v) {
    const n = v.values.length, gap = 12, w = (580 - gap * (n - 1)) / n, h = w * 1.4, y0 = 330;
    const x = (i) => 10 + i * (w + gap);
    let s = "";
    v.values.forEach((val, i) => {
      const lifted = i === v.lift, held = i < v.sorted;
      const y = lifted ? y0 - h - 130 : y0, col = lifted ? C.yellow : held ? C.violet : C.line;
      s += `<g transform="rotate(${lifted ? -8 : 0} ${x(i) + w / 2} ${y + h / 2})">
        <rect x="${x(i)}" y="${y}" width="${w}" height="${h}" rx="14" fill="${lifted ? "#3a3210" : held ? "#2a2350" : C.card}" stroke="${col}" stroke-width="6"/>
        <text x="${x(i) + w / 2}" y="${y + h / 2 + 26}" text-anchor="middle" ${mono} font-size="${w * 0.62}" fill="${lifted ? C.yellow : C.ink}">${esc(val)}</text>
        <text x="${x(i) + 16}" y="${y + 34}" font-size="26" fill="${C.red}">♥</text></g>`;
    });
    if (v.lift != null && v.to != null) {
      const sx = x(v.lift) + w / 2 - 20, sy = y0 - 80, ex = x(v.to) + w / 2, ey = y0 - 20;
      s += `<path d="M${sx} ${sy} C ${sx - 60} ${sy + 10}, ${ex + 40} ${y0 - 120}, ${ex} ${ey}" fill="none" stroke="${C.yellow}" stroke-width="9" stroke-linecap="round" marker-end="url(#ah)"/>`;
    }
    s += `<path d="M${x(0)} ${y0 + h + 26} H ${x(v.sorted - 1) + w}" stroke="${C.violet}" stroke-width="7" stroke-linecap="round"/>
      <text x="${(x(0) + x(v.sorted - 1) + w) / 2}" y="${y0 + h + 76}" text-anchor="middle" ${mono} font-size="34" fill="${C.violet}">${esc(v.sortedLabel || "sorted")}</text>`;
    return s;
  },
  // growth curves on bare axes: [{ label, color, power }] — power 1 is a line, 2 a parabola; the steepest ends highest
  curves(v) {
    const X0 = 40, Y0 = 540, W = 400, H = 470;
    let s = `<path d="M${X0} 50 V ${Y0} H ${X0 + W + 30}" fill="none" stroke="${C.line}" stroke-width="7" stroke-linecap="round"/>
      <text x="${X0 + W + 20}" y="${Y0 + 50}" text-anchor="end" ${mono} font-size="34" fill="${C.dim}">${esc(v.x || "n")}</text>
      <text x="${X0 - 10}" y="36" ${mono} font-size="34" fill="${C.dim}">${esc(v.y || "time")}</text>`;
    for (const c of v.lines) {
      const col = C[c.color] || c.color, top = c.top ?? 1, pts = [];
      for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(`${X0 + t * W},${Y0 - H * top * Math.pow(t, c.power)}`); }
      const ey = Y0 - H * top;
      s += `<polyline points="${pts.join(" ")}" fill="none" stroke="${col}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${X0 + W}" cy="${ey}" r="15" fill="${col}"/>
        <text x="${X0 + W + 30}" y="${ey + 16}" ${mono} font-size="44" fill="${col}">${esc(c.label)}</text>`;
    }
    return s;
  },
  // divide and conquer: one block split in half `levels` times, then a cost badge (from struck out, to in the accent)
  tree(v) {
    const levels = v.levels || 4, top = 40, rowH = 92, W = 580;
    let s = "";
    for (let l = 0; l < levels; l++) {
      const k = 2 ** l, gap = 14, w = (W - gap * (k - 1)) / k, y = top + l * rowH;
      for (let i = 0; i < k; i++) {
        const x = 10 + i * (w + gap);
        if (l > 0) { const px = 10 + Math.floor(i / 2) * ((W - gap * (k / 2 - 1)) / (k / 2) + gap) + ((W - gap * (k / 2 - 1)) / (k / 2)) / 2; s += `<path d="M${px} ${y - rowH + 56} L ${x + w / 2} ${y}" stroke="${C.line}" stroke-width="5"/>`; }
        s += `<rect x="${x}" y="${y}" width="${w}" height="56" rx="12" fill="#2a2350" stroke="${C.violet}" stroke-width="6"/>`;
        if (v.values && l === levels - 1) s += `<text x="${x + w / 2}" y="${y + 40}" text-anchor="middle" ${mono} font-size="34" fill="${C.ink}">${esc(v.values[i])}</text>`;
      }
    }
    if (v.from || v.to) {
      const y = top + levels * rowH + 130, fs = 96, cw = fs * 0.6, fw = [...v.from].length * cw, aw = cw * 2.2, tw = [...v.to].length * cw;
      const x0 = 300 - (fw + aw + tw) / 2;
      s += `<text x="${x0}" y="${y}" ${mono} font-size="${fs}" fill="${C.red}" opacity=".85">${esc(v.from)}</text>
        <path d="M${x0 - 8} ${y - 22} L ${x0 + fw + 8} ${y - 50}" stroke="${C.red}" stroke-width="10" stroke-linecap="round"/>
        <path d="M${x0 + fw + 16} ${y - 32} h ${aw - 44}" stroke="${C.dim}" stroke-width="9" stroke-linecap="round" marker-end="url(#ahd)"/>
        <text x="${x0 + fw + aw}" y="${y}" ${mono} font-size="${fs}" fill="${C.green}">${esc(v.to)}</text>`;
    }
    return s;
  },
  // matrix products: A × B in quarters above `of` product slots; the first `keep` filled (P₁, P₂, …), the rest struck out
  products(v) {
    const of = v.of || 8, keep = v.keep ?? 7, perRow = Math.ceil(of / 2), q = 74;
    const grid = (x, name) => [0, 1].flatMap((r) => [0, 1].map((c) =>
      `<rect x="${x + c * (q + 8)}" y="${r * (q + 8)}" width="${q}" height="${q}" rx="10" fill="#2a2350" stroke="${C.violet}" stroke-width="6"/>
       <text x="${x + c * (q + 8) + q / 2}" y="${r * (q + 8) + q / 2 + 13}" text-anchor="middle" ${mono} font-size="36" fill="${C.ink}">${name}<tspan font-size="24" dy="7">${r + 1}${c + 1}</tspan></text>`)).join("");
    const gw = 2 * q + 8, gx = 300 - gw - 40;
    let s = grid(gx, "A") + grid(300 + 40, "B") + `<text x="300" y="${gw / 2 + 20}" text-anchor="middle" ${mono} font-size="64" fill="${C.dim}">×</text>`;
    s += `<path d="M300 ${gw + 22} v 46" stroke="${C.dim}" stroke-width="9" stroke-linecap="round" marker-end="url(#ahd)"/>`;
    const gap = 16, tw = (580 - gap * (perRow - 1)) / perRow, th = 104, ty = gw + 108;
    for (let i = 0; i < of; i++) {
      const x = 10 + (i % perRow) * (tw + gap), y = ty + Math.floor(i / perRow) * (th + gap), kept = i < keep;
      const col = kept ? C.green : C.red;
      s += `<rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="16" fill="${col}" fill-opacity="${kept ? 0.3 : 0.08}" stroke="${col}" stroke-width="7"${kept ? "" : ` stroke-dasharray="16 12" opacity=".8"`}/>`;
      s += kept
        ? `<text x="${x + tw / 2}" y="${y + th / 2 + 18}" text-anchor="middle" ${mono} font-size="52" fill="${C.ink}">P<tspan font-size="34" dy="10">${i + 1}</tspan></text>`
        : `<path d="M${x + 26} ${y + 20} L ${x + tw - 26} ${y + th - 20} M ${x + tw - 26} ${y + 20} L ${x + 26} ${y + th - 20}" stroke="${C.red}" stroke-width="12" stroke-linecap="round"/>`;
    }
    return s;
  },
  // the hiring problem: rows of candidates drawn as bars as tall as their rank; a candidate who beats everyone before
  // them is hired (filled in the row's colour), the rest stay grey. rows: [{ label, values, color, win }]
  hires(v) {
    const max = Math.max(...v.rows.flatMap((r) => r.values));
    return v.rows.map((r, i) => {
      const y = 50 + i * 316, col = C[r.color] || r.color, n = r.values.length, gap = 12, w = (580 - gap * (n - 1)) / n, base = y + 226;
      let best = -Infinity, hired = 0, s = "";
      r.values.forEach((val, k) => {
        const hire = val > best; if (hire) { best = val; hired++; }
        const h = 44 + (val - 1) / (max - 1) * 132, x = 10 + k * (w + gap);
        s += `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" rx="10" fill="${hire ? col : C.card}" fill-opacity="${hire ? 0.35 : 1}" stroke="${hire ? col : C.line}" stroke-width="6"/>
          <text x="${x + w / 2}" y="${base - 12}" text-anchor="middle" ${mono} font-size="30" fill="${hire ? C.ink : "#5d6890"}">${esc(val)}</text>`;
      });
      return `<text x="10" y="${y}" ${mono} font-size="50" fill="${C.ink}">${esc(r.label)}</text>
        <text x="590" y="${y}" text-anchor="end" ${mono} font-size="50" fill="${col}">${hired} hire${hired === 1 ? "" : "s"}${r.win ? " ✓" : ""}</text>${s}`;
    }).join("");
  },
};

const hookLine = (l) => esc(l).replace(/\*([^*]+)\*/g, '<em>$1</em>');
const glow = { race: "62,224,143", cards: "255,210,63", curves: "255,84,104", tree: "166,142,255", products: "166,142,255", hires: "62,224,143" };

function hookHtml() {
  const accent = C[spec.accent] || spec.accent || C.yellow;
  const v = spec.visual, rgb = glow[v.kind] || "166,142,255";
  if (!V[v.kind]) { console.error(`thumb: unknown visual kind "${v.kind}" in ${specPath}`); process.exit(1); }
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html, body { margin: 0; width: 1280px; height: 720px; background: ${C.bg}; overflow: hidden; }
  .bg { position: absolute; inset: 0; background:
      radial-gradient(560px 460px at 78% 48%, rgba(${rgb},.22), transparent 70%),
      radial-gradient(900px 500px at 0% 100%, rgba(166,142,255,.14), transparent 60%); }
  .left { position: absolute; left: 56px; top: 40px; bottom: 40px; width: 600px; display: flex; flex-direction: column; justify-content: center; gap: 18px; }
  .part { font: 800 46px 'JetBrains Mono', monospace; letter-spacing: .05em; text-transform: uppercase; color: ${C.violet}; }
  .part .sec { font-size: .55em; letter-spacing: .02em; }
  .vt { font: 800 104px/0.98 'Bricolage Grotesque', system-ui, sans-serif; letter-spacing: -.03em; color: ${C.ink};
    text-shadow: 0 6px 0 rgba(0,0,0,.55); text-wrap: balance; }
  .hook { font: 800 76px/1.02 'Bricolage Grotesque', system-ui, sans-serif; letter-spacing: -.02em; color: #c9d0ee;
    text-shadow: 0 5px 0 rgba(0,0,0,.55); margin-top: 6px; }
  .hook div { white-space: nowrap; }
  .hook em { font-style: normal; color: ${accent}; }
  .book { font: 700 30px 'JetBrains Mono', monospace; letter-spacing: .03em; color: ${C.dim}; margin-top: 8px; }
  svg.pic { position: absolute; left: 690px; right: 44px; top: ${spec.rust ? 190 : 70}px; bottom: 60px; width: auto; height: auto; overflow: visible; filter: drop-shadow(0 10px 24px rgba(0,0,0,.6)); }
  .rust { position: absolute; right: 36px; top: 18px; width: 160px; height: 160px; transform: rotate(8deg); }
  .rust svg { width: 100%; height: 100%; fill: ${C.rust}; filter: drop-shadow(0 6px 0 #6e2200) drop-shadow(0 0 22px rgba(247,76,0,.45)); }
</style></head><body><div class="bg"></div>
  <svg class="pic" id="pic" viewBox="0 0 600 600" width="546" height="${spec.rust ? 470 : 590}"><defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="${C.yellow}"/></marker>
    <marker id="ahd" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${C.dim}"/></marker></defs>${V[v.kind](v)}</svg>
  ${spec.rust ? `<div class="rust">${RUST_LOGO}</div>` : ""}
  <div class="left"><div class="part">${partHtml(part)}</div>
    <div class="vt" id="vt">${esc(title)}</div>
    <div class="hook" id="t">${spec.hook.map((l) => `<div>${hookLine(l)}</div>`).join("")}</div>
    ${book ? `<div class="book">${esc(book)}</div>` : ""}</div>
</body></html>`;
}

// the plain title card: same palette and type as the video's title card (studio.js), the title filling the frame
function titleHtml() {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html, body { margin: 0; width: 1280px; height: 720px; background: ${C.bg}; overflow: hidden; }
  .frame { position: absolute; inset: 0; padding: 40px 60px 120px; display: flex; flex-direction: column; justify-content: center; gap: 26px;
    background: radial-gradient(1100px 620px at 85% 110%, rgba(166,142,255,.20), transparent 60%); }
  .part { font: 700 80px 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: ${C.violet}; }
  .part .sec { font-size: .5em; letter-spacing: .02em; }
  .title { font: 800 230px/0.98 'Bricolage Grotesque', system-ui, sans-serif; letter-spacing: -.025em; color: ${C.ink}; text-wrap: balance; }
  .book { position: absolute; left: 60px; bottom: 40px; font: 700 50px 'JetBrains Mono', monospace; letter-spacing: .04em; color: ${C.dim}; }
</style></head><body><div class="frame">
  <div class="part">${partHtml(part)}</div><div class="title" id="t">${esc(title)}</div>
</div>${book ? `<div class="book">${esc(book)}</div>` : ""}</body></html>`;
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.setContent(spec ? hookHtml() : titleHtml(), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { const svg = document.getElementById("pic"); if (!svg) return;
    const b = svg.getBBox(), p = 12; svg.setAttribute("viewBox", `${b.x - p} ${b.y - p} ${b.width + 2 * p} ${b.height + 2 * p}`); });
  const size = await page.evaluate((hook) => {
    const t = document.getElementById("t");
    if (hook) {
      // the video's title, at most three lines, and the hook's lines, all in the left column beside the picture
      const vt = document.getElementById("vt"), left = t.parentElement;
      const lines = (el, lh) => Math.round(el.getBoundingClientRect().height / lh);
      let a = 104, b = 76;
      while (a > 56 && (vt.scrollWidth > 600 || lines(vt, a * 0.98) > 3)) { a -= 4; vt.style.fontSize = a + "px"; }
      if (b > a * 0.8) { b = Math.round(a * 0.8); t.style.fontSize = b + "px"; }   // the hook never outsizes the title
      while (b > 44 && t.scrollWidth > 600) { b -= 2; t.style.fontSize = b + "px"; }
      while ((a > 56 || b > 44) && left.scrollHeight > left.clientHeight) {
        if (a > 56) { a -= 4; vt.style.fontSize = a + "px"; } if (b > 44) { b -= 2; t.style.fontSize = b + "px"; } }
      return `${a}/${b}`;
    }
    let px = 230;
    const fits = () => t.getBoundingClientRect().bottom <= 720 - 130 && t.scrollWidth <= t.clientWidth && t.getBoundingClientRect().height <= px * 3.05;
    while (px > 72 && !fits()) { px -= 4; t.style.fontSize = px + "px"; }
    return px;
  }, !!spec);
  await page.screenshot({ path: out, type: "jpeg", quality: 92 });
  await browser.close();
  console.log(`wrote ${out}  (${spec ? "title/hook" : "title"} at ${size}px)`);
})().catch((e) => { console.error(e); process.exit(1); });
