/* Step every step-through machine (AL.walk) in the Rust view, and find steps where the listing lights up nothing.

   node tools/rustview.js books/algo/ch34.html [--only=<scene id>] [--detail]

   A step with no highlight is fine when the step really has no Rust line (a setup step, a line the program does in
   another way). Past that, it means the code panel's map is missing an entry, and the panel goes dead while the
   machine moves. Prints a count per chapter and every scene over 25%; --detail lists the pseudocode lines each
   dark step asked for, so you can see which map entries to add. Never fails: it reports, and you judge. */
const { parseArgs, open } = require("./browser");

(async () => {
  const a = parseArgs(process.argv, "usage: node tools/rustview.js <chapter.html> [--only=sceneId] [--detail]");
  const only = a.opt("only"), detail = process.argv.includes("--detail");
  const { browser, page, errors } = await open(a.file, {});
  const res = await page.evaluate((onlyId) => {
    const out = [];
    const lit = "li.on, li.on2, li.good, li.bad, li.dim";
    [...document.querySelectorAll(".stage")].forEach((st) => {
      const r = st.querySelector(".wk-scrub input"), cp = st.querySelector(".codepane");
      if (!r || !cp) return;
      const scene = st.closest("section") ? st.closest("section").id : "?";
      if (onlyId && scene !== onlyId) return;
      const modes = [...st.querySelectorAll(".stage-head .seg button")];
      let steps = 0, dark = 0;
      const asked = {};
      for (const m of modes.length ? modes : [null]) {
        if (m) m.click();
        const last = Number(r.max);
        for (let i = 0; i <= last; i++) {
          const go = () => { r.value = String(i); r.dispatchEvent(new Event("input", { bubbles: true })); };
          AL.CODE_LANG.set("rust"); go();
          steps++;
          if (cp.querySelector(".cp-body li.on, .cp-body li.on2, .cp-body li.good, .cp-body li.bad, .cp-body li.dim")) continue;
          dark++;
          AL.CODE_LANG.set("pseudo"); go();
          const want = [...cp.querySelectorAll(`.cp-body ${lit.split(", ").join(`, .cp-body `)}`)].map((li) => (li.dataset.n ? li.dataset.n + ": " : "") + li.textContent.trim().slice(0, 60));
          const key = (m ? m.textContent + " · " : "") + (want.join(" + ") || "(nothing highlighted in pseudocode either)");
          asked[key] = (asked[key] || 0) + 1;
          AL.CODE_LANG.set("rust");
        }
      }
      out.push({ scene, steps, dark, asked });
    });
    AL.CODE_LANG.set("pseudo");
    return out;
  }, only);
  const tot = res.reduce((n, x) => n + x.steps, 0), dk = res.reduce((n, x) => n + x.dark, 0);
  console.log(`${a.base}: ${tot} steps, ${dk} with no Rust highlight (${tot ? ((100 * dk) / tot).toFixed(1) : 0}%)`);
  res.filter((x) => detail ? x.dark : x.dark / x.steps > 0.25).forEach((x) => {
    console.log(`  ${x.scene}: ${x.dark} of ${x.steps}`);
    if (detail) Object.entries(x.asked).forEach(([k, v]) => console.log(`      ×${v}  ${k}`));
  });
  if (errors.length) console.log("page errors:\n" + [...new Set(errors)].join("\n"));
  await browser.close();
})().catch((e) => { console.error("rustview crashed:", e); process.exit(2); });
