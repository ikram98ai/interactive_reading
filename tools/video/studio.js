#!/usr/bin/env node
/* studio.js <manifest.json> [out.mp4] — record a narrated video of one or more scenes: 1920×1080, dark mode, spotlight on whatever the
   narration is talking about. Playwright drives the page; frames come straight from Chrome (lossless PNG, Page.startScreencast)
   because Playwright's own recordVideo is capped at a low bitrate that blurs text.

   manifest.json comes from narrate.py. Each segment plays its clip, firing its cues at their word times; `then` is a silent
   pause or {await}, which holds the narration until the animation has finished. So the narration can never talk over a
   machine that is still running, and the audio is laid down afterwards at the moments each clip really started.

   Cues: scene · focus <target[+target]> | off · click <label> · slider <index> <value> · speed <x> · card <big | small>
         goto <scene id | kicker | heading>  (a section card covers the switch to that scene; {scene} lifts it; each goto is a YouTube chapter)
         check <selector> ~ <text>  (fails the run if the page doesn't show what the narration claims)
   Targets: svg:x,y,w,h (viewBox units of the machine) · css:<selector> · stat:<label> · btn:<label> · code:<a[-b]> · slider:<i>
   or a name from the script's `targets:` block. */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { chromium } = require("playwright-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = path.resolve(__dirname, "../..");
const W = 1920, H = 1080, ZOOM = 1.34;

// Page-only layout for the video: bigger machine, no zoom/exit/language controls, no Rust memory strip (this is for beginners).
const CSS = `
.wrap .stage.is-full { zoom: ${ZOOM}; inset: 0; width: calc(100vw / ${ZOOM}); height: calc(100vh / ${ZOOM}) !important; grid-template-columns: minmax(0, 1.16fr) minmax(0, 1fr); }
.fs-btn, .fs-zoom, .cp-lang, .memstrip, [id$="-mem"], .cp-lens { display: none !important; }
.stage.is-full .cp-body { overflow: hidden !important; }
.stage.is-full .cp-note { white-space: nowrap; }
.stage.is-full .cp-out { background: var(--surface-2) !important; color: var(--ink) !important; } /* this bar is white in dark mode: too bright on video */
.stage.is-full > .stage-scroll { overflow: hidden !important; }
.stage.is-full button { transition: background .15s, transform .1s; }
html, body { cursor: none !important; } * { scrollbar-width: none !important; }
`;

// Runs inside the page. Everything is drawn above the stage and never touches the book's own code.
function overlayScript() {
  const FONT = "Bricolage Grotesque, Atkinson Hyperlegible, system-ui, sans-serif";
  const root = document.createElement("div");
  root.id = "vid-overlay";
  root.style.cssText = "position:fixed;inset:0;z-index:100000;pointer-events:none;";
  root.innerHTML = `
    <svg id="vid-dim" width="100%" height="100%" style="position:absolute;inset:0"><path id="vid-dim-p" fill="#050811" fill-rule="evenodd" opacity="0"/></svg>
    <div id="vid-rings"></div>
    <svg id="vid-cursor" width="44" height="44" viewBox="0 0 24 24" style="position:absolute;left:0;top:0;opacity:0;filter:drop-shadow(0 3px 6px rgba(0,0,0,.6));will-change:transform">
      <path d="M5 2.5 L5 19.5 L9.6 15.4 L12.7 22 L15.6 20.7 L12.6 14.3 L18.8 14 Z" fill="#fff" stroke="#0b1020" stroke-width="1.2" stroke-linejoin="round"/></svg>
    <div id="vid-title" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center;
      background:radial-gradient(1200px 700px at 50% 42%, #1b2442 0%, #0d1220 62%, #090d18 100%);transition:opacity .7s ease;padding:0 180px;">
      <div id="vid-kicker" style="font:500 26px 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#8ea2ff"></div>
      <div id="vid-head" style="font:800 92px/1.08 ${FONT};color:#f3f5ff;letter-spacing:-.015em;text-wrap:balance"></div>
    </div>
    <div id="vid-card" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;text-align:center;
      background:radial-gradient(1200px 700px at 50% 42%, #1b2442 0%, #0d1220 62%, #090d18 100%);opacity:0;transition:opacity .6s ease;padding:0 170px;">
      <div id="vid-card-a" style="font:800 80px/1.12 ${FONT};color:#f3f5ff;letter-spacing:-.01em;text-wrap:balance"></div>
      <div id="vid-card-b" style="font:400 38px/1.3 'Atkinson Hyperlegible',system-ui;color:#aeb9dc;text-wrap:balance"></div>
    </div>
    <div id="vid-black" style="position:absolute;inset:0;background:#000;opacity:0;transition:opacity .8s linear"></div>`;
  document.body.appendChild(root);
  const $ = (id) => document.getElementById(id);
  const ACCENT = "#ffc857", PAD = 9, EASE = 0.16;

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
    if (kind === "code") { // line N is the Nth list item after the procedure's header line, as the page numbers them
      const [a, b] = arg.split("-").map(Number), pick = [...s.querySelectorAll(".cp-body li")].filter((li, n) => n >= a && n <= (b || a));
      if (!pick.length) return [];
      const rs = pick.map((e) => e.getBoundingClientRect()), l = Math.min(...rs.map((r) => r.left)), t2 = Math.min(...rs.map((r) => r.top));
      return [{ left: l, top: t2, width: Math.max(...rs.map((r) => r.right)) - l, height: Math.max(...rs.map((r) => r.bottom)) - t2 }];
    }
    return [];
  }
  const state = { targets: [], rects: [], alpha: 0, want: 0 };
  function rrect(x, y, w, h, r) { return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1 -${r} -${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r} -${r}z`; }
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
    state.alpha += (state.want - state.alpha) * EASE;
    const p = $("vid-dim-p");
    p.setAttribute("opacity", (state.alpha * 0.56).toFixed(3));
    p.setAttribute("d", `M0 0H${innerWidth}V${innerHeight}H0z ` + state.rects.map((r) => rrect(r.x, r.y, Math.max(r.w, 24), Math.max(r.h, 24), 12)).join(" "));
    state.rects.forEach((r) => {
      if (!r.el) { r.el = document.createElement("div"); $("vid-rings").appendChild(r.el); r.el.style.cssText = `position:absolute;left:0;top:0;border:3px solid ${ACCENT};border-radius:12px;box-shadow:0 0 22px 2px rgba(255,200,87,.45);box-sizing:border-box;`; }
      r.el.style.transform = `translate(${r.x}px,${r.y}px)`; r.el.style.width = r.w + "px"; r.el.style.height = r.h + "px"; r.el.style.opacity = r.a;
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const cur = { x: 1500, y: 1180, el: $("vid-cursor") };
  function place(x, y) { cur.x = x; cur.y = y; cur.el.style.transform = `translate(${x}px,${y}px)`; }
  place(cur.x, cur.y);
  let hideT = 0;
  window.__vid = {
    focus(list) { state.targets = list; state.want = list.length ? 1 : 0; },
    title(a, b) { $("vid-kicker").textContent = b; $("vid-head").textContent = a; },
    hideTitle() { $("vid-title").style.opacity = 0; },
    section(kicker, head) { state.targets = []; state.want = 0; $("vid-kicker").textContent = kicker; $("vid-head").textContent = head; $("vid-title").style.opacity = 1; $("vid-card").style.opacity = 0; },
    card(a, b) { $("vid-card-a").textContent = a; $("vid-card-b").textContent = b || ""; $("vid-card").style.opacity = 1; },
    black() { $("vid-black").style.opacity = 1; },
    async moveTo(x, y, ms = 520) {
      clearTimeout(hideT); cur.el.style.opacity = 1;
      const x0 = cur.x, y0 = cur.y, t0 = performance.now();
      await new Promise((done) => { (function f() { const k = Math.min(1, (performance.now() - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; place(x0 + (x - x0) * e, y0 + (y - y0) * e); k < 1 ? requestAnimationFrame(f) : done(); })(); });
    },
    ripple() {
      const r = document.createElement("div");
      r.style.cssText = `position:absolute;left:${cur.x + 4}px;top:${cur.y + 4}px;width:18px;height:18px;margin:-9px;border-radius:50%;border:3px solid ${ACCENT};transition:transform .45s ease-out,opacity .45s ease-out;`;
      root.appendChild(r); requestAnimationFrame(() => { r.style.transform = "scale(3.6)"; r.style.opacity = 0; }); setTimeout(() => r.remove(), 520);
      cur.el.style.transition = "scale .1s"; cur.el.style.scale = ".86"; setTimeout(() => { cur.el.style.scale = "1"; }, 110);
    },
    idle() { clearTimeout(hideT); hideT = setTimeout(() => { cur.el.style.transition = "opacity .5s"; cur.el.style.opacity = 0; setTimeout(() => (cur.el.style.transition = ""), 520); }, 1800); },
    buttonAt(label) { const b = [...stage().querySelectorAll("button")].find((x) => x.textContent.trim() === label); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width * .55, y: r.top + r.height * .55, disabled: b.disabled }; },
    press(label) { const b = [...stage().querySelectorAll("button")].find((x) => x.textContent.trim() === label && !x.disabled); if (!b) return false; b.click(); window.__lastBtn = b; return true; },
    sliderAt(i) { const r = stage().querySelectorAll("input[type=range]")[i].getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; },
    async slideTo(i, v, ms = 800) {
      const inp = stage().querySelectorAll("input[type=range]")[i], lo = +inp.min, hi = +inp.max, a = +inp.value, st = +inp.step || 1, r = inp.getBoundingClientRect();
      const t0 = performance.now();
      await new Promise((done) => { (function f() { const k = Math.min(1, (performance.now() - t0) / ms), val = Math.round((a + (v - a) * k) / st) * st; if (+inp.value !== val) { inp.value = val; inp.dispatchEvent(new Event("input", { bubbles: true })); } place(r.left + r.width * (val - lo) / (hi - lo), r.top + r.height * .4); k < 1 ? requestAnimationFrame(f) : done(); })(); });
      inp.value = v; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true }));
    },
    busy() { const b = window.__lastBtn; return !!(b && b.isConnected && b.disabled); },
  };
}

(async () => {
  const mf = path.resolve(process.argv[2]), M = JSON.parse(fs.readFileSync(mf, "utf8")), meta = M.meta;
  const dir = path.dirname(mf), frames = path.join(dir, "frames");
  const out = path.resolve(process.argv[3] || path.join(dir, M.name + ".mp4"));
  fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
  const named = (t) => t.split("+").map((x) => { const k = x.trim(); if (meta.targets[k]) return meta.targets[k]; if (/^(svg|css|btn|stat|code|slider):/.test(k)) return k; throw new Error("unknown target " + k); });
  // check every target name before spending minutes on a recording
  M.segments.forEach((s) => s.cues.forEach((c) => { if (c.op === "focus" && c.arg !== "off") named(c.arg); }));

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
  await page.goto("file://" + path.join(ROOT, meta.page), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: CSS });
  await page.evaluate(overlayScript);
  await page.evaluate(([a, b]) => window.__vid.title(a, b), [meta.title, meta.kicker]);
  await page.evaluate((id) => { const s = document.getElementById(id); s.scrollIntoView(); s.querySelector(".fs-btn").click(); if (window.K) K.speed.value = 1; }, meta.scene);
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
  async function run(c) {
    const a = c.arg;
    if (c.op === "scene") { await page.evaluate(() => window.__vid.hideTitle()); }
    else if (c.op === "goto") {
      const [id, kicker, head] = a.split("|").map((v) => v.trim());
      chapters.push([now(), head]);
      await page.evaluate(([k, h]) => window.__vid.section(k, h), [kicker, head]);
      await sleep(750); // the card has faded in: nothing below it is visible now
      await page.evaluate((id) => { const s = document.getElementById(id); if (!s.querySelector(".is-full")) { s.scrollIntoView(); s.querySelector(".fs-btn").click(); } K.speed.value = 1; window.__lastBtn = null; }, id);
      await sleep(500);
      log(`goto ${id}`);
    }
    else if (c.op === "focus") { await page.evaluate((l) => window.__vid.focus(l), a === "off" ? [] : named(a)); }
    else if (c.op === "speed") { await page.evaluate((v) => { K.speed.value = v; }, +a); }
    else if (c.op === "card") { const [x, y] = a.split("|").map((v) => v.trim()); await page.evaluate(([p, q]) => window.__vid.card(p, q), [x, y]); }
    else if (c.op === "click") {
      let at = await page.evaluate((l) => window.__vid.buttonAt(l), a);
      if (!at) { problems.push(`no button "${a}"`); return; }
      await page.evaluate(([x, y]) => window.__vid.moveTo(x, y), [at.x, at.y]);
      for (let i = 0; i < 200 && (await page.evaluate((l) => (window.__vid.buttonAt(l) || {}).disabled, a)); i++) await sleep(50); // still animating: wait
      const ok = await page.evaluate((l) => { window.__vid.ripple(); return window.__vid.press(l); }, a);
      if (!ok) problems.push(`could not press "${a}"`);
      await page.evaluate(() => window.__vid.idle());
      log(`click ${a}`);
    } else if (c.op === "slider") {
      const [i, v] = a.split(/\s+/).map(Number);
      const r = await page.evaluate((i) => window.__vid.sliderAt(i), i);
      await page.evaluate(([x, y]) => window.__vid.moveTo(x, y), [r.x + r.w / 2, r.y + r.h * .4]);
      await page.evaluate(([i, v]) => window.__vid.slideTo(i, v), [i, v]);
      await page.evaluate(() => window.__vid.idle());
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
  await sleep(700);
  await page.evaluate(() => window.__vid.black());
  await sleep(1100);
  const total = now();
  await cdp.send("Page.stopScreencast");
  await writing;
  await browser.close();

  // build the picture: each frame lasts until the next one, on the same clock as the narration
  const startTs = t0 / 1000;
  const useful = stamps.filter(([, t]) => t >= startTs - 0.2);
  const list = path.join(dir, "frames.txt");
  let txt = "";
  useful.forEach(([f, t], i) => { const next = i + 1 < useful.length ? useful[i + 1][1] : startTs + total; const from = i === 0 ? startTs : t; txt += `file '${f}'\nduration ${Math.max(0.001, next - from).toFixed(5)}\n`; });
  txt += `file '${useful[useful.length - 1][0]}'\n`;
  fs.writeFileSync(list, txt);
  const fps = useful.length / total;
  const VENC = ["-vf", "fps=60,scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-tune", "animation", "-g", "120", "-movflags", "+faststart"];

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
    fs.rmSync(raw, { force: true });

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
    fs.writeFileSync(out.replace(/\.mp4$/, ".chapters.txt"), [[0, "Intro"], ...chapters].map(([t, h]) => `${clock(t)} ${h}`).join("\n") + "\n");
  }
  fs.writeFileSync(path.join(dir, "timeline.json"), JSON.stringify({ offsets, total, fps }, null, 1));
  fs.rmSync(frames, { recursive: true, force: true }); fs.rmSync(list, { force: true });
  const probe = cp.execFileSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-show_entries", "format=duration,size", "-of", "csv=p=0", out]).toString().trim().replace(/\n/g, " ");
  console.log(`wrote ${out}  [${probe}]  captured at ${fps.toFixed(1)} fps`);
  if (problems.length) { console.error("PROBLEMS:\n  " + problems.join("\n  ")); process.exit(2); }
})().catch((e) => { console.error(e); process.exit(1); });
