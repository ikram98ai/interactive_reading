/* Review helper: press each stage's main button, wait for the sim to settle, screenshot the result.

   node tools/play.js books/ddia/ch11.html [--light|--dark] [--presses=N] [--seg=K] [--out=<dir>]

   smoke.js ends most stages on "Reset", which hides the busiest moments. This captures them instead —
   that is where overlapping labels and leftover flying parcels show up. Look at the PNGs afterwards.
     --presses=N  press the primary button N times (sandbox sims need several)            default 1
     --seg=K      first pick the K-th option of the stage's segmented control (0-based)  default: leave as is */
const path = require("path");
const { parseArgs, open, wait, frame } = require("./browser");

(async () => {
  const a = parseArgs(process.argv, "usage: node tools/play.js <chapter.html> [--light|--dark] [--presses=N] [--seg=K] [--out=dir]");
  const presses = a.num("presses", 1), segIdx = a.num("seg", -1);
  const tag = a.base + (segIdx >= 0 ? `-seg${segIdx}` : "") + (presses > 1 ? `-x${presses}` : "") + (a.theme ? "-" + a.theme : "") + "-played";
  const { browser, page, errors } = await open(a.file, { theme: a.theme, speed: 5, height: 1000 });

  // settled = svg markup, button states and caption all unchanged for ~1.2s (capped at 14s for endless loops)
  async function settle(stage) {
    let last = "", same = 0;
    for (let k = 0; k < 56; k++) {
      await wait(250);
      const sig = await stage.evaluate((el) => {
        const svg = el.querySelector("svg");
        return (svg ? svg.innerHTML.length + ":" + svg.querySelectorAll("*").length : "") + "|" +
          [...el.querySelectorAll("button")].map((b) => (b.disabled ? 1 : 0)).join("") + "|" + (el.querySelector(".caption") || {}).textContent;
      });
      if (sig === last) { if (++same >= 5) return; } else { same = 0; last = sig; }
    }
  }

  const n = await page.$$eval(".stage", (els) => els.length);
  let shot = 0;
  for (let i = 0; i < n; i++) {
    const stage = (await page.$$(".stage"))[i];
    await frame(stage);
    await wait(400);
    if (segIdx >= 0) {
      const ok = await stage.evaluate((el, k) => { const b = el.querySelectorAll(".seg button")[k]; if (!b) return false; b.click(); return true; }, segIdx);
      if (!ok) continue; // this stage has no such mode
      await settle(stage);
    }
    for (let p = 0; p < presses; p++) {
      const pressed = await stage.evaluate((el) => {
        const b = [...el.querySelectorAll(".controls .btn.primary, .stage-head .btn.primary")].find((x) => !x.disabled);
        if (!b) return false; b.click(); return true;
      });
      if (!pressed) break;
      await settle(stage);
    }
    await stage.screenshot({ path: path.join(a.out, `${tag}-stage${i}.png`) });
    shot++;
  }
  await browser.close();
  console.log(errors.length ? "PROBLEMS:\n" + [...new Set(errors)].join("\n") : `OK — ${shot} of ${n} stages played. Screenshots in ${path.relative(process.cwd(), a.out)}`);
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error("play crashed:", e); process.exit(2); });
