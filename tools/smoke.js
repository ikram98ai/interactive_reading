/* Smoke-test one chapter page in headless Chrome.

   node tools/smoke.js books/ddia/ch11.html [--light|--dark] [--only=<stage index>] [--out=<dir>]

   Clicks every control in every .stage (rapidly, in a dumb order, even mid-animation) and fails on:
     - JavaScript errors
     - SVG text that pokes outside its viewBox (clipped labels)
     - horizontal page scroll at phone width (390px)
   Saves a before (-a) and after (-b) screenshot of each stage. Stage 0 is the hero. */
const path = require("path");
const { parseArgs, open, wait, frame } = require("./browser");

(async () => {
  const a = parseArgs(process.argv, "usage: node tools/smoke.js <chapter.html> [--light|--dark] [--only=N] [--out=dir]");
  const only = a.num("only", null);
  const tag = a.base + (a.theme ? "-" + a.theme : "");
  const { browser, page, errors } = await open(a.file, { theme: a.theme });

  const stageCount = await page.$$eval(".stage", (els) => els.length);
  console.log(`stages: ${stageCount}`);
  const CLICKABLE = "button, .clickable, [role=button]";

  for (let i = 0; i < stageCount; i++) {
    if (only !== null && only !== i) continue;
    const stage = (await page.$$(".stage"))[i];
    await frame(stage);
    await wait(500);
    await stage.screenshot({ path: path.join(a.out, `${tag}-stage${i}-a.png`) });
    for (let round = 0; round < 2; round++) {
      const n = await stage.$$eval(CLICKABLE, (els) => els.length);
      for (let b = 0; b < n; b++) {
        const el = (await stage.$$(CLICKABLE))[b];
        if (!el) continue;
        const ok = await el.evaluate((e) => !e.disabled && e.getAttribute("aria-disabled") !== "true");
        if (!ok) continue;
        try { await el.evaluate((e) => e.dispatchEvent(new MouseEvent("click", { bubbles: true }))); }
        catch (e) { errors.push(`click failed in stage ${i}: ${e.message}`); }
        // wait for the sim to go idle (some button re-enabled) or ~2.5s, whichever comes first
        await wait(350);
        for (let k = 0; k < 9; k++) {
          const busy = await stage.$$eval("button", (bs) => bs.length > 0 && bs.every((x) => x.disabled));
          if (!busy) break;
          await wait(250);
        }
      }
      for (const sl of await stage.$$("input[type=range]")) {
        await sl.evaluate((e, r) => {
          const min = Number(e.min || 0), max = Number(e.max || 100);
          e.value = String(r === 0 ? max : min + (max - min) / 3);
          e.dispatchEvent(new Event("input", { bubbles: true }));
          e.dispatchEvent(new Event("change", { bubbles: true }));
        }, round);
        await wait(200);
      }
    }
    await wait(900);
    await stage.screenshot({ path: path.join(a.out, `${tag}-stage${i}-b.png`) });
  }

  if (only === null) {
    // quiz: answer everything (exercises the "chapter explored" path)
    for (const o of await page.$$(".q .opts")) { const b = await o.$("button"); if (b) await b.evaluate((e) => e.click()); }
    await wait(300);

    const clipped = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll(".stage svg").forEach((svg) => {
        const vb = svg.viewBox.baseVal; if (!vb || !vb.width) return;
        svg.querySelectorAll("text").forEach((t) => {
          if (!t.textContent.trim()) return;
          let op = 1;
          for (let n = t; n && n !== svg; n = n.parentNode) { const cs = getComputedStyle(n); op *= Number(cs.opacity); if (cs.display === "none" || cs.visibility === "hidden") op = 0; }
          if (op < 0.05) return;
          let bb; try { bb = t.getBBox(); } catch (e) { return; }
          const m = t.getCTM(), sm = svg.getCTM(); if (!m || !sm) return;
          const inv = sm.inverse().multiply(m);
          const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y + bb.height]].map(([x, y]) => ({ x: x * inv.a + y * inv.c + inv.e, y: x * inv.b + y * inv.d + inv.f }));
          const x0 = Math.min(pts[0].x, pts[1].x), x1 = Math.max(pts[0].x, pts[1].x), y0 = Math.min(pts[0].y, pts[1].y), y1 = Math.max(pts[0].y, pts[1].y);
          if (x1 < vb.x - 50 || y1 < vb.y - 50) return; // parked off-stage on purpose (K.draw.parcel / tag)
          if (x0 < vb.x - 1 || x1 > vb.x + vb.width + 1 || y0 < vb.y - 1 || y1 > vb.y + vb.height + 1)
            bad.push(`#${svg.id}: "${t.textContent.slice(0, 40)}" x ${x0.toFixed(0)}..${x1.toFixed(0)}, y ${y0.toFixed(0)}..${y1.toFixed(0)} (viewBox ${vb.width}x${vb.height})`);
        });
      });
      return bad;
    });
    clipped.forEach((c) => errors.push("clipped svg text: " + c));

    await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 1 });
    await wait(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) errors.push(`page scrolls horizontally by ${overflow}px at 390px wide`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(a.out, `${tag}-phone-top.png`) });
  }

  await browser.close();
  if (errors.length) { console.log("PROBLEMS:\n" + [...new Set(errors)].join("\n")); process.exit(1); }
  console.log((only === null
    ? "OK — no JS errors, no clipped SVG text, no phone overflow."
    : `OK — no JS errors in stage ${only}. (--only skips the clipped-text and phone-width checks; run without it before shipping.)`)
    + " Screenshots in " + path.relative(process.cwd(), a.out));
  process.exit(0); // puppeteer can keep node alive after close(); don't linger
})().catch((e) => { console.error("smoke crashed:", e); process.exit(2); });
