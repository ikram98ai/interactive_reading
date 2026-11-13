/* trace.js <chapter.html> <scene id> ["setup; setup"] [--max=N] [--btn=Step] — what a machine shows, one press at a time.

   Prints the scene's pseudocode listing, numbered as {focus code:N} counts it (the header line is 0), then presses Step
   (or --btn) until nothing changes. Each press prints one line: the pseudocode lines it lights, with the values the page
   writes beside them, then the caption, then the stats. A long-form script walks the pseudocode from this, so every
   {click Step xN} lands on the line the narration names, and every value it says can be {check}ed against the caption.
   Setup runs first, in order: a button's text (a mode or an input, such as "Dijkstra" or "Reversed"), or "slider <i> <v>". */
const { open, wait } = require("../browser/browser.js");
(async () => {
  const [file, id, setup = ""] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const opt = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
  const max = +opt("max", 400), btn = opt("btn", "Step");
  const { browser, page, errors } = await open(require("path").resolve(file), { speed: 50, height: 1000 });
  await page.evaluate(() => { if (window.AL && AL.CODE_LANG) AL.CODE_LANG.set("pseudo"); });
  const click = (label) => page.evaluate(([id, label]) => {
    const s = document.getElementById(id); if (!s) return "no stage";
    const st = s.querySelector(".stage") || s;
    const b = [...st.querySelectorAll("button, [aria-label]")].find((e) => (e.tagName === "BUTTON" ? e.textContent.trim() : e.getAttribute("aria-label")) === label);
    if (!b) return "no button " + label; if (b.disabled) return "disabled";
    b.dispatchEvent(new MouseEvent("click", { bubbles: true })); if (b.tagName === "BUTTON") b.click && null; return "ok";
  }, [id, label]);
  const slide = (i, v) => page.evaluate(([id, i, v]) => { const s = document.getElementById(id); const inp = s.querySelectorAll("input[type=range]")[i]; inp.value = v; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); }, [id, +i, +v]);
  const read = () => page.evaluate((id) => {
    const s = document.getElementById(id); const st = s.querySelector(".stage") || s;
    const lis = [...st.querySelectorAll(".cp-body li")];
    const lit = lis.map((li, n) => li.classList.contains("on") ? `code:${n} ${li.innerText.replace(/\s+/g, " ").trim()}` : null).filter(Boolean);
    return { lit: lit.join(" ‖ "), cap: (st.querySelector(".caption") || {}).textContent || "", stats: [...st.querySelectorAll(".statrow > *")].map((e) => e.textContent.trim()).join(" | ") };
  }, id);
  for (const c of setup.split(";").map((x) => x.trim()).filter(Boolean)) {
    const m = c.match(/^slider (\d+) ([\d.]+)$/);
    const r = m ? (await slide(m[1], m[2]), "ok") : await click(c);
    console.log(`setup ${c}: ${r}`); await wait(400);
  }
  const listing = await page.evaluate((id) => { const s = document.getElementById(id); const st = s.querySelector(".stage") || s; return [...st.querySelectorAll(".cp-body li")].map((li, n) => `   code:${n}  ${li.innerText.replace(/\s+$/, "")}`).join("\n"); }, id);
  console.log("listing:\n" + listing);
  let r = await read(); console.log(`0 [${r.lit}] ${r.cap} {${r.stats}}`);
  let same = 0, prev = r.cap + r.lit;
  for (let k = 1; k <= max; k++) {
    const res = await click(btn); if (res !== "ok") { console.log(`(${btn}: ${res})`); break; }
    await wait(btn === "Step" ? 120 : 2500);
    for (let t = 0; t < 40; t++) { const busy = await page.evaluate(() => !!document.querySelector(".is-playing, [aria-busy=true]")); if (!busy) break; await wait(150); }
    r = await read();
    const cur = r.cap + r.lit;
    if (cur === prev) { if (++same >= 2) { console.log("(no change)"); break; } } else same = 0;
    prev = cur;
    console.log(`${k} [${r.lit}] ${r.cap} {${r.stats}}`);
    if (btn !== "Step") break;
  }
  if (errors.length) console.log("ERRORS", errors);
  await browser.close();
})();
