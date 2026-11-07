/* Walk through every step of every step-through machine (AL.walk), in every mode, and check each picture.

   node tools/steps.js books/algo/ch27.html [--only=<stage index>] [--dark] [--shots=N] [--no-sweep] [--out=<dir>]

   For each stage with a step slider, for each option of its segmented control, for every step:
     - SVG labels must not overlap each other, or leave the viewBox
     - the caption must say something, with no undefined, NaN or -0.00, and no "1 units"
     - the picture must be the same however you reached that step: Next and the slider must agree, so Back works
     - the same picture checks with each input slider at both ends and each other choice in an inputs row, one at a
       time (--no-sweep skips this while you are working on one machine); and no number may be wider than its cell
   Saves N evenly spaced screenshots per mode (default 3), named <chapter>-steps-stage<i>-seg<k>-<step>.png.
   Exit 1 on any problem. Stage 0 is the hero. Machines without a step slider are skipped: use smoke.js and play.js. */
const path = require("path");
const { parseArgs, open, wait, frame } = require("./browser");

(async () => {
  const a = parseArgs(process.argv, "usage: node tools/steps.js <chapter.html> [--only=N] [--dark] [--shots=N] [--out=dir]");
  const only = a.num("only", null), shots = a.num("shots", 3), noSweep = process.argv.includes("--no-sweep");
  let swept = 0;
  const { browser, page, errors } = await open(a.file, { theme: a.theme, speed: 6, height: 1000 });
  if (a.theme === "dark") await page.evaluate(() => K.applyTheme("dark"));
  const problems = [];
  const stageCount = await page.$$eval(".stage", (els) => els.length);
  let checked = 0;

  const inspect = (stage) => stage.evaluate((el) => {
    const out = { overlaps: [], clipped: [], wide: [], labels: "", caption: (el.querySelector(".caption") || {}).textContent || "" };
    const svg = el.querySelector(":scope > .stage-scroll > svg"); if (!svg) return out;
    const vb = svg.viewBox.baseVal, sm = svg.getCTM(); if (!sm) return out;
    const inv = sm.inverse();
    const boxes = [];
    svg.querySelectorAll("text").forEach((t) => {
      const str = t.textContent.trim(); if (!str) return;
      let op = 1;
      for (let n = t; n && n !== svg; n = n.parentNode) { const cs = getComputedStyle(n); op *= Number(cs.opacity); if (cs.display === "none" || cs.visibility === "hidden") op = 0; }
      if (op < 0.05) return;
      const bb = t.getBBox(), m = inv.multiply(t.getCTM());
      const px = (x, y) => ({ x: x * m.a + y * m.c + m.e, y: x * m.b + y * m.d + m.f });
      const p = px(bb.x, bb.y), q = px(bb.x + bb.width, bb.y + bb.height);
      // trim the line box to the glyphs: two rows of text may touch without their letters colliding
      boxes.push({ str, x0: Math.min(p.x, q.x), x1: Math.max(p.x, q.x), y0: Math.min(p.y, q.y) + bb.height * 0.2, y1: Math.max(p.y, q.y) - bb.height * 0.15 });
    });
    out.labels = boxes.map((b) => b.str).join(" | ");
    svg.querySelectorAll("text.ac-v").forEach((v) => {
      const r = v.previousElementSibling;
      if (!r || r.tagName !== "rect" || !v.textContent.trim()) return;
      if (v.getBBox().width > r.getBBox().width + 0.5) out.wide.push(v.textContent.trim());
    });
    boxes.forEach((b, i) => {
      if (b.x1 > vb.x + vb.width + 1 || b.x0 < vb.x - 1 || b.y1 > vb.y + vb.height + 1 || b.y0 < vb.y - 1) { if (b.x1 > -50 && b.y1 > -50) out.clipped.push(b.str); }
      for (let j = i + 1; j < boxes.length; j++) {
        const c = boxes[j];
        const w = Math.min(b.x1, c.x1) - Math.max(b.x0, c.x0), hh = Math.min(b.y1, c.y1) - Math.max(b.y0, c.y0);
        if (w > 1.5 && hh > 1.5) out.overlaps.push(`"${b.str.slice(0, 24)}" × "${c.str.slice(0, 24)}"`);
      }
    });
    return out;
  });
  const markup = (stage) => stage.evaluate((el) => {
    const c = el.querySelector(":scope > .stage-scroll > svg").cloneNode(true);
    c.querySelectorAll(".wk-fx").forEach((n) => n.parentNode.removeChild(n));
    return c.innerHTML.replace(/pl-clip-\d+/g, "pl-clip"); // clip ids count up each time a plot is drawn
  });
  const setStep = (stage, i) => stage.evaluate((el, v) => { const r = el.querySelector(".wk-scrub input"); r.value = String(v); r.dispatchEvent(new Event("input", { bubbles: true })); }, i);
  const lastStep = (stage) => stage.evaluate((el) => Number(el.querySelector(".wk-scrub input").max));
  const press = (stage, label) => stage.evaluate((el, l) => { const b = [...el.querySelectorAll(".controls .btn")].find((x) => x.textContent === l); if (b && !b.disabled) { b.click(); return true; } return false; }, label);

  for (let i = 0; i < stageCount; i++) {
    if (only !== null && only !== i) continue;
    const stage = (await page.$$(".stage"))[i];
    if (!(await stage.$(".wk-scrub input"))) continue;
    await frame(stage); await wait(150);
    const nSeg = await stage.evaluate((el) => (el.querySelector(".stage-head .seg") ? el.querySelectorAll(".stage-head .seg button").length : 1));
    for (let k = 0; k < nSeg; k++) {
      await stage.evaluate((el, n) => { const b = el.querySelectorAll(".stage-head .seg button")[n]; if (b) b.click(); }, k);
      await wait(80);
      const last = await lastStep(stage);
      const want = new Set(Array.from({ length: Math.max(1, shots) }, (_, t) => Math.round((t * last) / Math.max(1, shots - 1))));
      const seen = [];
      for (let t = 0; t <= last; t++) {
        await setStep(stage, t); await wait(30);
        const r = await inspect(stage);
        const where = `stage ${i} mode ${k} step ${t + 1}/${last + 1}`;
        if (!r.caption.trim()) problems.push(`${where}: empty caption`);
        const words = r.caption + " " + r.labels;
        const junk = words.match(/\b(?:undefined|NaN|null)\b|\[object|(?<![\d.])-0(?:\.0+)?(?![\d.])/);
        if (junk) problems.push(`${where}: "${junk[0]}" on screen`);
        const plural = r.caption.match(/(?<![\d.,])\b1 (?:units|strands|steps|processors|items|minutes|floors|times|jobs|entries|elements|edges|vertices|nodes|rounds|slots|blocks|pages|bits|digits|comparisons|pairs|characters|letters|clauses|variables|iterations|days|lines|rows|columns|roots|terms|cycles|experts|mistakes|dollars)\b/);
        if (plural) problems.push(`${where}: "${plural[0]}" should be singular`);
        [...new Set(r.overlaps)].forEach((o) => problems.push(`${where}: overlapping labels ${o}`));
        [...new Set(r.clipped)].forEach((o) => problems.push(`${where}: label outside the picture "${o}"`));
        [...new Set(r.wide)].forEach((o) => problems.push(`${where}: "${o}" is wider than its cell`));
        seen.push(await markup(stage));
        checked++;
        if (want.has(t)) await stage.screenshot({ path: path.join(a.out, `${a.base}-steps${a.theme === "dark" ? "-dark" : ""}-stage${i}-seg${k}-${String(t + 1).padStart(2, "0")}.png`) });
      }
      // Next from the first step must land on the same picture as the slider did, once the movement finishes
      await setStep(stage, 0);
      for (let t = 1; t <= last; t++) {
        if (!(await press(stage, "Next"))) { problems.push(`stage ${i} mode ${k}: Next is disabled at step ${t}`); break; }
        await wait(40);
        for (let z = 0; z < 60; z++) { const m = await markup(stage); if (m === seen[t]) break; await wait(40); }
        const m = await markup(stage);
        if (m !== seen[t]) { problems.push(`stage ${i} mode ${k} step ${t + 1}: the picture after Next differs from the picture after jumping there, so paint() depends on history`); break; }
      }
      // Back from the end must land on the same pictures too
      for (let t = last - 1; t >= Math.max(0, last - 3); t--) {
        await press(stage, "Back"); await wait(30);
        if ((await markup(stage)) !== seen[t]) { problems.push(`stage ${i} mode ${k} step ${t + 1}: Back does not restore the picture`); break; }
      }
      // every slider at both ends, and every choice in an inputs row, one at a time: walk all the steps again
      if (!noSweep) {
        const knobs = await stage.evaluate((el) => {
          const vis = (e) => e.offsetParent !== null;
          const rs = [...el.querySelectorAll(".controls input[type=range]")].filter((r) => !r.closest(".wk-scrub") && vis(r));
          const segs = [...el.querySelectorAll(".controls .seg button")].filter(vis);
          const list = [];
          rs.forEach((r) => { const all = [...el.querySelectorAll("input[type=range]")]; list.push({ range: all.indexOf(r), v: r.min, back: r.value, name: r.id }); list.push({ range: all.indexOf(r), v: r.max, back: r.value, name: r.id }); });
          segs.forEach((b) => { const all = [...el.querySelectorAll(".controls .seg button")]; const pressed = [...b.parentNode.children].find((x) => x.getAttribute("aria-pressed") === "true"); list.push({ seg: all.indexOf(b), back: all.indexOf(pressed), name: b.textContent }); });
          return list;
        });
        const turn = (knob, val) => stage.evaluate((el, kn, v) => {
          if (kn.range != null) { const r = el.querySelectorAll("input[type=range]")[kn.range]; if (!r) return; r.value = v; r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); }
          else { const b = el.querySelectorAll(".controls .seg button")[v]; if (b) b.click(); }
        }, knob, val);
        for (const kn of knobs) {
          await turn(kn, kn.range != null ? kn.v : kn.seg); await wait(40);
          const end = await lastStep(stage);
          for (let t = 0; t <= end; t++) {
            await setStep(stage, t); await wait(12);
            const r = await inspect(stage);
            const where = `stage ${i} mode ${k} with ${kn.name}${kn.range != null ? " = " + kn.v : ""}, step ${t + 1}/${end + 1}`;
            if (!r.caption.trim()) problems.push(`${where}: empty caption`);
            const junk = (r.caption + " " + r.labels).match(/\b(?:undefined|NaN|null)\b|\[object|(?<![\d.])-0(?:\.0+)?(?![\d.])/);
            if (junk) problems.push(`${where}: "${junk[0]}" on screen`);
            [...new Set(r.overlaps)].forEach((o) => problems.push(`${where}: overlapping labels ${o}`));
            [...new Set(r.clipped)].forEach((o) => problems.push(`${where}: label outside the picture "${o}"`));
            [...new Set(r.wide)].forEach((o) => problems.push(`${where}: "${o}" is wider than its cell`));
            swept++;
          }
          await turn(kn, kn.back); await wait(30);
        }
      }
    }
  }
  await browser.close();
  const all = [...new Set([...errors, ...problems])];
  console.log(all.length ? `PROBLEMS (${all.length}):\n` + all.slice(0, 60).join("\n") + (all.length > 60 ? `\n… and ${all.length - 60} more` : "") : `OK — ${checked} steps checked, plus ${swept} with inputs at their extremes: no overlaps, no clipped labels, and Next, Back and the slider agree. Screenshots in ${path.relative(process.cwd(), a.out)}`);
  process.exit(all.length ? 1 : 0);
})().catch((e) => { console.error("steps crashed:", e); process.exit(2); });
