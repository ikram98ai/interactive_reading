#!/usr/bin/env node
/* record.js <script.json> [out.mp4] — record one interactive scene in its full-screen view, narrated.
   Script: { page, scene, title, subtitle, voice, rate, theme, steps: [{ say, click?, rust?, pseudo?, delay?, settle? }] }
   Every step: the narration (macOS `say`) starts, `delay` ms later the action runs (click a button by its label,
   or switch the code panel to Rust/Pseudocode), then the step waits for the animation and for the narration to finish. */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const puppeteer = require("puppeteer-core");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"].find((x) => fs.existsSync(x));
const ROOT = path.resolve(__dirname, "../..");

(async () => {
  const sp = path.resolve(process.argv[2]), S = JSON.parse(fs.readFileSync(sp, "utf8"));
  const out = path.resolve(process.argv[3] || sp.replace(/\.json$/, ".mp4"));
  const work = fs.mkdtempSync(path.join(path.dirname(out), "work-"));
  const W = S.width || 1280, H = S.height || 720; // CSS viewport = video size (the screencast ignores device scale)

  // 1. narration clips + their lengths  (voice "kokoro:af_heart" = local Kokoro-82M; anything else = macOS `say -v <voice>`)
  const clipMs = (f) => Number(cp.execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString()) * 1000;
  const voice = S.voice || "kokoro:af_heart", kokoro = voice.startsWith("kokoro:");
  const clips = S.steps.map((st, i) => ({ f: st.say ? path.join(work, `s${String(i).padStart(2, "0")}.${kokoro ? "wav" : "aiff"}`) : null, dur: 0 }));
  if (kokoro) {
    const jobs = path.join(work, "jobs.json");
    fs.writeFileSync(jobs, JSON.stringify({ voice: voice.slice(7), speed: S.speed || 1.0, items: S.steps.map((st, i) => st.say && { text: st.say, out: clips[i].f }).filter(Boolean) }));
    cp.execFileSync(path.join(__dirname, ".venv/bin/python"), [path.join(__dirname, "tts_kokoro.py"), jobs], { stdio: "inherit" });
  } else S.steps.forEach((st, i) => { if (st.say) cp.execFileSync("say", ["-v", voice, "-r", String(S.rate || 175), "-o", clips[i].f, st.say]); });
  clips.forEach((c) => { if (c.f) c.dur = clipMs(c.f); });

  // 2. open the page at 1920×1080 (a 1280×720 layout at 1.5× — the machine's layout stays the one readers see)
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
    args: ["--no-sandbox", "--allow-file-access-from-files", "--hide-scrollbars"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push("console.error: " + m.text()); });
  // the page has its own full-screen layout (.is-full); the browser's native fullscreen would shrink a headless window to 800×600
  await page.evaluateOnNewDocument((seed) => {
    Element.prototype.requestFullscreen = undefined;
    if (seed != null) { let a = seed >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  }, S.seed == null ? null : S.seed);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: S.theme || "light" }]);
  await page.goto("file://" + path.join(ROOT, S.page), { waitUntil: "load" });
  await wait(800);
  await page.evaluate(() => { if (window.K) K.speed.value = 1; });
  console.log("viewport", await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]));
  await page.evaluate((id) => document.getElementById(id).scrollIntoView(), S.scene);
  await wait(500);

  // 3. start recording, show the title card
  const mp4 = path.join(work, "video.mp4");
  const rec = await page.screencast({ path: mp4, format: "mp4", fps: 30 });
  const t0 = Date.now(), now = () => Date.now() - t0;
  await page.evaluate((title, sub) => {
    const d = document.createElement("div"); d.id = "vid-title";
    d.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:var(--bg);color:var(--ink);text-align:center;font-family:var(--f-body,system-ui)";
    d.innerHTML = `<div style="font:600 14px var(--f-mono,monospace);letter-spacing:.14em;color:var(--ink-3);text-transform:uppercase">${sub}</div><div style="font:800 56px/1.1 var(--f-head,system-ui);max-width:900px">${title}</div>`;
    document.body.appendChild(d);
  }, S.title, S.subtitle);

  // 4. the steps
  const offs = [];
  for (let i = 0; i < S.steps.length; i++) {
    const st = S.steps[i], start = now(); offs.push(start);
    const delay = st.delay == null ? 900 : st.delay;
    const act = (async () => {
      await wait(delay);
      if (i === 1 && !st.noFull) { /* step 1 always leaves the title card and enters full screen */ }
      if (st.title === "off") await page.evaluate(() => { const d = document.getElementById("vid-title"); d && d.remove(); });
      if (st.full) await page.evaluate((id) => { document.getElementById(id).querySelector(".fs-btn").click(); }, S.scene);
      if (st.rust || st.pseudo) await page.evaluate((k) => { document.querySelector(`.is-full .cp-lang button[data-lang="${k}"]`).click(); }, st.rust ? "rust" : "pseudo");
      if (st.seg != null) await page.evaluate((id, n) => { document.querySelector(`#${id}`).querySelectorAll(".seg button")[n].click(); }, S.scene, st.seg);
      if (st.speed != null) await page.evaluate((v) => { K.speed.value = v; }, st.speed);
      if (st.slider) await page.evaluate((id, n, v) => { const r = document.querySelector('.is-full, #' + id).querySelectorAll('input[type=range]')[n]; r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }, S.scene, st.slider[0], st.slider[1]);
      if (st.click) {
        await page.evaluate((id, label) => {
          const root = document.querySelector(".is-full") || document.getElementById(id);
          const b = [...root.querySelectorAll("button")].find((x) => x.textContent.trim() === label && !x.disabled);
          if (!b) throw new Error("no enabled button " + label); b.click(); window.__lastBtn = b;
        }, S.scene, st.click);
        await wait(400);
        await page.waitForFunction(() => !window.__lastBtn || !window.__lastBtn.disabled, { timeout: 60000 }).catch(() => {});
      }
      await wait(st.settle == null ? 600 : st.settle);
    })();
    await act;
    console.log(`[${i}] ${(start / 1000).toFixed(1)}s caption: ` + (await page.evaluate(() => { const c = document.querySelector('.is-full .caption'), s = document.querySelector('.is-full .statrow'); return (c ? c.textContent.trim().slice(0, 170) : '') + ' | stats: ' + (s ? s.textContent.replace(/\\s+/g, ' ').trim() : ''); })));
    const need = delay + 300;
    const remain = clips[i].dur + 450 - (now() - start);
    if (remain > 0) await wait(remain);
  }
  await wait(800);
  const total = now();
  await rec.stop();
  await browser.close();
  if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));

  // the screencast arrives as VP9 in RGB, which QuickTime and most players cannot show: write plain H.264 / yuv420p
  const H264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart"];
  // 5. mix the narration at its offsets and mux
  const inputs = ["-i", mp4], filt = []; let n = 0;
  clips.forEach((c, i) => { if (!c.f) return; inputs.push("-i", c.f); filt.push(`[${n + 1}:a]adelay=${offs[i] + 150}|${offs[i] + 150}[a${n}]`); n++; });
  if (n === 0) cp.execFileSync("ffmpeg", ["-y", "-i", mp4, ...H264, out], { stdio: "ignore" });
  else {
    const mix = filt.join(";") + ";" + Array.from({ length: n }, (_, k) => `[a${k}]`).join("") + `amix=inputs=${n}:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
    cp.execFileSync("ffmpeg", ["-y", ...inputs, "-filter_complex", mix, "-map", "0:v", "-map", "[a]", ...H264, "-c:a", "aac", "-b:a", "192k", out], { stdio: "ignore" });
  }
  const dur = Number(cp.execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).toString());
  console.log(`wrote ${out}  (${dur.toFixed(1)} s video, ${(total / 1000).toFixed(1)} s wall clock)`);
  fs.rmSync(work, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
