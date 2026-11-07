/* Use Algorithm Alley's step-through machines the way a person does, at normal speed, and fail on what breaks.

   node tools/interact.js books/algo/ch27.html [--only=<stage index>]

   smoke.js and steps.js jump between steps at high speed. This one presses things as a reader would:
     - Next plays its real animation and lands on the same picture as jumping there
     - Back or Next pressed mid-animation leaves no half-drawn picture behind
     - the arrow keys step, Play and Pause work, and a paused machine stays still
     - switching to Rust and back during a run changes nothing in the picture
     - full screen opens, shows the picture, steps, and closes again
     - with reduced motion on, every machine still steps and plays
     - on a phone with touch: tapping Next works, nothing overflows the stage, buttons are big enough to tap
     - every dotted word shows its meaning, inside the window, when focused or tapped
   Exit 1 on any problem. Machines without a step slider are left to smoke.js. */
const { parseArgs, open, wait } = require("./browser");

const picture = (stage) => stage.evaluate((el) => {
  const c = el.querySelector(":scope > .stage-scroll > svg").cloneNode(true);
  c.querySelectorAll(".wk-fx").forEach((n) => n.parentNode.removeChild(n));
  return c.innerHTML.replace(/pl-clip-\d+/g, "pl-clip");
});
const press = (stage, label) => stage.evaluate((el, l) => {
  const b = [...el.querySelectorAll(".controls .btn")].find((x) => x.textContent === l);
  if (!b || b.disabled) return false;
  b.click(); return true;
}, label);
const count = (stage) => stage.evaluate((el) => el.querySelector(".wk-count").textContent);
const jump = (stage, i) => stage.evaluate((el, v) => { const r = el.querySelector(".wk-scrub input"); r.value = String(v); r.dispatchEvent(new Event("input", { bubbles: true })); }, i);
const steps = (stage) => stage.evaluate((el) => Number(el.querySelector(".wk-scrub input").max));
const top = (stage) => stage.evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: "instant" }));
const settled = async (stage, want, ms = 2600) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if ((await picture(stage)) === want) return true; await wait(50); }
  return false;
};

(async () => {
  const a = parseArgs(process.argv, "usage: node tools/interact.js <chapter.html> [--only=N]");
  const only = a.num("only", null), bad = [];
  let tried = 0;

  /* ---- a desktop reader, at normal speed ---- */
  {
    const { browser, page, errors } = await open(a.file, { speed: 1, height: 1000 });
    const n = await page.$$eval(".stage", (e) => e.length);
    for (let i = 0; i < n; i++) {
      if (only !== null && only !== i) continue;
      const stage = (await page.$$(".stage"))[i];
      if (!(await stage.$(".wk-scrub input"))) continue;
      const say = (m) => bad.push(`stage ${i}: ${m}`);
      tried++;
      await top(stage); await wait(60);
      await jump(stage, 0);
      const last = await steps(stage);
      if (last < 2) continue;
      await jump(stage, 1); const p1 = await picture(stage);
      await jump(stage, 2); const p2 = await picture(stage);
      await jump(stage, 0); const p0 = await picture(stage);

      // the real animation lands where the jump lands
      await press(stage, "Next");
      if (!(await settled(stage, p1))) say("Next's animation does not land on the step's picture");
      if (!(await count(stage)).startsWith("2 /")) say("Next did not move to step 2");

      // interrupted part-way, and left alone long enough for a stray tween to show itself
      await press(stage, "Next"); await wait(120);
      await press(stage, "Back");
      if (!(await count(stage)).startsWith("2 /")) say("Back during an animation went to the wrong step");
      await wait(900);
      if ((await picture(stage)) !== p1) say("Back during an animation left the wrong picture");
      await press(stage, "Next"); await wait(120);
      await press(stage, "Next").catch(() => {});
      await jump(stage, 2); await wait(900);
      if ((await picture(stage)) !== p2) say("the slider during an animation left the wrong picture");

      // the arrow keys, from a focused button
      await jump(stage, 0);
      await stage.evaluate((el) => { [...el.querySelectorAll(".controls .btn:not(:disabled)")].find((b) => b.offsetParent !== null).focus(); });
      await page.keyboard.press("ArrowRight");
      if (!(await count(stage)).startsWith("2 /")) say("the right arrow key did not step");
      await settled(stage, p1);
      await page.keyboard.press("ArrowLeft");
      if (!(await count(stage)).startsWith("1 /")) say("the left arrow key did not step back");
      if ((await picture(stage)) !== p0) say("the left arrow key did not restore the picture");

      // Play, then switch to Rust and back while it runs, then Pause
      await press(stage, "Play"); await wait(250);
      const labels = () => stage.evaluate((el) => [...el.querySelectorAll(".controls .btn")].map((b) => b.textContent).join(","));
      if (!(await labels()).includes("Pause")) say("Play does not offer Pause");
      await stage.evaluate((el) => {
        const r = el.querySelector('.cp-lang button[data-lang="rust"]'), q = el.querySelector('.cp-lang button[data-lang="pseudo"]');
        if (r && q) { r.click(); q.click(); }
      });
      await press(stage, "Pause"); await wait(700);
      const held = await count(stage), hp = await picture(stage);
      await wait(1100);
      if ((await count(stage)) !== held) say("the machine kept moving after Pause");
      if ((await picture(stage)) !== hp) say("the picture kept changing after Pause");
      if (!(await labels()).includes("Play")) say("Pause does not offer Play again");

      // full screen, where the machine has it
      const fs = await stage.$(":scope > .stage-head .fs-btn");
      if (fs) {
        await jump(stage, 0);
        await fs.evaluate((b) => b.click()); await wait(120);
        const open1 = await stage.evaluate((el) => { const r = el.querySelector(":scope > .stage-scroll > svg").getBoundingClientRect(); return { on: el.classList.contains("is-full"), w: r.width, h: r.height, hw: document.documentElement.scrollWidth, ww: innerWidth }; });
        if (!open1.on) say("full screen did not open");
        if (open1.w < 100 || open1.h < 60) say(`full screen shows a ${Math.round(open1.w)}×${Math.round(open1.h)} picture`);
        await press(stage, "Next");
        if (!(await settled(stage, p1))) say("Next in full screen does not land on the step's picture");
        await fs.evaluate((b) => b.click()); await wait(80);
        if (await stage.evaluate((el) => el.classList.contains("is-full"))) say("full screen did not close");
        await top(stage);
      }

      await press(stage, "Start over");
      if (!(await count(stage)).startsWith("1 /")) say("Start over did not return to step 1");
      if ((await picture(stage)) !== p0) say("Start over did not restore the first picture");
    }

    /* ---- every dotted word ---- */
    if (only === null) {
      const r = await page.evaluate(async () => {
        const out = { n: 0, bad: [] }, tip = document.querySelector(".term-tip");
        document.querySelectorAll("details").forEach((d) => { d.open = true; }); // words in "What the book says" count too
        for (const t of document.querySelectorAll(".term")) {
          out.n++;
          t.focus(); // focusing scrolls it into view, as a Tab press does: judge once the page has been still for a while
          for (let last = -1, still = 0, k = 0; k < 60 && still < 4; k++) { still = scrollY === last ? still + 1 : 0; last = scrollY; await new Promise((f) => setTimeout(f, 60)); }
          const b = tip ? tip.getBoundingClientRect() : null;
          if (!tip || !tip.classList.contains("show") || !tip.textContent.trim()) out.bad.push(`no meaning for "${t.textContent}"`);
          else if (b.left < 0 || b.right > innerWidth || b.top < 0 || b.bottom > innerHeight) out.bad.push(`meaning of "${t.textContent}" leaves the window`);
          t.blur();
        }
        return out;
      });
      r.bad.forEach((m) => bad.push(m));
    }
    errors.forEach((e) => bad.push("desktop: " + e));
    await browser.close();
  }

  /* ---- reduced motion ---- */
  {
    const { browser, page, errors } = await open(a.file, { speed: 1 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.reload({ waitUntil: "load" }); await wait(500);
    const n = await page.$$eval(".stage", (e) => e.length);
    for (let i = 0; i < n; i++) {
      if (only !== null && only !== i) continue;
      const stage = (await page.$$(".stage"))[i];
      if (!(await stage.$(".wk-scrub input"))) continue;
      await jump(stage, 1); const want = await picture(stage); await jump(stage, 0);
      await press(stage, "Next");
      if (!(await settled(stage, want, 400))) bad.push(`stage ${i}, reduced motion: Next does not reach the step's picture`);
      await press(stage, "Play"); await wait(120); await press(stage, "Pause");
    }
    errors.forEach((e) => bad.push("reduced motion: " + e));
    await browser.close();
  }

  /* ---- a phone, with touch ---- */
  {
    const { browser, page, errors } = await open(a.file, { speed: 4 });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: "load" }); await wait(500);
    await page.evaluate(() => { K.speed.value = 4; });
    const n = await page.$$eval(".stage", (e) => e.length);
    if ((await page.evaluate(() => document.documentElement.scrollWidth)) > 391) bad.push("phone: the page scrolls sideways");
    for (let i = 0; i < n; i++) {
      if (only !== null && only !== i) continue;
      const stage = (await page.$$(".stage"))[i];
      const say = (m) => bad.push(`stage ${i}, phone: ${m}`);
      const box = await stage.evaluate((el) => {
        const svg = el.querySelector(":scope > .stage-scroll > svg") || el.querySelector(":scope > svg"), r = svg && svg.getBoundingClientRect();
        const wide = [...el.children].filter((c) => !c.classList.contains("stage-scroll") && !c.classList.contains("codepane") && c.scrollWidth > c.clientWidth + 1).map((c) => c.className || c.tagName);
        return { w: r ? r.width : 0, h: r ? r.height : 0, wide };
      });
      if (box.w < 100 || box.h < 40) say(`the picture is only ${Math.round(box.w)}×${Math.round(box.h)}`);
      box.wide.forEach((c) => say(`"${c}" is wider than the stage`));
      if (!(await stage.$(".wk-scrub input"))) continue;
      const tiny = await stage.evaluate((el) => [...el.querySelectorAll(".controls .btn")].filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height < 30).map((b) => `${b.textContent} (${Math.round(b.getBoundingClientRect().height)}px)`));
      if (tiny.length) say(`buttons too small to tap: ${tiny.join(", ")}`);
      await jump(stage, 1); const want = await picture(stage); await jump(stage, 0);
      const next = await stage.evaluateHandle((el) => [...el.querySelectorAll(".controls .btn")].find((b) => b.textContent === "Next"));
      if (await next.evaluate((b) => !b.disabled)) {
        await next.evaluate((b) => b.scrollIntoView({ block: "center", behavior: "instant" })); await wait(40);
        await next.tap();
        if (!(await settled(stage, want, 1500))) say("tapping Next does not reach the step's picture");
      }
    }
    if (only === null) {
      const term = await page.$(".term");
      if (term) {
        await term.evaluate((t) => t.scrollIntoView({ block: "center", behavior: "instant" })); await wait(40);
        await term.tap(); await wait(120);
        const look = () => page.evaluate(() => { const t = document.querySelector(".term-tip"), b = t && t.getBoundingClientRect(); return !!t && t.classList.contains("show") && b.left >= 0 && b.right <= innerWidth; });
        if (!(await look())) bad.push("phone: tapping a dotted word does not show its meaning inside the screen");
        await term.tap(); await wait(120);
        if (await look()) bad.push("phone: a second tap does not close a dotted word's meaning");
      }
    }
    errors.forEach((e) => bad.push("phone: " + e));
    await browser.close();
  }

  const all = [...new Set(bad)];
  console.log(all.length ? `PROBLEMS (${all.length}):\n` + all.slice(0, 40).join("\n") + (all.length > 40 ? `\n… and ${all.length - 40} more` : "") : `OK — ${tried} machines used at normal speed, with keys, Pause, full screen, reduced motion and touch.`);
  process.exit(all.length ? 1 : 0);
})().catch((e) => { console.error("interact crashed:", e); process.exit(2); });
