#!/usr/bin/env node
/* studio_upload.js <book dir> [--from ch04/18] [--to ch05/18] [--plan] [--limit N]
   Uploads lessons through YouTube Studio's web UI (no API), in course order, and for each one sets
   the title, the description, "not made for kids", the .srt captions, and a scheduled publish time.

   Titles and descriptions come from <ch>/youtube-meta.json; the publish day from <book>/schedule.json
   (lessons on the same day go out GAP_HOURS apart from its "at", in Studio's channel time zone). The thumbnail is
   the video's first frame, its title card, saved beside it as <video>.thumb.jpg. --steps screenshots each dialog step.
   Progress is written to <lesson>/<video>.youtube.json, so a rerun skips what is already up.
   --plan prints what would be uploaded and stops. --edit instead updates lessons already up (thumbnail, publish time). Chrome profile: ~/.config/interactive-reading/chrome-studio. */
const fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto"), cp = require("child_process");
const { chromium } = require("playwright-core");

const SERIES = "Intro to DSA with Rust";
const TAGS = "#algorithms #rust #datastructures #dsa #computerscience";
const SITE = "https://ikram98ai.github.io/interactive_reading/books";
const GAP_HOURS = 2, LAST_HOUR = 22; // same-day lessons go out 2 h apart from "at" (18, 20, 22); a day with more
                                     // starts earlier so the last is out at 22:00 (5 lessons: 14, 16, 18, 20, 22)
const CHAPTERS = { // the chapter names used in every lesson's description
  ch01: "What Algorithms Are, and Why They Matter", ch02: "Proving and Measuring Algorithms",
  ch03: "Big O, Omega, and Theta", ch04: "Divide and Conquer, and How Fast It Really Is",
  ch05: "Probability, and Algorithms That Roll Dice",
};

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const BOOK = path.resolve(args.find((a, i) => !a.startsWith("--") && !["--from", "--to", "--limit"].includes(args[i - 1])) || "videos/clrs");
const FROM = opt("--from"), TO = opt("--to"), LIMIT = Number(opt("--limit") || 1e9), PLAN = args.includes("--plan");
const SHOTS = BOOK;
const STEPS = args.includes("--steps") ? path.join(BOOK, "studio-steps") : null; // a screenshot of each dialog step, to check a run
if (STEPS) fs.mkdirSync(STEPS, { recursive: true });

const key = (ch, n) => `${ch}/${String(n).padStart(2, "0")}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function plan() {
  const sched = JSON.parse(fs.readFileSync(path.join(BOOK, "schedule.json"), "utf8"));
  const when = {}; // "ch04/18" -> { day, minute }
  for (const [day, ids] of Object.entries(sched.days)) ids.forEach((id, i) => (when[id] = { day, minute: i, count: ids.length }));
  const items = [];
  for (const ch of fs.readdirSync(BOOK).filter((d) => /^ch\d+$/.test(d)).sort()) {
    const meta = JSON.parse(fs.readFileSync(path.join(BOOK, ch, "youtube-meta.json"), "utf8"));
    const lessons = fs.readdirSync(path.join(BOOK, ch)).filter((d) => /^\d\d-/.test(d)).sort();
    const whole = JSON.parse(fs.readFileSync(path.join(BOOK, ch, `${ch}-bm_fable.youtube.json`), "utf8")).video_id;
    const cn = Number(ch.slice(2));
    for (const dir of lessons) {
      const n = Number(dir.slice(0, 2)), id = key(ch, n);
      if (FROM && id < FROM) continue;
      if (TO && id > TO) continue;
      const m = meta[dir];
      if (!m) throw new Error(`${ch}/youtube-meta.json has no entry for ${dir}`);
      const w = when[id];
      if (!w) throw new Error(`schedule.json has no day for ${id}`);
      const [hh, mm] = sched.at.split(":").map(Number);
      const startMin = Math.min(hh * 60 + mm, LAST_HOUR * 60 - (w.count - 1) * GAP_HOURS * 60);
      const total = startMin + w.minute * GAP_HOURS * 60, h = Math.floor(total / 60), mi = total % 60;
      if (h > 23) throw new Error(`${id}: ${w.day} has too many lessons to space ${GAP_HOURS} h apart from ${sched.at}`);
      const [y, mo, d] = w.day.split("-").map(Number);
      const utc = new Date(Date.UTC(y, mo - 1, d, h - 5, mi)); // Asia/Karachi is UTC+5, no DST
      const title = `${cn}.${n} ${m.title} | ${SERIES}`;
      const description = `${m.description}\n\nChapter ${cn} (${CHAPTERS[ch]}), lesson ${n} of ${lessons.length} in ${SERIES}, ` +
        `a course through Introduction to Algorithms with interactive pages and Rust code.\n\n` +
        `Interactive page for this chapter: ${SITE}/${path.basename(BOOK)}/${ch}.html\n` +
        `The whole chapter as one video: https://youtu.be/${whole}\n\n${TAGS}`;
      if (title.length > 100) throw new Error(`${id}: title is ${title.length} characters (Studio allows 100)`);
      if (description.length > 5000 || /[<>]/.test(description)) throw new Error(`${id}: description Studio would reject`);
      const stem = `${dir}-bm_fable`, folder = path.join(BOOK, ch, dir);
      items.push({
        id, folder, title, description, video: path.join(folder, `${stem}.mp4`), srt: path.join(folder, `${stem}.srt`),
        record: path.join(folder, `${stem}.youtube.json`), thumb: path.join(folder, `${stem}.thumb.jpg`),
        date: `${MONTHS[mo - 1]} ${d}, ${y}`, time: `${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`,
        publish_at: utc.toISOString().replace(".000", ""),
        meta: crypto.createHash("sha1").update(title + "\n" + description).digest("hex").slice(0, 12),
      });
    }
  }
  return items;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shot = (page, it, step) => STEPS && page.screenshot({ path: path.join(STEPS, `${it.id.replace("/", "-")}-${step}.png`) });
const DIALOG = "ytcp-uploads-dialog"; // everything below is inside it; the edit page behind has its own title box

async function setText(page, box, text) {
  await box.waitFor({ state: "visible", timeout: 60000 });
  await box.click();
  await page.keyboard.press("Meta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(text);
  await sleep(500);
  const got = (await box.innerText()).trim();
  if (got !== text.trim()) throw new Error(`text reads back differently (${got.length} vs ${text.trim().length} chars)`);
}

async function limitReached(page) {
  return page.getByText("Daily upload limit reached").first().isVisible().catch(() => false);
}

// a file chooser opened by clicking `target`; never leaves a dangling promise behind
async function chooseFile(page, target, file) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 30000 }), target.click()]);
  await chooser.setFiles(file);
}

async function addCaptions(page, dlg, it) {
  await dlg.locator("#subtitles-button").click({ timeout: 30000 });
  await sleep(4000);
  const more = page.locator("#more-actions-menu").last();
  if (await more.isVisible().catch(() => false)) { // the editor opened straight away (Studio may have its own text in it)
    await more.click(); await sleep(1000);
    await page.locator("tp-yt-paper-item").filter({ hasText: /^\s*Upload file\s*$/ }).last().click();
  } else {
    await page.getByText(/^\s*Upload file\s*$/).last().click();
  }
  await sleep(1500);
  await shot(page, it, "captions-choice");
  await page.locator("tp-yt-paper-radio-button").filter({ hasText: /^\s*With timing/i }).last().click();
  await sleep(500);
  await chooseFile(page, page.locator("ytcp-button").filter({ hasText: /^\s*Continue\s*$/ }).last(), it.srt);
  await sleep(3000);
  // replacing text Studio already had asks first
  const confirm = page.locator("ytcp-button").filter({ hasText: /^\s*(Continue|Replace|Confirm)\s*$/ }).last();
  if (await confirm.isVisible().catch(() => false)) { await confirm.click(); await sleep(3000); }
  // the cues are text boxes, and the editor shows times as m:ss:frames
  const first = fs.readFileSync(it.srt, "utf8").split(/\r?\n\r?\n/)[0].split(/\r?\n/).slice(2).join(" ").trim().slice(0, 18);
  await page.waitForFunction((t) => [...document.querySelectorAll("textarea")].some((e) => e.value.includes(t)), first, { timeout: 30000 });
  await shot(page, it, "captions");
  await page.locator("ytcp-button#publish-button").filter({ hasText: /Done/ }).last().click();
  let row = "";
  for (let i = 0; i < 30 && !/edit/i.test(row); i++) { // saving takes a few seconds; the row's button turns from Add to Edit
    await sleep(1000);
    row = (await dlg.locator("#subtitles-button").innerText().catch(() => "")).trim();
  }
  if (!/edit/i.test(row)) throw new Error(`subtitles did not save (button reads "${row}")`);
}

async function openNew(page, it) {
  await page.goto("https://studio.youtube.com", { waitUntil: "domcontentloaded" });
  await page.locator("#upload-icon, ytcp-button#create-icon").first().click({ timeout: 60000 });
  const menuUpload = page.locator("#text-item-0");
  if (await menuUpload.isVisible().catch(() => false)) await menuUpload.click();
  const input = page.locator("input[type=file][name=Filedata]");
  await input.waitFor({ state: "attached", timeout: 60000 });
  await input.setInputFiles(it.video);
  await page.locator(`${DIALOG} #title-textarea #textbox`).waitFor({ timeout: 120000 });
  await sleep(3000);
  return !(await limitReached(page));
}

async function openDraft(page, id) {
  await page.goto(`https://studio.youtube.com/video/${id}/edit`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /edit draft/i }).first().click({ timeout: 60000 });
  await page.locator(`${DIALOG} #title-textarea #textbox`).waitFor({ timeout: 60000 });
  await sleep(2000);
}

async function upload(page, it) {
  let rec = fs.existsSync(it.record) ? JSON.parse(fs.readFileSync(it.record, "utf8")) : null;
  if (rec) await openDraft(page, rec.video_id); // uploaded before, but not finished
  else if (!(await openNew(page, it))) return "limit";
  const dlg = page.locator(DIALOG);

  await setText(page, dlg.locator("#title-textarea #textbox"), it.title);
  await setText(page, dlg.locator("#description-textarea #textbox"), it.description);
  // thumbnail: the video's first frame, its title card
  cp.execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", it.video, "-frames:v", "1", "-vf", "scale=1280:720", "-q:v", "2", it.thumb]);
  await dlg.locator("input#file-loader").first().setInputFiles(it.thumb);
  await sleep(4000);
  const thumbErr = await dlg.locator("ytcp-thumbnails-compact-editor-uploader .error, #thumbnail-error").first().innerText().catch(() => "");
  if (thumbErr.trim()) throw new Error(`thumbnail refused: ${thumbErr.trim()}`);
  await dlg.locator("tp-yt-paper-radio-button[name=VIDEO_MADE_FOR_KIDS_NOT_MFK]").first().click();
  // video language: subtitles can't be added without it
  await dlg.locator("#toggle-button").click(); await sleep(1500);
  const lang = dlg.locator("ytcp-form-language-input").first();
  await lang.scrollIntoViewIfNeeded();
  if (!/English/.test(await lang.innerText())) {
    await lang.click(); await sleep(1200);
    await page.locator("tp-yt-paper-item").filter({ hasText: /^\s*English\s*$/ }).first().click(); await sleep(1200);
    if (!/English/.test(await lang.innerText())) throw new Error("video language did not set");
  }
  await shot(page, it, "details");

  if (!rec) { // the video's link shows once Studio has made the video
    let videoId = null;
    for (let i = 0; i < 60 && !videoId; i++) {
      const href = await dlg.locator("ytcp-video-info a[href*='youtu']").first().getAttribute("href").catch(() => null);
      videoId = href && (href.match(/youtu\.be\/([\w-]{11})/) || [])[1];
      if (!videoId) await sleep(2000);
    }
    if (!videoId) throw new Error("Studio never showed the video link");
    rec = { video_id: videoId, title: it.title, via: "studio", meta: it.meta };
    fs.writeFileSync(it.record, JSON.stringify(rec, null, 2) + "\n"); // so a rerun never uploads it twice
  }

  await dlg.locator("#step-badge-1").click(); await sleep(2500); // Video elements
  await addCaptions(page, dlg, it);
  await dlg.locator("#step-badge-3").click(); await sleep(2500); // Visibility
  await shot(page, it, "visibility-0");

  await dlg.locator("#second-container-expand-button").click();
  await sleep(1500);
  await dlg.locator("#datepicker-trigger").click(); await sleep(1000);
  const dateInput = page.locator("ytcp-date-picker tp-yt-paper-input input, ytcp-date-picker input").last();
  await dateInput.waitFor({ state: "visible", timeout: 15000 });
  await dateInput.fill(it.date);
  await dateInput.press("Enter");
  await sleep(1000);
  const timeInput = dlg.locator("#time-of-day-container input").first();
  await timeInput.click();
  await timeInput.fill(it.time);
  await timeInput.press("Enter");
  await sleep(1000);
  const shownDate = (await dlg.locator("#datepicker-trigger").first().innerText()).trim();
  const shownTime = await timeInput.inputValue();
  await shot(page, it, "visibility");
  if (!shownDate.includes(it.date) || shownTime.replace(/\s/g, "") !== it.time.replace(/\s/g, ""))
    throw new Error(`schedule reads back as ${shownDate} ${shownTime}, wanted ${it.date} ${it.time}`);

  // let the file finish uploading before closing, or the upload is lost
  for (let i = 0; i < 900; i++) {
    const t = await dlg.locator(".progress-label").first().innerText().catch(() => "");
    if (!/uploading/i.test(t)) break;
    await sleep(2000);
  }
  await dlg.locator("#done-button").click();
  await sleep(4000);
  const warn = page.locator("ytcp-prechecks-warning-dialog #primary-action-button");
  if (await warn.isVisible().catch(() => false)) { await warn.click(); await sleep(3000); }
  await shot(page, it, "done");
  // Studio's confirmation: "Video scheduled ... will be set to public on <date> at <time>"
  await page.getByText(/will be set to public on/i).first().waitFor({ timeout: 90000 })
    .catch(() => { throw new Error("Studio did not confirm the schedule"); });
  Object.assign(rec, { title: it.title, meta: it.meta, captions: "studio", thumbnail: "first-frame", publish_at: it.publish_at });
  fs.writeFileSync(it.record, JSON.stringify(rec, null, 2) + "\n");
  await page.keyboard.press("Escape").catch(() => {});
  return rec.video_id;
}

// --edit: for lessons already up, set the first-frame thumbnail and move the publish time to the plan's
async function edit(page, it, rec) {
  await page.goto(`https://studio.youtube.com/video/${rec.video_id}/edit`, { waitUntil: "domcontentloaded" });
  await page.locator("#title-textarea #textbox").first().waitFor({ timeout: 60000 });
  await sleep(3000);
  const changed = [];
  if (rec.thumbnail !== "first-frame") {
    cp.execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", it.video, "-frames:v", "1", "-vf", "scale=1280:720", "-q:v", "2", it.thumb]);
    await page.locator("input#file-loader").first().setInputFiles(it.thumb);
    await sleep(4000);
    changed.push("thumbnail");
  }
  let status = "scheduled";
  if (rec.publish_at !== it.publish_at || rec.schedule_checked !== true) {
    await page.locator("ytcp-video-metadata-visibility").first().click();
    await sleep(2500);
    const trigger = page.locator("#datepicker-trigger").first();
    if (!(await trigger.isVisible().catch(() => false))) { // already public: its time can't move
      status = "public";
      await page.keyboard.press("Escape"); await sleep(1000);
    } else if (new Date(it.publish_at) <= new Date(Date.now() + 15 * 60000)) {
      status = "too-soon"; // Studio won't schedule into the past, and a time this close isn't worth moving
      await page.keyboard.press("Escape"); await sleep(1000);
    } else {
      await trigger.click(); await sleep(1000);
      const dateInput = page.locator("ytcp-date-picker tp-yt-paper-input input, ytcp-date-picker input").last();
      await dateInput.waitFor({ state: "visible", timeout: 15000 });
      await dateInput.fill(it.date); await dateInput.press("Enter"); await sleep(1000);
      const timeInput = page.locator("#time-of-day-container input").first();
      await timeInput.click(); await timeInput.fill(it.time); await timeInput.press("Enter"); await sleep(1000);
      const shownDate = (await trigger.innerText()).trim(), shownTime = await timeInput.inputValue();
      await shot(page, it, "edit-schedule");
      if (!shownDate.includes(it.date) || shownTime.replace(/\s/g, "") !== it.time.replace(/\s/g, ""))
        throw new Error(`schedule reads back as ${shownDate} ${shownTime}, wanted ${it.date} ${it.time}`);
      const doneBtn = page.locator("ytcp-button#save-button").first();
      if (await doneBtn.isEnabled() && (await doneBtn.getAttribute("aria-disabled")) !== "true") {
        await doneBtn.click(); await sleep(1500);
        changed.push("schedule");
      } else { // already at that time: Studio greys out Done when nothing changed
        await page.keyboard.press("Escape"); await sleep(1000);
        rec.publish_at = it.publish_at;
      }
    }
  }
  if (changed.length) {
    const save = page.locator("ytcp-button#save").first();
    await save.click();
    let saved = false;
    for (let i = 0; i < 30 && !saved; i++) {
      await sleep(1000);
      saved = (await save.getAttribute("aria-disabled").catch(() => null)) === "true" || !(await save.isEnabled().catch(() => true));
    }
    if (!saved) throw new Error("Studio did not save the changes");
    await shot(page, it, "edit-saved");
  }
  if (changed.includes("thumbnail")) rec.thumbnail = "first-frame";
  if (changed.includes("schedule")) rec.publish_at = it.publish_at;
  rec.schedule_checked = true;
  rec.status = status;
  fs.writeFileSync(it.record, JSON.stringify(rec, null, 2) + "\n");
  return { changed, status };
}

(async () => {
  if (args.includes("--edit")) {
    const items = plan().filter((it) => fs.existsSync(it.record)).map((it) => [it, JSON.parse(fs.readFileSync(it.record, "utf8"))])
      .filter(([it, rec]) => rec.thumbnail !== "first-frame" || rec.schedule_checked !== true ||
        (rec.status !== "public" && rec.publish_at !== it.publish_at)); // a public lesson's time can't move
    console.log(`${items.length} lessons to update`);
    if (PLAN) { for (const [it] of items) console.log(`${it.id}  → ${it.date} ${it.time} PKT  ${it.title}`); return; }
    const ctx = await chromium.launchPersistentContext(path.join(os.homedir(), ".config/interactive-reading/chrome-studio"), {
      channel: "chrome", headless: false, viewport: null,
      ignoreDefaultArgs: ["--enable-automation"], args: ["--disable-blink-features=AutomationControlled", "--window-size=1400,1000"],
    });
    const page = ctx.pages()[0] || (await ctx.newPage());
    let n = 0;
    try {
      for (const [it, rec] of items.slice(0, LIMIT)) {
        const r = await edit(page, it, rec);
        n++;
        console.log(`  updated ${it.id} https://youtu.be/${rec.video_id}  ${r.changed.join("+") || "nothing"}` +
          `${r.status === "scheduled" ? `  → ${it.date} ${it.time}` : `  (${r.status}, time kept)`}  (${n}/${items.length})`);
      }
    } catch (e) {
      const shotPath = path.join(SHOTS, "studio-edit-error.png");
      await page.screenshot({ path: shotPath }).catch(() => {});
      console.log(`STOPPED: ${e.message.split("\n")[0]}\n  screenshot: ${shotPath}`);
      process.exitCode = 1;
    } finally { await ctx.close(); }
    return;
  }
  const finished = (it) => fs.existsSync(it.record) && JSON.parse(fs.readFileSync(it.record, "utf8")).publish_at;
  const todo = plan().filter((it) => !finished(it));
  console.log(`${todo.length} lessons to upload`);
  if (PLAN) {
    for (const it of todo) console.log(`${it.id}  ${it.date} ${it.time} PKT (${it.publish_at})  ${it.title}`);
    return;
  }
  const ctx = await chromium.launchPersistentContext(path.join(os.homedir(), ".config/interactive-reading/chrome-studio"), {
    channel: "chrome", headless: false, viewport: null,
    ignoreDefaultArgs: ["--enable-automation"], args: ["--disable-blink-features=AutomationControlled", "--window-size=1400,1000"],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  let done = 0;
  try {
    for (const it of todo.slice(0, LIMIT)) {
      console.log(it.id);
      const r = await upload(page, it);
      if (r === "limit") { console.log("STOPPED: Studio's daily upload limit is reached"); break; }
      done++;
      console.log(`  uploaded https://youtu.be/${r}  ${it.title}  → ${it.date} ${it.time}  (${done}/${todo.length})`);
    }
  } catch (e) {
    const shot = path.join(SHOTS, "studio-upload-error.png");
    await page.screenshot({ path: shot }).catch(() => {});
    console.log(`STOPPED: ${e.message.split("\n")[0]}\n  screenshot: ${shot}`);
    process.exitCode = 1;
  } finally {
    await ctx.close();
  }
})();
