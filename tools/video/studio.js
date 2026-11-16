#!/usr/bin/env node
/* studio.js <manifest.json> [out.mp4] — by default the video lands in its chapter's folder, videos/<book>/<ch>/. Record a narrated video of one or more scenes at 1920×1080 in dark mode.
   Playwright drives the page; frames come straight from Chrome (lossless PNG, Page.startScreencast) because Playwright's own
   recordVideo is capped at a low bitrate that blurs text.

   The look: only the picture is on screen. Controls, captions and the page's chrome are gone, nothing shows a cursor or a click,
   and the code and counters stay hidden until the narration names them. A viewer looks at whatever just changed, so each cue
   should change one thing, and most of the time nothing should be moving.

   manifest.json comes from narrate.py. Each segment plays its clip, firing its cues at their word times; `then` is a silent
   pause or {await}, which holds the narration until the animation has finished. So the narration can never talk over a
   machine that is still running, and the audio is laid down afterwards at the moments each clip really started.

   Cues: scene · focus <target[+target]> | off · click <label> [xN] (a button's text, or a tappable SVG group's aria-label) · slider <index> <value> · speed <x> · card <big | small>
         show <target[+target]> · hide <target[+target]>  (fades; css: targets only, and instant while a card covers the screen)
         center · split  (the picture alone in the middle, or on the left with the code panel beside it)
         label <text>  (a small heading at the top of the frame; {label} alone clears it)
         rust · pseudo  (the code panel shows the Rust program, with its stack and heap underneath, or the book's pseudocode)
         title · item <text>  (the title card, then one line of "what you'll learn" on it per item, each on its word)
         goto <scene id | kicker | heading>  (a section card covers the switch to that scene; {scene} lifts it; each goto is a YouTube chapter)
         goto <scene id>  (a quick dip to black instead: a second scene inside the same part, and no new chapter)
   A manifest with a `part` (assemble.js) records one part of a long form: it starts under its own card, with the layers
   earlier parts hid still hidden, and ends on the next part's card instead of black, so the parts join without a seam.
   Every scene starts the same way: pseudocode, code panel and stats hidden, picture centred. The script reveals the rest.
         check <selector> ~ <text>  (fails the run if the page doesn't show what the narration claims)
   A code video (kind: code) records tools/video/editor.html instead, starting from snapshot `start` if the script sets one:
         code <name> [fast|paste]  (type into that snapshot while the voice goes on, paced to fill the narration until
                              the next code, select or run cue; paste drops each new block in at once, for code brought
                              back from an earlier video) · select <text> [#n] · unselect · run (the program's real output, or
                              its compiler error, from narrate.py) · close  (hide the run panel) · and title, item, scene,
                              label, card and check as above (the run panel is #out)
   Targets: svg:x,y,w,h (viewBox units of the machine) · css:<selector> · stat:<label> · btn:<label> · code:<a[-b]> (pseudocode lines)
   · rs:<a[-b]> (Rust lines) · mem:x,y,w[,h] (viewBox units of the stack-and-heap strip) · slider:<i>
   · panel, stats, memory, stack, heap (built in) · or a name from the script's `targets:` block. */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { chromium } = require("playwright-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = path.resolve(__dirname, "../..");
const W = 1920, H = 1080, ZOOM = 1.34;
// targets every scene has, so every chapter's script can use the same names
const BUILTIN = { panel: "css:.is-full > .codepane", stats: "css:.is-full > .statrow", memory: "css:.is-full .memstrip", stack: "mem:6,0,322", heap: "mem:342,0,316" };

// Page-only layout for the video. The picture and the stats share the left column and the code panel fills the right, with nothing
// else on screen. .vid-center slides the left column to the middle of the frame while the code panel is hidden.
const CSS = `
.wrap .stage.is-full { zoom: ${ZOOM}; inset: 0; width: calc(100vw / ${ZOOM}); height: calc(100vh / ${ZOOM}) !important;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; background-color: var(--bg); }
.stage.is-full > .stage-head, .stage.is-full > .controls, .stage.is-full > .caption, .cp-lens { display: none !important; }
html:not(.vid-rust) .memstrip, .stage:not(.is-full) [id$="-mem"] { display: none !important; }
.stage.is-full .memstrip { background: none; border: 0; margin-top: 22px; animation: vid-in .45s ease both; }
.stage.is-full .memstrip .mem-head { display: none; }
@keyframes vid-in { from { opacity: 0; } to { opacity: 1; } }
.wrap .stage.is-full { transition: grid-template-columns .5s ease; }
.vid-rust .wrap .stage.is-full:not(.no-code) { grid-template-columns: minmax(0, 1fr) minmax(0, 1.22fr); }
.vid-rust .stage.is-full .codepane > .cp-body { max-height: 40vh; } /* the engine scrolls the running line into view */
.vid-rust .stage.is-full .cp-body ol { font-size: 12.5px; line-height: 1.6; }
.stage.is-full > .stage-scroll { overflow: hidden !important; padding: 44px 8px 0; transition: transform .6s cubic-bezier(.3, .7, .2, 1); }
.stage.is-full > .statrow { justify-content: center; gap: 56px; padding: 0 0 44px; border: 0; background: none; transition: transform .6s cubic-bezier(.3, .7, .2, 1), opacity .4s ease; }
.stage.is-full > .statrow .stat { background: none; border: 0; padding: 0; min-width: 0; align-items: center; }
.stage.is-full > .statrow .stat .k { font-size: 12px; }
.stage.is-full > .statrow .stat .v { font-size: 34px; }
.vid-center .stage.is-full:not(.no-code) > .stage-scroll { transform: translateX(40%) scale(1.3); }
.vid-center .stage.is-full:not(.no-code) > .statrow { transform: translateX(40%); }
.stage.is-full .ac-i { transition: opacity .4s ease; } .vid-center .stage.is-full:not(.no-code) .ac-i { opacity: 0; } /* indices belong with the code */
.stage.is-full > .codepane { grid-row: 1 / -1; background: none; border: 0; justify-content: center; padding: 0 28px 0 0; transition: opacity .4s ease; }
.stage.is-full .codepane > .cp-head { display: none; }
.stage.is-full .codepane > .cp-body { flex: none; background: none; border: 0; overflow: hidden !important; border-radius: 12px; }
.stage.is-full .cp-body ol { font-size: 15px; line-height: 1.85; padding: 0; }
.stage.is-full .cp-body li { transition: background-color .25s ease; }
.stage.is-full .cp-note { white-space: nowrap; }
.stage.is-full .cp-out { display: none !important; } /* the picture already shows the result */
.vid-quiet .cp-body li.on { background: none; box-shadow: none; } .vid-quiet .cp-note { opacity: 0; } /* while the narration walks the listing */
.stage.is-full .ac-v { font-size: 18px; }
.vid-part { transition: opacity .4s ease; }
html, body { cursor: none !important; } * { scrollbar-width: none !important; }
`;

// Runs inside the page. Everything is drawn above the stage and never touches the book's own code.
function overlayScript() {
  const FONT = "Bricolage Grotesque, Atkinson Hyperlegible, system-ui, sans-serif";
  const root = document.createElement("div");
  root.id = "vid-overlay";
  root.style.cssText = "position:fixed;inset:0;z-index:100000;pointer-events:none;";
  root.innerHTML = `
    <div id="vid-rings"></div>
    <div id="vid-label" style="position:absolute;left:0;right:0;top:46px;text-align:center;font:700 34px ${FONT};letter-spacing:-.005em;color:#a68eff;opacity:0;transition:opacity .35s ease,transform .35s ease;transform:translateY(8px)"></div>
    <div id="vid-title" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center;
      background:#0d1220;transition:opacity .5s ease;padding:0 180px;">
      <div id="vid-kicker" style="font:500 26px 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#8ea2ff"></div>
      <div id="vid-head" style="font:800 84px/1.08 ${FONT};color:#f3f5ff;letter-spacing:-.015em;text-wrap:balance"></div>
      <ol id="vid-list" style="list-style:none;margin:18px 0 0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,560px));gap:16px 56px;text-align:left;font:500 31px/1.25 'Atkinson Hyperlegible',system-ui;color:#c9d2ee;counter-reset:n"></ol>
    </div>
    <div id="vid-card" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;text-align:center;
      background:#0d1220;opacity:0;transition:opacity .45s ease;padding:0 170px;">
      <div id="vid-card-a" style="font:800 80px/1.12 ${FONT};color:#f3f5ff;letter-spacing:-.01em;text-wrap:balance"></div>
      <div id="vid-card-b" style="font:400 38px/1.3 'Atkinson Hyperlegible',system-ui;color:#aeb9dc;text-wrap:balance"></div>
    </div>
    <div id="vid-black" style="position:absolute;inset:0;background:#000;opacity:0;transition:opacity .8s linear"></div>`;
  document.body.appendChild(root);
  const $ = (id) => document.getElementById(id);
  const ACCENT = "#ffc857", PAD = 9, EASE = 0.2;

  const stage = () => document.querySelector(".is-full");
  const main = () => stage().querySelector(".stage-scroll > svg");
  function resolve(t) {
    const i = t.indexOf(":"), kind = t.slice(0, i), arg = t.slice(i + 1), s = stage();
    if (kind === "svg") {
      const [x, y, w, h] = arg.split(",").map(Number), svg = main(), r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      const k = Math.min(r.width / vb.width, r.height / vb.height), ox = r.left + (r.width - vb.width * k) / 2, oy = r.top + (r.height - vb.height * k) / 2;
      return [{ left: ox + (x - vb.x) * k, top: oy + (y - vb.y) * k, width: w * k, height: h * k }];
    }
    if (kind === "css") return [...document.querySelectorAll(arg)].map((e) => e.getBoundingClientRect());
    if (kind === "btn") return [...s.querySelectorAll("button")].filter((b) => b.textContent.trim() === arg).map((e) => e.getBoundingClientRect());
    if (kind === "stat") return [...s.querySelectorAll(".statrow > *")].filter((e) => e.textContent.toLowerCase().includes(arg.toLowerCase())).map((e) => e.getBoundingClientRect());
    if (kind === "slider") { const inp = s.querySelectorAll("input[type=range]")[+arg]; return inp ? [(inp.closest("label") || inp.parentElement).getBoundingClientRect()] : []; }
    if (kind === "mem") { // the stack-and-heap strip, in its own viewBox units; leave out h to run to the bottom
      const m = s.querySelector(".memstrip svg"); if (!m) return [];
      const [x, y, w, hh] = arg.split(",").map(Number), r = m.getBoundingClientRect(), vb = m.viewBox.baseVal, k = r.width / vb.width;
      return [{ left: r.left + x * k, top: r.top + y * k, width: w * k, height: (hh || vb.height - y) * k }];
    }
    if (kind === "rs") { // Rust lines, counted from 1 as the listing shows them
      const [a, b] = arg.split("-").map(Number), pick = [...s.querySelectorAll(".cp-body li")].slice(a - 1, b || a);
      if (!pick.length) return [];
      const rs = pick.map((e) => e.getBoundingClientRect()), l = Math.min(...rs.map((r) => r.left)), t2 = Math.min(...rs.map((r) => r.top));
      return [{ left: l, top: t2, width: Math.max(...rs.map((r) => r.right)) - l, height: Math.max(...rs.map((r) => r.bottom)) - t2 }];
    }
    if (kind === "code") { // line N is the Nth list item after the procedure's header line, as the page numbers them
      const [a, b] = arg.split("-").map(Number), pick = [...s.querySelectorAll(".cp-body li")].filter((li, n) => n >= a && n <= (b || a));
      if (!pick.length) return [];
      const rs = pick.map((e) => e.getBoundingClientRect()), l = Math.min(...rs.map((r) => r.left)), t2 = Math.min(...rs.map((r) => r.top));
      return [{ left: l, top: t2, width: Math.max(...rs.map((r) => r.right)) - l, height: Math.max(...rs.map((r) => r.bottom)) - t2 }];
    }
    return [];
  }
  const state = { targets: [], rects: [] };
  function tick() {
    const goal = state.targets.flatMap((t) => { try { return resolve(t).filter((r) => r && r.width > 0 && r.height > 0); } catch (e) { return []; } })
      .map((r) => {
        const x = Math.max(6, r.left - PAD), y = Math.max(6, r.top - PAD); // keep the whole ring inside the frame
        return { x, y, w: Math.min(innerWidth - 6, r.left + r.width + PAD) - x, h: Math.min(innerHeight - 6, r.top + r.height + PAD) - y };
      });
    while (state.rects.length < goal.length) {
      const g = goal[state.rects.length];
      // a new spotlight grows out of its own centre
      state.rects.push({ x: g.x + g.w / 2 - 20, y: g.y + g.h / 2 - 20, w: 40, h: 40, a: 0, el: null });
    }
    state.rects.forEach((r, i) => {
      const g = goal[i];
      if (g) { r.x += (g.x - r.x) * EASE; r.y += (g.y - r.y) * EASE; r.w += (g.w - r.w) * EASE; r.h += (g.h - r.h) * EASE; r.a += (1 - r.a) * EASE; }
      else r.a += (0 - r.a) * (EASE * 1.3);
    });
    state.rects = state.rects.filter((r) => { if (r.a < 0.01 && !goal[state.rects.indexOf(r)]) { if (r.el) r.el.remove(); return false; } return true; });
    state.rects.forEach((r) => {
      if (!r.el) { r.el = document.createElement("div"); $("vid-rings").appendChild(r.el); r.el.style.cssText = `position:absolute;left:0;top:0;border:2.5px solid ${ACCENT};border-radius:12px;box-sizing:border-box;`; }
      r.el.style.transform = `translate(${r.x}px,${r.y}px)`; r.el.style.width = r.w + "px"; r.el.style.height = r.h + "px"; r.el.style.opacity = r.a;
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  window.__vid = {
    title(show, a, b) { if (a != null) { $("vid-kicker").textContent = b; $("vid-head").textContent = a; } $("vid-list").innerHTML = ""; $("vid-title").style.opacity = show ? 1 : 0; },
    item(text) {
      const li = document.createElement("li"), n = $("vid-list").children.length + 1;
      li.innerHTML = `<span style="font:700 22px 'JetBrains Mono',monospace;color:#8ea2ff;margin-right:16px">${String(n).padStart(2, "0")}</span>`;
      li.appendChild(document.createTextNode(text));
      li.style.cssText = "opacity:0;transform:translateY(10px);transition:opacity .35s ease,transform .35s ease";
      $("vid-list").appendChild(li); requestAnimationFrame(() => requestAnimationFrame(() => { li.style.opacity = 1; li.style.transform = "none"; }));
    },
    async lang(rust) {
      const was = window.AL && AL.CODE_LANG.v;
      document.documentElement.classList.toggle("vid-rust", rust);
      if (window.AL) AL.CODE_LANG.set(rust ? "rust" : "pseudo");
      return was;
    },
    fresh() { // how every scene starts: nothing that the narration hasn't named
      this.label(""); state.targets = []; $("vid-card").style.opacity = 0;
      document.documentElement.classList.remove("vid-rust", "vid-quiet");
      if (window.AL) AL.CODE_LANG.set("pseudo");
      this.show([".is-full > .codepane", ".is-full > .statrow"], false);
      this.center(true);
    },
    dip(on) { const b = $("vid-black"); b.style.transition = "opacity .3s ease"; b.style.opacity = on ? 1 : 0; },
    focus(list) {
      state.targets = list; document.documentElement.classList.toggle("vid-quiet", list.some((t) => /^(code|rs):/.test(t)));
      list.filter((t) => /^(code|rs):/.test(t)).forEach((t) => this.reveal(t));
    },
    reveal(t) { // scroll a focused line range into the code panel's view, as the page does for its running line
      const body = stage().querySelector(".cp-body"); if (!body) return;
      const [a, b] = t.slice(t.indexOf(":") + 1).split("-").map(Number), lis = [...body.querySelectorAll("li")], k = t.startsWith("rs:") ? 1 : 0;
      const first = lis[a - k], last = lis[(b || a) - k] || first; if (!first) return;
      const top = first.offsetTop, bottom = last.offsetTop + last.offsetHeight;
      if (top < body.scrollTop + 6) body.scrollTop = Math.max(0, top - 24);
      else if (bottom > body.scrollTop + body.clientHeight - 6) body.scrollTop = bottom - body.clientHeight + 24;
    },
    show(sels, on) {
      const instant = $("vid-title").style.opacity !== "0" || $("vid-card").style.opacity === "1" || $("vid-black").style.opacity === "1"; // nothing below a card is visible yet
      // a rule as well as the inline style, so a layer stays hidden when its machine redraws the whole picture
      let sheet = $("vid-hidden"); if (!sheet) { sheet = document.createElement("style"); sheet.id = "vid-hidden"; document.head.appendChild(sheet); }
      const rules = new Set(sheet.textContent.split("\n").filter(Boolean));
      sels.forEach((sel) => rules[on ? "delete" : "add"](`${sel} { opacity: 0; }`));
      sheet.textContent = [...rules].join("\n");
      sels.forEach((sel) => document.querySelectorAll(sel).forEach((e) => {
        e.classList.add("vid-part");
        if (instant) e.style.transition = "none";
        e.style.opacity = on ? 1 : 0;
        if (instant) requestAnimationFrame(() => requestAnimationFrame(() => { e.style.transition = ""; }));
      }));
    },
    center(on) { document.documentElement.classList.toggle("vid-center", on); },
    label(text) { const l = $("vid-label"); if (text) l.textContent = text; l.style.opacity = text ? 1 : 0; l.style.transform = text ? "none" : "translateY(8px)"; },
    hideTitle() { $("vid-title").style.opacity = 0; $("vid-card").style.opacity = 0; }, // {scene}: back to the picture
    section(kicker, head) { state.targets = []; this.label(""); $("vid-list").innerHTML = ""; $("vid-kicker").textContent = kicker; $("vid-head").textContent = head; $("vid-title").style.opacity = 1; $("vid-card").style.opacity = 0; },
    card(a, b) { $("vid-card-a").textContent = a; $("vid-card-b").textContent = b || ""; $("vid-card").style.opacity = 1; },
    black() { $("vid-black").style.opacity = 1; },
    // a button by its text, or a tappable SVG group (AL.clickable: role=button) by its aria-label
    find(label, live) { return [...stage().querySelectorAll("button, [role=button]")].find((x) => (x.tagName === "BUTTON" ? x.textContent.trim() : x.getAttribute("aria-label")) === label && !(live && x.disabled)); },
    enabled(label) { const b = this.find(label); return b ? !b.disabled : null; },
    caption() { const c = stage().querySelector(".caption"); return c ? c.textContent.trim() : ""; },
    press(label) {
      const b = this.find(label, true); if (!b) return false;
      if (b.tagName === "BUTTON") { b.click(); window.__lastBtn = b; } else b.dispatchEvent(new MouseEvent("click", { bubbles: true })); // SVG has no .click()
      return true;
    },
    async slideTo(i, v, ms = 800) {
      const inp = stage().querySelectorAll("input[type=range]")[i], a = +inp.value, st = +inp.step || 1, t0 = performance.now();
      await new Promise((done) => { (function f() { const k = Math.min(1, (performance.now() - t0) / ms), val = Math.round((a + (v - a) * k) / st) * st; if (+inp.value !== val) { inp.value = val; inp.dispatchEvent(new Event("input", { bubbles: true })); } k < 1 ? requestAnimationFrame(f) : done(); })(); });
      inp.value = v; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true }));
    },
    busy() { const b = window.__lastBtn; return !!(b && b.isConnected && b.disabled); },
  };
}

(async () => {
  const mf = path.resolve(process.argv[2]), M = JSON.parse(fs.readFileSync(mf, "utf8")), meta = M.meta;
  const dir = path.dirname(mf), frames = path.join(dir, "frames");
  const out = path.resolve(process.argv[3] || M.out);
  const EDITOR = meta.kind === "code"; // a code video records the editor, not a chapter page
  fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
  const named = (t) => t.split("+").map((x) => { const k = x.trim(), v = meta.targets[k] || BUILTIN[k]; if (v) return v; if (/^(svg|css|btn|stat|code|rs|mem|slider):/.test(k)) return k; throw new Error("unknown target " + k); });
  // check every target name before spending minutes on a recording
  M.segments.forEach((s) => s.cues.forEach((c) => {
    if (c.op === "focus" && c.arg !== "off") named(c.arg);
    if (c.op === "show" || c.op === "hide") named(c.arg).forEach((x) => { if (!x.startsWith("css:")) throw new Error(`{${c.op}} takes css: targets, not ${x}`); });
  }));

  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--hide-scrollbars", "--allow-file-access-from-files", "--force-color-profile=srgb", "--disable-lcd-text", "--font-render-hinting=none"] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: "dark" });
  await ctx.addInitScript((seed) => {
    try { localStorage.setItem("datatown-theme", "dark"); } catch (e) {} // the site's theme is this key, not prefers-color-scheme
    Element.prototype.requestFullscreen = undefined; // the page's own .is-full layout; native fullscreen would resize the headless window
    let a = seed >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, +meta.seed || 1);
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push("page error: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) problems.push("console: " + m.text()); });
  async function openEditor() { // the editor (tools/video/editor.html), with the same title, label and cards as a page
    await page.goto("file://" + path.join(ROOT, "tools/video/editor.html"), { waitUntil: "load" });
    await page.evaluate(() => window.__ed.ready());
    await page.evaluate(overlayScript);
    await page.addStyleTag({ content: "#vid-label { top: 14px !important; }" }); // inside the tab bar, clear of the code
    await page.evaluate((n) => window.__ed.name(n), M.file || "main.rs");
    const cols = Math.max(0, ...Object.values(M.code || {}).flatMap((t) => t.split("\n").map((l) => l.length)));
    if (cols > 72) console.log(`widest line is ${cols} characters: font ${(await page.evaluate((c) => window.__ed.fit(c), cols)).toFixed(1)} px`);
    if (meta.start) await page.evaluate((t) => window.__ed.set(t), M.code[meta.start]);
  }
  if (EDITOR) { // a code video: the editor instead of a chapter page
    await openEditor();
    await page.evaluate(() => window.__vid.title(true, "", ""));
  } else {
  await page.goto("file://" + path.join(ROOT, meta.page), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: CSS });
  await page.evaluate(overlayScript);
  await page.evaluate(() => window.__vid.title(true, "", "")); // a cold open: the first {scene} fades straight into the picture
  await page.evaluate((id) => { const s = document.getElementById(id); s.scrollIntoView(); s.querySelector(".fs-btn").click(); if (window.K) K.speed.value = 1; window.__vid.fresh(); }, meta.scene);
  }
  // One part of a long form (assemble.js), on a page of its own: set it up off camera as the whole video would have it
  // here. The layers earlier parts hid stay hidden, and the part's own card is already up (the part before it faded it in).
  const P = M.part;
  if (P) {
    for (const [op, arg] of P.prelude) await page.evaluate(([l, on]) => window.__vid.show(l, on), [named(arg).map((x) => x.slice(4)), op === "show"]);
    if (P.enter) await page.evaluate(([k, h]) => window.__vid.section(k, h), P.enter);
  }
  await sleep(900);

  // capture
  const cdp = await ctx.newCDPSession(page);
  const stamps = []; let writing = Promise.resolve(), nFrames = 0;
  cdp.on("Page.screencastFrame", (f) => {
    const n = ++nFrames, file = path.join(frames, `f${String(n).padStart(6, "0")}.png`);
    stamps.push([file, f.metadata.timestamp]);
    writing = writing.then(() => fs.promises.writeFile(file, Buffer.from(f.data, "base64")));
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1, maxWidth: W, maxHeight: H });
  await sleep(200);
  const t0 = Date.now(), now = () => (Date.now() - t0) / 1000;
  const log = (s) => console.log(`${now().toFixed(1).padStart(6)}s  ${s}`);

  const chapters = [];
  let entered = !(P && P.enter); // a part's first card is already up: its goto only swaps the scene beneath it
  // The editor types while the voice goes on. Each {code} gets the time until the next cue that needs the finished text
  // ({code}, {select}, {run}) or the end of the narration, and types at the pace that fills it, so the typing neither
  // runs silent nor lags the words that describe it. If it still runs over, the next such cue waits, and the log says so.
  let snap = meta.start || null, typing = null, typedText = meta.start ? M.code[meta.start] : "";
  const plan = []; { let clock = 0; M.segments.forEach((s) => { s.cues.forEach((c) => plan.push([clock + (c.t || 0), c])); clock += s.dur + (s.then && s.then.pause != null ? s.then.pause : s.gap || 0); }); plan.end = clock; }
  const typed = (from, to) => { // characters to type going from one text to the next: the lines of the goal the old text doesn't have
    const have = new Map(); from.split("\n").forEach((l) => have.set(l, (have.get(l) || 0) + 1));
    let n = 0, hunks = 0, prev = true;
    for (const l of to.replace(/\s+$/, "").split("\n")) { const k = have.get(l) || 0; if (k) { have.set(l, k - 1); prev = true; } else { n += l.trimStart().length + 1; if (prev) hunks++; prev = false; } }
    return [n, hunks];
  };
  async function finishTyping(why) {
    if (!typing) return;
    const w0 = now(); await typing; typing = null;
    const over = now() - w0; if (over > 0.4) log(`typing ran ${over.toFixed(1)} s past the narration, before ${why}`);
  }
  async function run(c) {
    const a = c.arg;
    if (EDITOR && c.op === "code") {
      await finishTyping(`{code ${a}}`);
      const [name, mode] = a.split(/\s+/), goal = M.code[name], fast = mode === "fast", paste = mode === "paste";
      if (goal == null) { problems.push(`no snapshot @${name}`); return; }
      const i = plan.findIndex(([, x]) => x === c), next = plan.slice(i + 1).find(([, x]) => ["code", "select", "run"].includes(x.op));
      const [chars, hunks] = typed(typedText, goal), room = Math.max(1, (next ? next[0] : plan.end) - plan[i][0] - 0.5 - hunks * 0.6);
      const cps = Math.min(90, Math.max(fast ? 40 : 14, (chars * 1.3) / room));
      typing = page.evaluate(([t, cps, paste]) => window.__ed.to(t, { cps, paste }), [goal, cps, paste]);
      snap = name; typedText = goal;
      log(paste ? `code @${name}: ${chars} characters pasted in ${hunks} block(s)` : `code @${name}: ${chars} characters at ${cps.toFixed(0)} a second`);
      return;
    }
    if (EDITOR && c.op === "select") {
      await finishTyping(`{select ${a}}`);
      const [, text, nth] = a.match(/^(.*?)(?:\s+#(\d+))?$/);
      if (!(await page.evaluate(([t, n]) => window.__ed.select(t, n), [text, +nth || 1]))) problems.push(`{select ${a}}: not in @${snap}`);
      return;
    }
    if (EDITOR && c.op === "unselect") { await page.evaluate(() => window.__ed.unselect()); return; }
    if (EDITOR && c.op === "run") {
      await finishTyping("{run}");
      const r = M.runs[snap]; if (!r) { problems.push(`{run} on @${snap}, which narrate.py didn't run`); return; }
      await page.evaluate(([cmd, out, ok]) => window.__ed.run(cmd, out, ok), [M.run_cmd || "rustc main.rs && ./main", r.out, r.ok]);
      log(`run @${snap} → ${r.ok ? "ok" : "error"}: ${r.out.split("\n")[0].slice(0, 80)}`);
      return;
    }
    if (EDITOR && c.op === "close") { await page.evaluate(() => window.__ed.close()); await sleep(200); return; }
    if (c.op === "scene") { await page.evaluate(() => window.__vid.hideTitle()); }
    else if (c.op === "goto") {
      const [id, kicker, head] = a.split("|").map((v) => v.trim());
      const card = head != null;
      if (card) {
        chapters.push([now(), head]);
        if (entered) { await page.evaluate(([k, h]) => window.__vid.section(k, h), [kicker, head]); await sleep(750); } // the card has faded in
        entered = true;
      }
      else { await page.evaluate(() => window.__vid.dip(true)); await sleep(330); }
      await page.evaluate((id) => { const s = document.getElementById(id); if (!s.querySelector(".is-full")) { s.scrollIntoView(); s.querySelector(".fs-btn").click(); } K.speed.value = 1; window.__lastBtn = null; window.__vid.fresh(); }, id);
      await sleep(card ? 500 : 250);
      if (!card) await page.evaluate(() => window.__vid.dip(false));
      log(`goto ${id}`);
    }
    else if (c.op === "title") { await page.evaluate(([a, b]) => window.__vid.title(true, a, b), [meta.title, meta.kicker]); log("title"); }
    else if (c.op === "item") { await page.evaluate((v) => window.__vid.item(v), a); log(`item ${a}`); }
    else if (c.op === "rust" || c.op === "pseudo") { await page.evaluate((r) => window.__vid.lang(r), c.op === "rust"); await sleep(60); }
    else if (c.op === "focus") { await page.evaluate((l) => window.__vid.focus(l), a === "off" ? [] : named(a)); }
    else if (c.op === "show" || c.op === "hide") { await page.evaluate(([l, on]) => window.__vid.show(l, on), [named(a).map((x) => x.slice(4)), c.op === "show"]); }
    else if (c.op === "center" || c.op === "split") { await page.evaluate((on) => window.__vid.center(on), c.op === "center"); }
    else if (c.op === "label") { await page.evaluate((v) => window.__vid.label(v), a); }
    else if (c.op === "speed") { await page.evaluate((v) => { K.speed.value = v; }, +a); }
    else if (c.op === "card") { const [x, y] = a.split("|").map((v) => v.trim()); await page.evaluate(([p, q]) => window.__vid.card(p, q), [x, y]); }
    else if (c.op === "click") {
      const [, label, times] = a.match(/^(.*?)(?:\s+x(\d+))?$/);
      for (let n = +times || 1; n > 0; n--) {
        const ready = await page.evaluate((l) => window.__vid.enabled(l), label);
        if (ready === null) { problems.push(`no button "${label}"`); return; }
        for (let i = 0; i < 400 && !(await page.evaluate((l) => window.__vid.enabled(l), label)); i++) await sleep(25); // still animating: wait
        const before = +times > 1 ? await page.evaluate(() => window.__vid.caption()) : null;
        if (!(await page.evaluate((l) => window.__vid.press(l), label))) problems.push(`could not press "${label}"`);
        await sleep(30);
        // a burst (xN): let each step land before the next press, or a press can fall between the steps
        for (let i = 0; before !== null && i < 60 && (await page.evaluate(() => window.__vid.caption())) === before; i++) await sleep(25);
      }
      log(`click ${a}  → ${(await page.evaluate(() => window.__vid.caption())).slice(0, 90)}`);
    } else if (c.op === "slider") {
      const [i, v] = a.split(/\s+/).map(Number);
      await page.evaluate(([i, v]) => window.__vid.slideTo(i, v), [i, v]);
      log(`slider ${i} = ${v}`);
    } else if (c.op === "check") {
      const [sel, want] = a.split("~").map((v) => v.trim());
      const got = await page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.textContent).join(" "), sel);
      const ok = got.replace(/\s+/g, "").includes(want.replace(/\s+/g, ""));
      if (!ok) problems.push(`CHECK FAILED: ${sel} should show "${want}" but shows: ${got.replace(/\s+/g, " ").slice(0, 200)}`);
      log(`check ${ok ? "ok " : "FAILED "} "${want}"`);
    } else throw new Error("unknown cue " + c.op);
  }

  // the performance
  const offsets = [];
  for (const s of M.segments) {
    const start = now(); offsets.push(start);
    for (const c of s.cues.slice().sort((p, q) => p.t - q.t)) {
      const wait = start + (c.t || 0) - now();
      if (wait > 0) await sleep(wait * 1000);
      await run(c);
    }
    const left = start + s.dur - now();
    if (left > 0) await sleep(left * 1000);
    if (s.then && s.then.await) {
      const w0 = now();
      await sleep(250);
      while ((await page.evaluate(() => window.__vid.busy())) && now() - w0 < 120) await sleep(60);
      await sleep(350);
      log(`animation took ${(now() - w0).toFixed(1)} s`);
    } else if (s.then && s.then.pause != null) await sleep(s.then.pause * 1000);
    else if (s.gap) await sleep(s.gap * 1000);
  }
  await finishTyping("the end");
  if (P && P.exit) { // the next part's card fades in, as the next {goto} would: the next part starts on that same frame
    await page.evaluate(([k, h]) => window.__vid.section(k, h), P.exit);
    await sleep(750);
  } else {
    await sleep(700);
    await page.evaluate(() => window.__vid.black());
    await sleep(1100);
  }
  const total = now();
  await cdp.send("Page.stopScreencast");
  await writing;
  await browser.close();

  // build the picture: each frame lasts until the next one, on the same clock as the narration.
  // Chrome encodes PNG frames in parallel and delivers some out of order (by up to a quarter second, hundreds of times a
  // minute while a machine animates). So place frames by their own timestamps, sorted. Summing the gaps in arrival order
  // and clamping the negative ones added every backward step to the picture: 14% too long in a test, the picture
  // drifting ~10 s behind the narration over a long form, with a hold-then-skip stutter at every out-of-order frame.
  const startTs = t0 / 1000;
  const late = stamps.filter(([, t], i) => i && t < stamps[i - 1][1]).length;
  const useful = stamps.filter(([, t]) => t >= startTs - 0.2 && t <= startTs + total).sort((p, q) => p[1] - q[1])
    .filter(([, t], i, a) => i + 1 === a.length || a[i + 1][1] > t); // of frames sharing a timestamp, keep the last
  const list = path.join(dir, "frames.txt");
  let txt = "";
  useful.forEach(([f, t], i) => { const next = i + 1 < useful.length ? useful[i + 1][1] : startTs + total; const from = i === 0 ? startTs : t; txt += `file '${f}'\nduration ${Math.max(0.001, next - from).toFixed(5)}\n`; });
  txt += `file '${useful[useful.length - 1][0]}'\n`;
  fs.writeFileSync(list, txt);
  const fps = useful.length / total;
  const VENC = ["-vf", "fps=60,scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-tune", "animation", "-g", "120", "-movflags", "+faststart"];

  fs.mkdirSync(path.dirname(out), { recursive: true }); // minutes of recording must not be lost to a missing folder
  const clips = M.segments.map((s, i) => ({ s, i })).filter(({ s }) => s.wav);
  if (!clips.length) {
    cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, ...VENC, out]);
  } else {
    // narration: every clip at the moment it really started, over a faint room tone (dead digital silence is what gives TTS away)
    const inp = [], flt = [];
    clips.forEach(({ s, i }, k) => { inp.push("-i", s.wav); const d = Math.round(offsets[i] * 1000 + 40); flt.push(`[${k}:a]aresample=48000,adelay=${d}:all=1[a${k}]`); });
    const n = clips.length;
    flt.push(`anoisesrc=c=pink:a=0.00028:r=48000:d=${total.toFixed(2)},lowpass=f=5000[room]`);
    flt.push(clips.map((_, k) => `[a${k}]`).join("") + `[room]amix=inputs=${n + 1}:normalize=0:duration=longest,highpass=f=65,acompressor=threshold=-22dB:ratio=2.2:attack=8:release=140:makeup=1.5[mix]`);
    const raw = path.join(dir, "narration-raw.wav"), wav = path.join(dir, "narration.wav");
    cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inp, "-filter_complex", flt.join(";"), "-map", "[mix]", "-t", total.toFixed(2), "-c:a", "pcm_s24le", raw], { maxBuffer: 1e9 });
    // two-pass loudness: measure, then apply as one straight gain so the pauses stay quiet (YouTube plays -14 LUFS)
    const probe = cp.spawnSync("ffmpeg", ["-hide_banner", "-i", raw, "-af", "loudnorm=I=-15:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" }).stderr;
    const m = JSON.parse(probe.match(/\{[^{}]*\}/g).pop()); // ffmpeg prints more text after the JSON
    const lf = `loudnorm=I=-15:TP=-1.5:LRA=11:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:print_format=summary`;
    cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", lf, "-ar", "48000", "-c:a", "pcm_s24le", wav], { maxBuffer: 1e9 });
    cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-i", wav, "-map", "0:v", "-map", "1:a", ...VENC, "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", out]);
    if (!P) fs.rmSync(raw, { force: true }); // assemble.js levels the joined parts' raw narration as one

    // captions for YouTube, from the same word times
    const srt = []; const stamp = (t) => { const ms = Math.round(t * 1000), z = (v, n = 2) => String(v).padStart(n, "0"); return `${z(ms / 3600000 | 0)}:${z((ms / 60000 | 0) % 60)}:${z((ms / 1000 | 0) % 60)},${z(ms % 1000, 3)}`; };
    clips.forEach(({ s, i }) => {
      let line = [], lineStart = null;
      const flush = (end) => { if (line.length) srt.push([offsets[i] + lineStart + 0.04, offsets[i] + end + 0.04, line.join(" ")]); line = []; lineStart = null; };
      s.words.forEach((w, k) => {
        if (lineStart == null) lineStart = s.start[k];
        line.push(w);
        if (line.join(" ").length > 58 || /[.?!]$/.test(w) || (/,$/.test(w) && line.join(" ").length > 32)) flush(s.end[k]);
      });
      if (line.length) flush(s.end[s.end.length - 1]);
    });
    fs.writeFileSync(out.replace(/\.mp4$/, ".srt"), srt.map(([a, b, x], i) => `${i + 1}\n${stamp(a)} --> ${stamp(b)}\n${x}\n`).join("\n"));
  }
  if (chapters.length) { // paste into the YouTube description; the first chapter has to start at 0:00
    const clock = (t) => `${t / 60 | 0}:${String(t % 60 | 0).padStart(2, "0")}`;
    fs.writeFileSync(out.replace(/\.mp4$/, ".chapters.txt"), (chapters[0][0] < 5 ? chapters : [[0, "Intro"], ...chapters]).map(([t, h]) => `${clock(t)} ${h}`).join("\n") + "\n");
  }
  fs.writeFileSync(path.join(dir, "timeline.json"), JSON.stringify({ offsets, total, fps, chapters }, null, 1));
  fs.rmSync(frames, { recursive: true, force: true }); fs.rmSync(list, { force: true });
  const probe = cp.execFileSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-show_entries", "format=duration,size", "-of", "csv=p=0", out]).toString().trim().replace(/\n/g, " ");
  console.log(`wrote ${out}  [${probe}]  captured at ${fps.toFixed(1)} fps, ${late} frames out of order (placed by timestamp)`);
  if (problems.length) { console.error("PROBLEMS:\n  " + problems.join("\n  ")); process.exit(2); }
})().catch((e) => { console.error(e); process.exit(1); });
