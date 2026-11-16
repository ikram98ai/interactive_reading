#!/usr/bin/env node
/* studio_upload.js <book dir> --long-form chNN [--day YYYY-MM-DD | --now] [--replaces <video id>] [--plan]
   Uploads one chapter's long form (chNN/chNN-<chapter>.mp4, such as ch06-heapsort.mp4) through YouTube Studio's web UI: the title (videos.long_form.title),
   a description of the intro line, the chapter page's link and the chapter timestamps (.chapters.txt), the large-title
   thumbnail, "not made for kids", English, the .srt captions, the playlist (videos.long_form.playlist), and a publish time
   of --day at the long form's time (--now publishes it as soon as Studio has it instead). It refuses unless `judgement.py check` passes, QA has no FAIL (qa.py, cached in
   <video>.qa.json and rerun only when the MP4 changes, about 5 minutes) and nothing is already up for that chapter: a
   record on disk, or one in the videos/ repo's history even if it was deleted. --replaces <id> uploads a new video in
   place of that one (its record moves to <video>.retired.youtube.json; unlisting the old video is done by hand).
   --plan prints all of it, problems included, and uploads nothing.

   studio_upload.js <book dir> --titles [--from ch04] [--to ch05] [--plan] [--limit N]
   Updates the title and the description's first line (videos.long_form.intro) of every long form already up, and never
   moves a publish time. --plan lists what would change.

   Everything goes through YouTube Studio's web UI (no API). The thumbnail is the chapter and title in large type
   (thumb.js), saved beside the video as <video>.thumb.jpg. --steps screenshots each dialog step. Progress is written to
   <video>.youtube.json, so a rerun resumes. Names, title formats, site and schedule come from books/<book>/book.json
   (its "videos" block). Chrome profile: ~/.config/interactive-reading/chrome-studio. */
const fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto"), cp = require("child_process");
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const VALUED = ["--from", "--to", "--limit", "--long-form", "--day", "--replaces"];
const BOOK = path.resolve(args.find((a, i) => !a.startsWith("--") && !VALUED.includes(args[i - 1])) || "videos/clrs");
const ROOT = path.join(__dirname, "../..");
const PROFILE = JSON.parse(fs.readFileSync(path.join(ROOT, "books", path.basename(BOOK), "book.json"), "utf8"));
const V = PROFILE.videos; // the long form's playlist, title format and intro, site, schedule
if (!V) throw new Error(`books/${path.basename(BOOK)}/book.json declares no videos`);
const SITE = V.site;
const LONG = opt("--long-form"), DAY = opt("--day"), REPLACES = opt("--replaces"), NOW = args.includes("--now");
const VOICE_TAG = V.voice.split(":").pop(); // kokoro:bm_fable → bm_fable, narrate.py's name for a video with no chapter title
// a chapter's long form is named after the book's chapter, as narrate.py names it: "Divide-and-Conquer" → divide-and-conquer
const longFormName = (chapter) => chapter.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const longFormStem = (ch) => `${ch}-${PROFILE.chapters[ch] ? longFormName(PROFILE.chapters[ch].book) : VOICE_TAG}`;
const hm = (t) => t.split(":").map(Number);
const UTC_OFFSET = V.schedule.utc_offset_hours;
const fill = (tpl, vals) => tpl.replace(/\{(\w+)\}/g, (_, k) => { if (!(k in vals)) throw new Error(`title format has no {${k}}`); return vals[k]; });
const FROM = opt("--from"), TO = opt("--to"), LIMIT = Number(opt("--limit") || 1e9), PLAN = args.includes("--plan"), TITLES = args.includes("--titles");
const SHOTS = BOOK;
const STEPS = args.includes("--steps") ? path.join(BOOK, "studio-steps") : null; // a screenshot of each dialog step, to check a run
if (STEPS) fs.mkdirSync(STEPS, { recursive: true });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// --titles: every long form already up, with the title and intro line book.json gives it now
function titlesPlan() {
  const items = [];
  for (const ch of fs.readdirSync(BOOK).filter((d) => /^ch\d+$/.test(d)).sort()) {
    const record = path.join(BOOK, ch, `${longFormStem(ch)}.youtube.json`), cn = Number(ch.slice(2));
    if (!fs.existsSync(record) || !PROFILE.chapters[ch] || (FROM && ch < FROM.slice(0, 4)) || (TO && ch > TO.slice(0, 4))) continue;
    const title = fill(V.long_form.title, { cn, book_chapter: PROFILE.chapters[ch].book });
    if (title.length > 100) throw new Error(`${ch} long-form: title is ${title.length} characters (Studio allows 100)`);
    // the long-form description is written in Studio; only its first line (what the video is) comes from book.json
    const intro = V.long_form.intro && fill(V.long_form.intro, { cn, book: PROFILE.title, short: PROFILE.short });
    items.push({ id: `${ch}/long-form`, kind: "long-form", title, record, intro,
      meta: intro && crypto.createHash("sha1").update(title + "\n" + intro).digest("hex").slice(0, 12) });
  }
  return items;
}

// ---- the long form: one chapter's whole-chapter video
const readJSON = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const git = (...a) => cp.execFileSync("git", ["-C", BOOK, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const secs = (t) => t.split(":").reduce((s, x) => s * 60 + Number(x), 0);
const fresh = (file, cache) => { const s = fs.statSync(file); return cache && cache.size === s.size && cache.mtimeMs === s.mtimeMs; };

// The publish time: `day` at the long form's time, in the channel's time zone (no DST), as Studio's dialog wants it.
const LONG_TIME = V.long_form.time;
function slot(day) {
  const [y, mo, d] = day.split("-").map(Number), [h, mi] = hm(LONG_TIME);
  const utc = new Date(Date.UTC(y, mo - 1, d, h - UTC_OFFSET, mi));
  return { date: `${MONTHS[mo - 1]} ${d}, ${y}`, time: `${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`,
    publish_at: utc.toISOString().replace(".000", ""), utc };
}

// YouTube makes chapters from description timestamps only if the first is 0:00, there are at least three, and each lasts 10 s.
function chapterLines(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter(Boolean), bad = [];
  const t = lines.map((l) => { const m = l.match(/^(\d+(?::\d\d){1,2})\s+\S/); if (!m) bad.push(`not "m:ss Title": ${l}`); return m ? secs(m[1]) : null; });
  if (t[0] !== 0) bad.push("the first chapter must start at 0:00");
  if (lines.length < 3) bad.push(`YouTube needs at least 3 chapters, this has ${lines.length}`);
  t.forEach((x, i) => { if (i && x !== null && t[i - 1] !== null && x - t[i - 1] < 10) bad.push(`"${lines[i - 1]}" lasts under 10 s`); });
  return { text: lines.join("\n"), count: lines.length, bad };
}

function longFormPlan(ch) {
  if (!/^ch\d\d$/.test(ch || "")) throw new Error(`--long-form takes a chapter folder such as ch06, not ${ch}`);
  const folder = path.join(BOOK, ch), stem = longFormStem(ch), f = (ext) => path.join(folder, stem + ext);
  const it = { id: `${ch}/long-form`, kind: "long-form", ch, folder, stem, video: f(".mp4"), srt: f(".srt"), chapters: f(".chapters.txt"),
    thumb: f(".thumb.jpg"), record: f(".youtube.json"), qaFile: f(".qa.json"), script: path.join(folder, "script.md"),
    playlist: V.long_form.playlist, problems: [], notes: [] };
  const P = (s) => it.problems.push(s), N = (s) => it.notes.push(s);
  for (const k of ["script", "video", "srt", "chapters"]) if (!fs.existsSync(it[k])) P(`missing ${path.relative(BOOK, it[k])}`);
  if (!PROFILE.chapters[ch]) P(`books/${PROFILE.slug}/book.json has no chapters.${ch}.book (the book's chapter title)`);

  const cn = Number(ch.slice(2));
  it.title = fill(V.long_form.title, { cn, book_chapter: PROFILE.chapters[ch] ? PROFILE.chapters[ch].book : "?" });
  if (it.title.length > 100) P(`title is ${it.title.length} characters (Studio allows 100)`);
  it.intro = fill(V.long_form.intro, { cn, book: PROFILE.title, short: PROFILE.short });
  const chap = fs.existsSync(it.chapters) ? chapterLines(it.chapters) : { text: "", count: 0, bad: [] };
  chap.bad.forEach((b) => P(`${path.basename(it.chapters)}: ${b}`));
  it.chapterCount = chap.count;
  // the playlist's link is kept out of the main repo: <book dir>/playlists.json, {"<playlist name>": "<url>"}
  const lists = path.join(BOOK, "playlists.json"), listUrl = fs.existsSync(lists) ? readJSON(lists)[it.playlist] : null;
  if (!listUrl) N(`no link for the "${it.playlist}" playlist in ${path.relative(ROOT, lists)}: the description won't end with it`);
  it.description = `${it.intro}\n\nInteractive page for this chapter: ${SITE}/${ch}.html\n\nChapters:\n${chap.text}` +
    (listUrl ? `\n\nWatch the full playlist at ${listUrl}` : "");
  if (it.description.length > 5000 || /[<>]/.test(it.description)) P("the description is one Studio would reject (over 5000 characters, or < >)");
  it.meta = crypto.createHash("sha1").update(it.title + "\n" + it.description).digest("hex").slice(0, 12);

  if (DAY && NOW) P("--day and --now: pick one");
  if (NOW) { it.now = true; it.publish_at = "now"; }
  else if (DAY) {
    if (!/^\d{4}-\d\d-\d\d$/.test(DAY)) P(`--day takes YYYY-MM-DD, not ${DAY}`);
    else {
      Object.assign(it, slot(DAY));
      if (it.utc < new Date(Date.now() + 15 * 60000)) P(`${DAY} at ${LONG_TIME} has passed or is under 15 minutes away`);
      const wd = new Date(`${DAY}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
      if (V.long_form.weekday && wd !== V.long_form.weekday) P(`${DAY} is a ${wd}; long forms go out on ${V.long_form.weekday}s`);
    }
  }

  // judged and checked only (the publish-video skill)
  if (fs.existsSync(it.script)) {
    const j = cp.spawnSync("python3", [path.join(ROOT, "tools/video/judgement.py"), "check", it.script], { encoding: "utf8" });
    it.judgement = (j.stdout + j.stderr).trim().split("\n").pop().replace(`${it.script}: `, "");
    if (j.status !== 0) P(`judgement: ${it.judgement}`);
    if (fs.existsSync(it.video) && fs.statSync(it.script).mtimeMs > fs.statSync(it.video).mtimeMs)
      N("script.md changed after the video was recorded: make sure the MP4 is from the judged script");
  }
  it.qa = fs.existsSync(it.qaFile) && fs.existsSync(it.video) && fresh(it.video, readJSON(it.qaFile)) ? readJSON(it.qaFile) : null;
  if (it.qa && it.qa.status !== 0) P("QA has a FAIL (see the QA lines)");

  // nothing already up for this chapter: the record on disk, or any version of it in the videos/ repo's history
  const rel = `./${ch}/${stem}.youtube.json`;
  const onDisk = fs.existsSync(it.record) ? readJSON(it.record) : null;
  let prior = onDisk && !onDisk.incomplete ? onDisk : null;
  if (onDisk && onDisk.incomplete) { it.resume = onDisk.video_id; N(`resumes the unfinished upload https://youtu.be/${onDisk.video_id}`); }
  if (!onDisk) {
    const rev = git("log", "--all", "--format=%h", "--diff-filter=AM", "--", rel).split("\n")[0];
    if (rev) {
      prior = JSON.parse(git("show", `${rev}:${rel}`));
      N(`its upload record was deleted from disk but is in the videos/ history (${rev}): restore it with git -C videos checkout ${rev} -- ${path.basename(BOOK)}/${ch}/${stem}.youtube.json`);
    }
  }
  if (prior) {
    const state = prior.status || prior.visibility || "uploaded";
    if (REPLACES !== prior.video_id) P(`already up: https://youtu.be/${prior.video_id} (${state}). Ask the user; to upload a new one in its place, pass --replaces ${prior.video_id}`);
    else {
      it.replaces = prior.video_id;
      N(`replaces https://youtu.be/${prior.video_id} (${state})${state === "public" ? ": the new video gets a new URL, and the old one keeps its views and comments" : ""}; unlist it and take it out of the playlist by hand`);
    }
  } else if (REPLACES) P(`--replaces ${REPLACES}, but nothing is on record for ${ch}`);
  return it;
}

function runQA(it) {
  console.log(`running QA on ${path.relative(ROOT, it.video)} (about 5 minutes)…`);
  const r = cp.spawnSync("uv", ["run", "--project", "tools", "python", "tools/video/qa.py", it.video], { cwd: ROOT, encoding: "utf8" });
  const s = fs.statSync(it.video);
  it.qa = { size: s.size, mtimeMs: s.mtimeMs, status: r.status, report: (r.stdout + r.stderr).trim(), at: new Date().toISOString() };
  fs.writeFileSync(it.qaFile, JSON.stringify(it.qa, null, 2) + "\n");
  if (r.status !== 0) it.problems.push("QA has a FAIL (see the QA lines)");
}

function printLong(it) {
  const tz = V.schedule.timezone;
  console.log(`${it.id}`);
  console.log(`  title      ${it.title}  (${it.title.length}/100)`);
  console.log(`  playlist   ${it.playlist}`);
  console.log(`  publish    ${it.now ? "now: public as soon as Studio has it" : it.publish_at ? `${it.date} ${it.time} ${tz} (${it.publish_at})` : `not set: ask the user which day, then --day YYYY-MM-DD (goes out at ${LONG_TIME} ${tz})`}`);
  console.log(`  files      ${it.stem}.mp4, .srt, .chapters.txt (${it.chapterCount} chapters); thumbnail made by thumb.js`);
  if (it.judgement) console.log(`  judgement  ${it.judgement}`);
  if (!it.qa) console.log("  QA         not run on this MP4 yet: the upload run runs it first");
  else for (const l of it.qa.report.split("\n").filter((l) => /^\s+(ok|near|WARN|FAIL)\b|at:/.test(l))) console.log(`  QA ${l.trimStart()}`);
  console.log("  description\n" + it.description.split("\n").map((l) => `    | ${l}`).join("\n"));
  for (const n of it.notes) console.log(`  note: ${n}`);
  for (const p of it.problems) console.log(`  PROBLEM: ${p}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The thumbnail: the video's chapter and title in large type, from its script's front matter (thumb.js). THUMB names this
// design in each upload record.
const THUMB = "large-title";
const makeThumb = (it) => cp.execFileSync("node", [path.join(__dirname, "thumb.js"), path.join(path.dirname(it.video), "script.md"), it.thumb], { stdio: "ignore" });

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

// The playlist box reads back its playlists as "A, B"; a name must match one exactly, never by prefix. It never creates
// a playlist.
const picked = async (box) => (await box.innerText().catch(() => "")).split(/\n|,/).map((s) => s.trim());
async function setPlaylist(page, dlg, name) {
  const box = dlg.locator("ytcp-video-metadata-playlists").first();
  await box.scrollIntoViewIfNeeded();
  if ((await picked(box)).includes(name)) return;
  await box.locator("ytcp-dropdown-trigger, ytcp-text-dropdown-trigger").first().click({ timeout: 30000 });
  // Studio has renamed this popup before (ytcp-playlist-dialog, …): find whichever popup lists the playlist's name
  const pick = page.locator("ytcp-playlist-dialog, ytcp-playlist-dialog-v2, ytcp-playlist-picker, tp-yt-paper-dialog, tp-yt-iron-dropdown, [role=dialog], [role=listbox]")
    .filter({ has: page.getByText(name, { exact: true }) }).last();
  await pick.waitFor({ state: "visible", timeout: 30000 });
  await sleep(1500);
  const label = pick.getByText(name, { exact: true });
  if ((await label.count()) !== 1) throw new Error(`playlist "${name}" is not in Studio's list (found ${await label.count()}); create it in Studio first`);
  await label.click(); await sleep(800);
  const done = pick.getByRole("button", { name: /^\s*(Done|Save)\s*$/ }).first();
  if (await done.isVisible().catch(() => false)) await done.click(); else await page.keyboard.press("Escape");
  await sleep(1500);
  if (!(await picked(box)).includes(name)) throw new Error(`playlist reads back as "${(await picked(box)).join(", ")}", wanted "${name}"`);
}

const launch = () => chromium.launchPersistentContext(path.join(os.homedir(), ".config/interactive-reading/chrome-studio"), {
  channel: "chrome", headless: false, viewport: null,
  ignoreDefaultArgs: ["--enable-automation"], args: ["--disable-blink-features=AutomationControlled", "--window-size=1400,1000"],
});

async function openNew(page, it, retry = true) {
  await page.goto("https://studio.youtube.com", { waitUntil: "domcontentloaded" });
  await page.locator("#upload-icon, ytcp-button#create-icon").first().click({ timeout: 60000 });
  const menuUpload = page.locator("#text-item-0");
  if (await menuUpload.isVisible().catch(() => false)) await menuUpload.click();
  const input = page.locator("input[type=file][name=Filedata]");
  await input.waitFor({ state: "attached", timeout: 60000 });
  await input.setInputFiles(it.video);
  const titleBox = page.locator(`${DIALOG} #title-textarea #textbox`);
  // Studio sometimes answers the upload with a "You're all set … Try refreshing the page" notice instead: dismiss it, reload, try again
  const gotIt = page.getByRole("button", { name: /^\s*Got it\s*$/ });
  const ready = await Promise.race([titleBox.waitFor({ timeout: 30000 }).then(() => "title"), gotIt.waitFor({ timeout: 30000 }).then(() => "notice")]).catch(() => null);
  if (ready === "notice") {
    await gotIt.click().catch(() => {});
    if (retry) { console.log("  Studio asked for a refresh; reloading and trying again"); return openNew(page, it, false); }
  }
  // Studio sometimes ignores a file set on its hidden input: then pick it the way a person would, through "Select files"
  if (ready !== "title" && !(await titleBox.isVisible().catch(() => false))) {
    console.log("  Studio ignored the file input; choosing the file through Select files");
    await chooseFile(page, page.locator(`${DIALOG} ytcp-button, ${DIALOG} button`).filter({ hasText: /^\s*Select files\s*$/ }).first(), it.video);
    await titleBox.waitFor({ timeout: 120000 });
  }
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
  if (!rec) { // the video's link shows once Studio has made the video: record it first, so a rerun resumes it
    let videoId = null;
    for (let i = 0; i < 60 && !videoId; i++) {
      const href = await dlg.locator("ytcp-video-info a[href*='youtu']").first().getAttribute("href").catch(() => null);
      videoId = href && (href.match(/youtu\.be\/([\w-]{11})/) || [])[1];
      if (!videoId) await sleep(2000);
    }
    if (!videoId) throw new Error("Studio never showed the video link");
    rec = { video_id: videoId, title: it.title, via: "studio", meta: it.meta, incomplete: true };
    fs.writeFileSync(it.record, JSON.stringify(rec, null, 2) + "\n"); // so a rerun never uploads it twice
  }

  await setText(page, dlg.locator("#title-textarea #textbox"), it.title);
  await setText(page, dlg.locator("#description-textarea #textbox"), it.description);
  // thumbnail: the chapter and title in large type (thumb.js), readable at a phone feed's size
  makeThumb(it);
  await dlg.locator("input#file-loader").first().setInputFiles(it.thumb);
  await sleep(4000);
  const thumbErr = await dlg.locator("ytcp-thumbnails-compact-editor-uploader .error, #thumbnail-error").first().innerText().catch(() => "");
  if (thumbErr.trim()) throw new Error(`thumbnail refused: ${thumbErr.trim()}`);
  if (it.playlist) await setPlaylist(page, dlg, it.playlist);
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

  await dlg.locator("#step-badge-1").click(); await sleep(2500); // Video elements
  await addCaptions(page, dlg, it);
  await dlg.locator("#step-badge-3").click(); await sleep(2500); // Visibility
  await shot(page, it, "visibility-0");

  if (it.now) { // public as soon as Studio has it
    await dlg.locator("tp-yt-paper-radio-button[name=PUBLIC]").first().click({ timeout: 30000 });
    await sleep(1000);
    await shot(page, it, "visibility");
    if ((await dlg.locator("tp-yt-paper-radio-button[name=PUBLIC]").first().getAttribute("aria-checked")) !== "true")
      throw new Error("visibility did not set to Public");
  } else {
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
  }

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
  // Studio's confirmation: "Video scheduled ... will be set to public on <date> at <time>", or "Video published"
  // (publishing now, Studio may just close the dialog: that counts too, and the run is checked on the video's page later)
  const confirmed = page.getByText(it.now ? /video published|published/i : /will be set to public on/i).first();
  await Promise.race([confirmed.waitFor({ timeout: 90000 }), ...(it.now ? [dlg.waitFor({ state: "hidden", timeout: 90000 })] : [])])
    .catch(() => { throw new Error(`Studio did not confirm the ${it.now ? "publish" : "schedule"}`); });
  Object.assign(rec, { title: it.title, meta: it.meta, captions: "studio", thumbnail: THUMB },
    it.now ? { visibility: "public", published: new Date().toISOString().replace(/\.\d+Z$/, "Z") } : { publish_at: it.publish_at });
  Object.assign(rec, { playlist: it.playlist, status: it.now ? "public" : "scheduled", done: true }, it.replaces ? { replaces: it.replaces } : {});
  delete rec.incomplete;
  fs.writeFileSync(it.record, JSON.stringify(rec, null, 2) + "\n");
  await page.keyboard.press("Escape").catch(() => {});
  return rec.video_id;
}

// --titles: set the title and the description's first line of a long form already up. Never touches its schedule.
async function retitle(page, it, rec) {
  await page.goto(`https://studio.youtube.com/video/${rec.video_id}/edit`, { waitUntil: "domcontentloaded" });
  const titleBox = page.locator("#title-textarea #textbox").first();
  await titleBox.waitFor({ timeout: 60000 });
  await sleep(4000); // the edit page fills its boxes after it appears; reading earlier can see the previous video's text
  const changed = [];
  if ((await titleBox.innerText()).trim() !== it.title) { await setText(page, titleBox, it.title); changed.push("title"); }
  if (it.intro) { // replace the first line, keep the rest (links, chapters) as Studio has it
    const box = page.locator("#description-textarea #textbox").first();
    const now = (await box.innerText()).trim(), rest = now.includes("\n") ? now.slice(now.indexOf("\n")) : "";
    const own = `${SITE}/${it.id.slice(0, 4)}.html`; // guards against reading the previous video's text
    if (!now.includes(own)) throw new Error(`${it.id}: description doesn't link ${own}; not overwriting it`);
    if (now.split("\n")[0].trim() !== it.intro) { await setText(page, box, it.intro + rest); changed.push("description"); }
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
  }
  rec.title = it.title;
  if (it.meta) rec.meta = it.meta;
  fs.writeFileSync(it.record, JSON.stringify(rec, null, 2) + "\n");
  return changed;
}

(async () => {
  if (LONG) {
    let it;
    try { it = longFormPlan(LONG); } catch (e) { console.error(`studio_upload: ${e.message}`); process.exitCode = 2; return; }
    if (!PLAN && !it.publish_at) it.problems.push("no --day (or --now): ask the user which day it goes out");
    if (!PLAN && !it.problems.length && !it.qa) runQA(it); // last, because it takes minutes
    printLong(it);
    if (PLAN) { if (it.problems.length) process.exitCode = 1; return; }
    if (it.problems.length) { console.log("NOT UPLOADING: fix the problems above"); process.exitCode = 1; return; }
    if (it.replaces && fs.existsSync(it.record)) { // keep the old video's record, as ch02's was kept
      let to = path.join(it.folder, `${it.stem}.retired.youtube.json`);
      if (fs.existsSync(to)) to = path.join(it.folder, `${it.stem}.retired-${it.replaces}.youtube.json`);
      fs.renameSync(it.record, to);
      console.log(`  moved the old record to ${path.basename(to)}`);
    }
    const ctx = await launch();
    const page = ctx.pages()[0] || (await ctx.newPage());
    try {
      const r = await upload(page, it);
      if (r === "limit") { console.log("STOPPED: Studio's daily upload limit is reached"); process.exitCode = 1; }
      else console.log(`  uploaded https://youtu.be/${r}  ${it.title}  → ${it.now ? "public now" : `${it.date} ${it.time} ${V.schedule.timezone}`}\n` +
        `  commit its record: git -C videos add ${path.basename(BOOK)}/${it.ch}/${it.stem}*.youtube.json && git -C videos commit`);
    } catch (e) {
      const shotPath = path.join(it.folder, "studio-upload-error.png");
      await page.screenshot({ path: shotPath }).catch(() => {});
      fs.writeFileSync(shotPath.replace(/\.png$/, ".html"), await page.content().catch(() => "")); // to see what Studio changed
      console.log(`STOPPED: ${e.message.split("\n")[0]}\n  screenshot: ${shotPath}\n  rerun the same command to resume`);
      process.exitCode = 1;
    } finally { await ctx.close(); }
    return;
  }
  if (TITLES) {
    const items = titlesPlan().map((it) => [it, JSON.parse(fs.readFileSync(it.record, "utf8"))])
      .filter(([it, rec]) => rec.title !== it.title || (it.meta && rec.meta !== it.meta));
    console.log(`${items.length} videos to retitle`);
    if (PLAN) { for (const [it, rec] of items) console.log(`${it.id}  ${rec.title || "(no title on record)"}\n   → ${it.title}${it.meta && rec.meta !== it.meta ? "  (+ description)" : ""}`); return; }
    const ctx = await launch();
    const page = ctx.pages()[0] || (await ctx.newPage());
    let n = 0;
    try {
      for (const [it, rec] of items.slice(0, LIMIT)) {
        const changed = await retitle(page, it, rec);
        console.log(`  ${it.id} https://youtu.be/${rec.video_id}  ${changed.join("+") || "already right"}  (${++n}/${items.length})`);
      }
    } catch (e) {
      const shotPath = path.join(SHOTS, "studio-titles-error.png");
      await page.screenshot({ path: shotPath }).catch(() => {});
      console.log(`STOPPED: ${e.message.split("\n")[0]}\n  screenshot: ${shotPath}`);
      process.exitCode = 1;
    } finally { await ctx.close(); }
    return;
  }
  console.error("studio_upload: pass --long-form chNN to upload a chapter's long form, or --titles to retitle the ones already up");
  process.exitCode = 2;
})();
