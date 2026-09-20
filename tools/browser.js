/* Shared by smoke.js and play.js: find Chrome, open a chapter page, parse the common flags. */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error("Chrome not found. Set CHROME_PATH to a Chrome or Chromium binary.");
  return found;
}

/** parseArgs(process.argv) → { file, base, theme, out, num(name, default) } */
function parseArgs(argv, usage) {
  const args = argv.slice(2);
  const target = args.find((a) => !a.startsWith("--"));
  if (!target) { console.error(usage); process.exit(2); }
  const file = path.resolve(target);
  if (!fs.existsSync(file)) { console.error("no such page: " + file); process.exit(2); }
  const opt = (name) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
  const theme = args.includes("--dark") ? "dark" : args.includes("--light") ? "light" : null;
  // books/ddia/ch11.html → ddia-ch11
  const base = path.basename(path.dirname(file)) + "-" + path.basename(file, ".html");
  const out = path.resolve(opt("out") || path.join(__dirname, ".shots", base));
  fs.mkdirSync(out, { recursive: true });
  return { file, base, theme, out, opt, num: (name, d) => (opt(name) === null ? d : Number(opt(name))) };
}

/** Open the page with animations sped up. The OS theme leaks into headless Chrome, so pass a theme to pin it. */
async function open(file, { theme, speed = 6, width = 1280, height = 900 } = {}) {
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: "new",
    args: ["--no-sandbox", "--allow-file-access-from-files"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource|fonts\.g/.test(t)) return; // offline font fetches are not page bugs
    errors.push("console.error: " + t);
  });
  if (theme) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto("file://" + file, { waitUntil: "load" });
  await wait(800);
  await page.evaluate((v) => { if (window.K) K.speed.value = v; }, speed);
  return { browser, page, errors };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Scroll a stage just below the sticky top bar so the bar doesn't photobomb the screenshot. */
const frame = (stage) => stage.evaluate((el) => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 80));

module.exports = { ROOT, parseArgs, open, wait, frame };
