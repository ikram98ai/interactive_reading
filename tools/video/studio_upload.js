#!/usr/bin/env node
/* studio_upload.js <book dir> --long-form chNN|chNN/sMM [--day YYYY-MM-DD | --now] [--replaces <video id>] [--plan]
   Uploads one chapter's long form (chNN/chNN-<chapter>.mp4, such as ch06-heapsort.mp4) through YouTube Studio's web UI: the title (videos.long_form.title),
   a description of the intro line, the chapter page's link and the chapter timestamps (.chapters.txt), the large-title
   thumbnail, "not made for kids", English, the .srt captions, the playlist (videos.long_form.playlist), and a publish time
   of --day at the long form's time (--now publishes it as soon as Studio has it instead). It refuses unless `judgement.py check` passes, QA has no FAIL (qa.py, cached in
   <video>.qa.json and rerun only when the MP4 changes, about 5 minutes) and nothing is already up for that chapter: a
   record on disk, or one in the videos/ repo's history even if it was deleted. --replaces <id> uploads a new video in
   place of that one (its record moves to <video>.retired.youtube.json; unlisting the old video is done by hand).
   --plan prints all of it, problems included, and uploads nothing.
   A section video (CLRS: one per section, videos/<book>/chNN/sMM/) is --long-form chNN/sMM: named chNN-sMM-<section>.mp4
   as narrate.py names it, titled by videos.section (title, intro, playlist, time) and book.json sections.

   studio_upload.js videos/shorts/<book> --short NNN|NNN,NNN,…|all [--day YYYY-MM-DD [--time HH:MM]] [--plan]
   Uploads a Short (NNN-<slug>/NNN-<slug>.mp4, vertical and at most 3:00) and leaves it a draft in Studio. With --day it is
   scheduled instead: the Shorts named go public one a day, in the order given, from --day at --time (default
   videos.shorts.time), and a Short already up as a draft is opened and scheduled in place (title, description and
   playlist set again; captions kept), never uploaded twice. The title is the script's front-matter title, the description the one line in description.txt beside
   it (it must not name the book or a channel), plus the .srt captions, "not made for kids", English and the playlist
   videos.shorts.playlist. No thumbnail: a Short's cover is a frame chosen in Studio. The same gates as a long form:
   judgement.py check, QA with no FAIL, nothing already up. It reopens each draft to read its title back.
   --again uploads a Short that's already up once more, as a new draft with the same title and description (a re-recorded
   MP4): the earlier upload is left as it is in Studio, its record moves to <video>.earlier-<id>.youtube.json, and the new
   record names it (`earlier`). A rerun resumes the new upload and never makes a third.

   studio_upload.js videos/shorts/<book> --draft <video id> --title "<its exact Studio title>" --description <file>
       --day YYYY-MM-DD [--time HH:MM] [--srt <file>] [--plan]
   Schedules a Short that is up as a draft but has no folder here (its files lost): reads its title back first, sets the
   description and playlist, adds the .srt only if the draft has no subtitles, schedules it and reads the schedule back.
   Its record goes to videos/shorts/<book>/drafts/<id>.youtube.json.

   studio_upload.js <book dir> --long-form chNN[/sMM] --thumb [--plan]
   Makes the video's thumbnail again (thumb.js) and sets it on the video already up, on its Studio edit page, after reading
   the title back and finding it is the one on record. Nothing else changes, the schedule included.

   studio_upload.js <book dir> --delete <video id> --title "<its exact title>" [--plan]
   Deletes a video forever, after reading its title back from its Studio page and finding it matches --title.

   studio_upload.js <book dir> --titles [--from ch04] [--to ch05] [--plan] [--limit N]
   Updates the title and the description's first line (videos.long_form.intro) of every long form already up, and never
   moves a publish time. --plan lists what would change.

   Everything goes through YouTube Studio's web UI (no API). The thumbnail is made by thumb.js (the title, a hook
   and a picture from thumb.json), saved beside the video as <video>.thumb.jpg. --steps screenshots each dialog step. Progress is written to
   <video>.youtube.json, so a rerun resumes. Names, title formats, site and schedule come from books/<book>/book.json
   (its "videos" block). Chrome profile: ~/.config/interactive-reading/chrome-studio. */
const fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto"), cp = require("child_process");
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const VALUED = ["--from", "--to", "--limit", "--long-form", "--day", "--replaces", "--delete", "--title", "--short", "--time", "--lane", "--profile", "--draft", "--description", "--srt"];
const BOOK = path.resolve(args.find((a, i) => !a.startsWith("--") && !VALUED.includes(args[i - 1])) || "videos/clrs");
const ROOT = path.join(__dirname, "../..");
const PROFILE = JSON.parse(fs.readFileSync(path.join(ROOT, "books", path.basename(BOOK), "book.json"), "utf8"));
const V = PROFILE.videos; // the long form's playlist, title format and intro, site, schedule
if (!V) throw new Error(`books/${path.basename(BOOK)}/book.json declares no videos`);
const SITE = V.site;
const LONG = opt("--long-form"), DAY = opt("--day"), REPLACES = opt("--replaces"), NOW = args.includes("--now"), SHORT = opt("--short"), AGAIN = args.includes("--again");
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
function slot(day, time = LONG_TIME) {
  const [y, mo, d] = day.split("-").map(Number), [h, mi] = hm(time);
  const utc = new Date(Date.UTC(y, mo - 1, d, h - UTC_OFFSET, mi));
  return { longDate: `${new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} ${d}, ${y}`, date: `${MONTHS[mo - 1]} ${d}, ${y}`, clock: `${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`,
    publish_at: utc.toISOString().replace(".000", ""), utc };
}
const addDays = (day, n) => { const [y, mo, d] = day.split("-").map(Number); return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10); };

// YouTube makes chapters from description timestamps only if the first is 0:00, there are at least three, and each lasts 10 s.
function chapterLines(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter(Boolean), bad = [];
  const t = lines.map((l) => { const m = l.match(/^(\d+(?::\d\d){1,2})\s+\S/); if (!m) bad.push(`not "m:ss Title": ${l}`); return m ? secs(m[1]) : null; });
  if (t[0] !== 0) bad.push("the first chapter must start at 0:00");
  if (lines.length < 3) bad.push(`YouTube needs at least 3 chapters, this has ${lines.length}`);
  t.forEach((x, i) => { if (i && x !== null && t[i - 1] !== null && x - t[i - 1] < 10) bad.push(`"${lines[i - 1]}" lasts under 10 s`); });
  return { text: lines.join("\n"), count: lines.length, bad };
}

function longFormPlan(arg) {
  const m = (arg || "").match(/^(ch\d\d)(?:\/(s\d\d))?$/);
  if (!m) throw new Error(`--long-form takes a chapter folder such as ch06, or a section folder such as ch06/s02, not ${arg}`);
  const [, ch, sec] = m, S = sec ? V.section : V.long_form; // a section video, or a chapter's long form
  if (sec && !S) throw new Error(`books/${PROFILE.slug}/book.json has no videos.section block`);
  const secTitle = sec && ((PROFILE.sections || {})[ch] || {})[sec];
  const folder = sec ? path.join(BOOK, ch, sec) : path.join(BOOK, ch);
  const stem = sec ? `${ch}-${sec}-${secTitle ? longFormName(secTitle) : VOICE_TAG}` : longFormStem(ch), f = (ext) => path.join(folder, stem + ext);
  const it = { id: sec ? `${ch}/${sec}` : `${ch}/long-form`, kind: sec ? "section" : "long-form", ch, sec, folder, stem, video: f(".mp4"), srt: f(".srt"), chapters: f(".chapters.txt"),
    thumb: f(".thumb.jpg"), record: f(".youtube.json"), qaFile: f(".qa.json"), script: path.join(folder, "script.md"),
    playlist: S.playlist, time: S.time || LONG_TIME, problems: [], notes: [] };
  const P = (s) => it.problems.push(s), N = (s) => it.notes.push(s);
  for (const k of ["script", "video", "srt", "chapters"]) if (!fs.existsSync(it[k])) P(`missing ${path.relative(BOOK, it[k])}`);
  if (!sec && !PROFILE.chapters[ch]) P(`books/${PROFILE.slug}/book.json has no chapters.${ch}.book (the book's chapter title)`);
  if (sec && !secTitle) P(`books/${PROFILE.slug}/book.json has no sections.${ch}.${sec} (the book's section title)`);

  const cn = Number(ch.slice(2)), sn = sec ? Number(sec.slice(1)) : null;
  it.title = sec ? fill(S.title, { cn, sn, book_section: secTitle || "?" }) : fill(S.title, { cn, book_chapter: PROFILE.chapters[ch] ? PROFILE.chapters[ch].book : "?" });
  // a book's section name can be long: past Studio's 100 characters the title drops its " | <book>" suffix (the author's call, 5.4)
  if (it.title.length > 100 && it.title.includes(" | ")) it.title = it.title.slice(0, it.title.lastIndexOf(" | "));
  if (it.title.length > 100) P(`title is ${it.title.length} characters (Studio allows 100)`);
  it.intro = fill(S.intro, { cn, sn, book: PROFILE.title, short: PROFILE.short });
  it.part = sec ? `Section ${cn}.${sn}` : null; // the thumbnail's line above the title
  const chap = fs.existsSync(it.chapters) ? chapterLines(it.chapters) : { text: "", count: 0, bad: [] };
  chap.bad.forEach((b) => P(`${path.basename(it.chapters)}: ${b}`));
  it.chapterCount = chap.count;
  // the playlist's link is kept out of the main repo: <book dir>/playlists.json, {"<playlist name>": "<url>"}
  const lists = path.join(BOOK, "playlists.json"), listUrl = fs.existsSync(lists) ? readJSON(lists)[it.playlist] : null;
  if (!listUrl) N(`no link for the "${it.playlist}" playlist in ${path.relative(ROOT, lists)}: the description won't end with it`);
  it.description = `${it.intro}\n\nInteractive page for this ${sec ? "section's chapter" : "chapter"}: ${SITE}/${ch}.html\n\nChapters:\n${chap.text}` +
    (listUrl ? `\n\nWatch the full playlist at ${listUrl}` : "");
  if (it.description.length > 5000 || /[<>]/.test(it.description)) P("the description is one Studio would reject (over 5000 characters, or < >)");
  it.meta = crypto.createHash("sha1").update(it.title + "\n" + it.description).digest("hex").slice(0, 12);

  if (DAY && NOW) P("--day and --now: pick one");
  if (NOW) { it.now = true; it.publish_at = "now"; }
  else if (DAY) {
    if (!/^\d{4}-\d\d-\d\d$/.test(DAY)) P(`--day takes YYYY-MM-DD, not ${DAY}`);
    else {
      Object.assign(it, slot(DAY, it.time));
      if (it.utc < new Date(Date.now() + 15 * 60000)) P(`${DAY} at ${it.time} has passed or is under 15 minutes away`);
      const wd = new Date(`${DAY}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
      if (S.weekday && wd !== S.weekday) P(`${DAY} is a ${wd}; these videos go out on ${S.weekday}s`);
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
  const rel = `./${path.relative(BOOK, folder)}/${stem}.youtube.json`;
  const onDisk = fs.existsSync(it.record) ? readJSON(it.record) : null;
  let prior = onDisk && !onDisk.incomplete ? onDisk : null;
  if (onDisk && onDisk.incomplete) { it.resume = onDisk.video_id; N(`resumes the unfinished upload https://youtu.be/${onDisk.video_id}`); }
  if (!onDisk) {
    const rev = git("log", "--all", "--format=%h", "--diff-filter=AM", "--", rel).split("\n")[0];
    if (rev) {
      prior = JSON.parse(git("show", `${rev}:${rel}`));
      N(`its upload record was deleted from disk but is in the videos/ history (${rev}): restore it with git -C videos checkout ${rev} -- ${path.basename(BOOK)}/${path.relative(BOOK, folder)}/${stem}.youtube.json`);
    }
  }
  if (prior) {
    const state = prior.status || prior.visibility || "uploaded";
    if (REPLACES !== prior.video_id) P(`already up: https://youtu.be/${prior.video_id} (${state}). Ask the user; to upload a new one in its place, pass --replaces ${prior.video_id}`);
    else {
      it.replaces = prior.video_id;
      N(`replaces https://youtu.be/${prior.video_id} (${state})${state === "public" ? ": the new video gets a new URL, and the old one keeps its views and comments" : ""}; unlist it and take it out of the playlist by hand`);
    }
  } else if (REPLACES) P(`--replaces ${REPLACES}, but nothing is on record for ${it.id}`);
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
  console.log(`  publish    ${it.now ? "now: public as soon as Studio has it" : it.publish_at ? `${it.date} ${it.clock} ${tz} (${it.publish_at})` : `not set: ask the user which day, then --day YYYY-MM-DD (goes out at ${it.time} ${tz})`}`);
  console.log(`  files      ${it.stem}.mp4, .srt, .chapters.txt (${it.chapterCount} chapters); thumbnail made by thumb.js`);
  if (it.judgement) console.log(`  judgement  ${it.judgement}`);
  if (!it.qa) console.log("  QA         not run on this MP4 yet: the upload run runs it first");
  else for (const l of it.qa.report.split("\n").filter((l) => /^\s+(ok|near|WARN|FAIL)\b|at:/.test(l))) console.log(`  QA ${l.trimStart()}`);
  console.log("  description\n" + it.description.split("\n").map((l) => `    | ${l}`).join("\n"));
  for (const n of it.notes) console.log(`  note: ${n}`);
  for (const p of it.problems) console.log(`  PROBLEM: ${p}`);
}

// ---- a Short: videos/shorts/<book>/NNN-<slug>/, uploaded as a draft
function shortDirs(arg) {
  const all = fs.readdirSync(BOOK).filter((d) => /^\d{3}-[\w-]+$/.test(d) && fs.statSync(path.join(BOOK, d)).isDirectory()).sort();
  if (arg === "all") return all;
  return arg.split(",").map((a) => a.trim()).filter(Boolean).map((a) => {
    const hit = all.filter((d) => d === a || d.startsWith(`${a}-`));
    if (hit.length !== 1) throw new Error(`--short takes a Short's number (such as 007), its folder, a comma list of them, or all; ${a} matches ${hit.length}`);
    return hit[0];
  });
}

function shortPlan(dir, index = 0) {
  const folder = path.join(BOOK, dir), f = (ext) => path.join(folder, dir + ext);
  const it = { id: dir, kind: "short", short: true, folder, stem: dir, video: f(".mp4"), srt: f(".srt"), record: f(".youtube.json"),
    qaFile: f(".qa.json"), script: path.join(folder, "script.md"), descFile: path.join(folder, "description.txt"),
    playlist: (V.shorts || {}).playlist, problems: [], notes: [] };
  const P = (s) => it.problems.push(s), N = (s) => it.notes.push(s);
  if (!V.shorts || !it.playlist) P(`books/${PROFILE.slug}/book.json has no videos.shorts.playlist`);
  for (const k of ["script", "video", "srt", "descFile"]) if (!fs.existsSync(it[k])) P(`missing ${path.relative(BOOK, it[k])}`);
  if (fs.existsSync(it.script)) {
    const fm = (fs.readFileSync(it.script, "utf8").match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
    it.title = ((fm.match(/^title:\s*(.+)$/m) || [])[1] || "").trim();
    if (!/^kind:\s*short\s*$/m.test(fm)) P("script.md front matter is not kind: short");
  }
  if (!it.title) P("script.md has no title in its front matter");
  else if (it.title.length > 100) P(`title is ${it.title.length} characters (Studio allows 100)`);
  it.description = fs.existsSync(it.descFile) ? fs.readFileSync(it.descFile, "utf8").trim() : "";
  if (fs.existsSync(it.descFile) && !it.description) P("description.txt is empty");
  if (/https?:\/\/|www\.|youtu\.?be|\.com\b/i.test(it.description)) P("description.txt has a link (a Short's description has none)");
  if (DAY) { // scheduled: one a day from --day, in the order the Shorts were named
    const time = opt("--time") || (V.shorts || {}).time;
    if (!/^\d{4}-\d\d-\d\d$/.test(DAY)) P(`--day takes YYYY-MM-DD, not ${DAY}`);
    else if (!/^\d\d:\d\d$/.test(time || "")) P("no --time, and books/<book>/book.json has no videos.shorts.time");
    else {
      it.day = addDays(DAY, index);
      Object.assign(it, slot(it.day, time));
      if (it.utc < new Date(Date.now() + 15 * 60000)) P(`${it.day} at ${time} has passed or is under 15 minutes away`);
    }
  }
  if (it.description.length > 5000 || /[<>]/.test(it.description)) P("the description is one Studio would reject (over 5000 characters, or < >)");
  // a Short stands alone: it never names the book, and never a channel (videos/never-say.txt, local only)
  const never = path.join(ROOT, "videos/never-say.txt");
  const banned = [PROFILE.title, PROFILE.short, ...(fs.existsSync(never) ? fs.readFileSync(never, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) : [])];
  for (const b of banned) if ((it.title + "\n" + it.description).toLowerCase().includes(b.toLowerCase())) P(`the title or description names "${b.length > 3 ? b.slice(0, 3) + "…" : b}" (a Short stands alone)`);
  it.meta = crypto.createHash("sha1").update((it.title || "") + "\n" + it.description).digest("hex").slice(0, 12);

  // YouTube makes a Short only of a vertical video of at most three minutes
  if (fs.existsSync(it.video)) {
    const pr = cp.spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", it.video], { encoding: "utf8" });
    try {
      const j = JSON.parse(pr.stdout), s = j.streams[0];
      it.size = `${s.width}×${s.height}`; it.duration = Number(j.format.duration);
      if (!(s.height > s.width)) P(`${it.size} is not vertical`);
      if (it.duration > 180) P(`${it.duration.toFixed(1)} s is over three minutes`);
    } catch { P("ffprobe could not read the MP4"); }
  }

  // judged and checked only
  if (fs.existsSync(it.script)) {
    const j = cp.spawnSync("python3", [path.join(ROOT, "tools/video/judgement.py"), "check", it.script], { encoding: "utf8" });
    it.judgement = (j.stdout + j.stderr).trim().split("\n").pop().replace(`${it.script}: `, "").replace(`${path.relative(ROOT, it.script)}: `, "");
    if (j.status !== 0) P(`judgement: ${it.judgement}`);
    if (fs.existsSync(it.video) && fs.statSync(it.script).mtimeMs > fs.statSync(it.video).mtimeMs)
      N("script.md changed after the video was recorded: make sure the MP4 is from the judged script");
  }
  it.qa = fs.existsSync(it.qaFile) && fs.existsSync(it.video) && fresh(it.video, readJSON(it.qaFile)) ? readJSON(it.qaFile) : null;
  if (it.qa && it.qa.status !== 0) P("QA has a FAIL (see the QA lines)");

  // nothing already up: the record on disk, or any version of it in the videos/ repo's history
  const rel = `./${dir}/${dir}.youtube.json`;
  const onDisk = fs.existsSync(it.record) ? readJSON(it.record) : null;
  let prior = onDisk && !onDisk.incomplete ? onDisk : null;
  if (onDisk && onDisk.incomplete) { it.resume = onDisk.video_id; N(`resumes the unfinished upload https://youtu.be/${onDisk.video_id}`); }
  if (!onDisk) {
    const rev = git("log", "--all", "--format=%h", "--diff-filter=AM", "--", rel).split("\n")[0];
    if (rev) {
      prior = JSON.parse(git("show", `${rev}:${rel}`));
      N(`its upload record was deleted from disk but is in the videos/ history (${rev}): restore it with git -C ${path.relative(ROOT, BOOK)} checkout ${rev} -- ${rel}`);
    }
  }
  // --again: a new draft beside the earlier upload, unless this record is already that new upload
  let earlier = AGAIN && (prior || onDisk) && !(prior || onDisk).earlier ? prior || onDisk : null;
  if (AGAIN && !earlier && !onDisk) { // a run stopped after moving the earlier record aside, before the new upload began
    const kept = fs.readdirSync(it.folder).map((f) => f.match(new RegExp(`^${dir}\\.earlier-([\\w-]{11})\\.youtube\\.json$`))).find(Boolean);
    if (kept) { earlier = readJSON(path.join(it.folder, kept[0])); prior = null; }
  }
  if (earlier) {
    it.again = earlier.video_id; delete it.resume; prior = null;
    N(`uploads a new draft; the earlier upload https://youtu.be/${earlier.video_id} (${earlier.status || (earlier.incomplete ? "unfinished" : "uploaded")}) stays as it is`);
  }
  if (prior && it.publish_at && prior.status === "draft" && !prior.incomplete) {
    it.reschedule = prior.video_id; prior = null; // a draft already up: open it and schedule it in place
    N(`schedules the draft already up, https://youtu.be/${it.reschedule}, in place`);
  }
  if (prior && it.publish_at && prior.status === "scheduled" && prior.publish_at !== it.publish_at)
    P(`already scheduled for ${prior.publish_at}, not ${it.publish_at}: change it in Studio, or name the Shorts so the days line up`);
  if (prior) { it.already = prior; if (!it.publish_at || prior.status !== "scheduled") P(`already up: https://youtu.be/${prior.video_id} (${prior.status || "uploaded"})`); }
  return it;
}

function printShort(it) {
  console.log(`${it.id}`);
  console.log(`  title      ${it.title || "?"}  (${(it.title || "").length}/100)`);
  console.log(`  playlist   ${it.playlist || "?"}`);
  console.log(`  publish    ${it.publish_at ? `${it.day} ${it.clock} ${V.schedule.timezone} (${it.publish_at})${it.already ? ": already scheduled" : ""}` : "never: left a draft in Studio"}`);
  console.log(`  files      ${it.stem}.mp4 (${it.size || "?"}, ${it.duration ? it.duration.toFixed(1) + " s" : "?"}), .srt; no thumbnail (a Short's cover is a frame chosen in Studio)`);
  if (it.judgement) console.log(`  judgement  ${it.judgement}`);
  if (!it.qa) console.log("  QA         not run on this MP4 yet: the upload run runs it first");
  else for (const l of it.qa.report.split("\n").filter((l) => /^\s+(ok|near|WARN|FAIL)\b|at:/.test(l))) console.log(`  QA ${l.trimStart()}`);
  console.log("  description\n" + it.description.split("\n").map((l) => `    | ${l}`).join("\n"));
  for (const n of it.notes) console.log(`  note: ${n}`);
  for (const p of it.problems) console.log(`  PROBLEM: ${p}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The thumbnail (thumb.js): the video's title with its hook and picture when a thumb.json sits beside the script, otherwise
// the chapter and title in large type. THUMB names the design in each upload record.
const THUMB = (it) => (fs.existsSync(path.join(path.dirname(it.video), "thumb.json")) ? "title-hook" : "large-title");
const makeThumb = (it) => cp.execFileSync("node", [path.join(__dirname, "thumb.js"), path.join(path.dirname(it.video), "script.md"), it.thumb, ...(it.part ? [it.part] : [])], { stdio: "ignore" });

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

// --profile <dir>: another copy of the signed-in profile, so two or three runs (--lane) can drive Studio at once
const launch = () => chromium.launchPersistentContext(opt("--profile") ? path.resolve(opt("--profile")) : path.join(os.homedir(), ".config/interactive-reading/chrome-studio"), {
  channel: "chrome", headless: false, viewport: null,
  ignoreDefaultArgs: ["--enable-automation"], args: ["--disable-blink-features=AutomationControlled", "--window-size=1400,1000"],
});

async function openNew(page, it, retry = true) {
  await page.goto("https://studio.youtube.com", { waitUntil: "domcontentloaded" });
  await page.locator("#upload-icon, ytcp-button#create-icon, button[aria-label='Create']").first().click({ timeout: 60000 });
  // the Create menu can draw a moment after the click: wait for its "Upload videos" item (an older Studio opened the
  // upload dialog straight from the icon, with no menu, so a missing item isn't an error)
  const menuUpload = page.locator("#text-item-0, tp-yt-paper-item").filter({ hasText: /Upload videos/i }).first();
  if (await menuUpload.waitFor({ state: "visible", timeout: 10000 }).then(() => true, () => false)) await menuUpload.click();
  const input = page.locator("input[type=file][name=Filedata]");
  const attached = await input.waitFor({ state: "attached", timeout: 60000 }).then(() => true, () => false);
  if (!attached) {
    if (!retry) throw new Error("Studio's upload dialog didn't open (no file input after Create → Upload videos)");
    console.log("  the upload dialog didn't open; reloading and trying again");
    return openNew(page, it, false);
  }
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
  // just after a new upload's dialog closes, Studio may move to its dashboard on its own, after this navigation: try again
  for (let tries = 1; ; tries++) {
    await page.goto(`https://studio.youtube.com/video/${id}/edit`, { waitUntil: "domcontentloaded" });
    await sleep(3000);
    const ok = await page.getByRole("button", { name: /edit draft/i }).first().click({ timeout: 30000 }).then(() => true, () => false);
    if (ok && page.url().includes(id)) break;
    if (tries >= 3) throw new Error(`could not open the draft of ${id} (page at ${page.url()})`);
    await sleep(5000);
  }
  await page.locator(`${DIALOG} #title-textarea #textbox`).waitFor({ timeout: 60000 });
  await sleep(2000);
}

async function upload(page, it) {
  let rec = fs.existsSync(it.record) ? JSON.parse(fs.readFileSync(it.record, "utf8")) : null;
  if (rec && it.short && it.publish_at && rec.incomplete) { // a run may have stopped after Studio scheduled it
    const scheduled = await checkScheduled(page.context(), rec.video_id, it).then(() => true, () => false);
    if (scheduled) {
      Object.assign(rec, { title: it.title, meta: it.meta, captions: "studio", publish_at: it.publish_at, playlist: it.playlist, status: "scheduled", done: true,
        uploaded: rec.uploaded || new Date().toISOString().replace(/\.\d+Z$/, "Z") });
      delete rec.incomplete; fs.writeFileSync(it.record, JSON.stringify(rec, null, 2) + "\n");
      return rec.video_id;
    }
  }
  if (rec) await openDraft(page, rec.video_id); // uploaded before, but not finished
  else if (!(await openNew(page, it))) return "limit";
  const dlg = page.locator(DIALOG);
  if (!rec) { // the video's link shows once Studio has made the video: record it first, so a rerun resumes it
    let videoId = null;
    for (let i = 0; i < 60 && !videoId; i++) {
      // youtu.be/<id> for a long form, youtube.com/shorts/<id> for a Short; Studio's help links also contain "youtu"
      const hrefs = await dlg.locator("a#video-link, ytcp-video-info a[href*='youtu']").evaluateAll((as) => as.map((a) => a.href)).catch(() => []);
      videoId = hrefs.map((h) => (h.match(/(?:youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/) || [])[1]).find(Boolean) || null;
      if (!videoId) await sleep(2000);
    }
    if (!videoId) throw new Error("Studio never showed the video link");
    rec = { video_id: videoId, title: it.title, via: "studio", meta: it.meta, incomplete: true, ...(it.again ? { earlier: it.again } : {}) };
    fs.writeFileSync(it.record, JSON.stringify(rec, null, 2) + "\n"); // so a rerun never uploads it twice
  }

  await setText(page, dlg.locator("#title-textarea #textbox"), it.title);
  await setText(page, dlg.locator("#description-textarea #textbox"), it.description);
  // thumbnail: made by thumb.js (title, hook and picture, or the plain title card), readable at a phone feed's size
  if (!it.short) { // a Short's cover is a frame chosen in Studio
    makeThumb(it);
    await dlg.locator("input#file-loader").first().setInputFiles(it.thumb);
    await sleep(4000);
    const thumbErr = await dlg.locator("ytcp-thumbnails-compact-editor-uploader .error, #thumbnail-error").first().innerText().catch(() => "");
    if (thumbErr.trim()) throw new Error(`thumbnail refused: ${thumbErr.trim()}`);
  }
  if (it.playlist) await setPlaylist(page, dlg, it.playlist);
  await dlg.locator("tp-yt-paper-radio-button[name=VIDEO_MADE_FOR_KIDS_NOT_MFK]").first().click();
  // video language: subtitles can't be added without it
  await dlg.locator("#toggle-button").click(); await sleep(1500);
  const lang = dlg.locator("ytcp-form-language-input").first();
  await lang.scrollIntoViewIfNeeded();
  for (let i = 0; i < 3 && !/English/.test(await lang.innerText()); i++) { // the list can open empty while it loads: close and try again
    await lang.click(); await sleep(2500);
    const en = page.locator("tp-yt-paper-item").filter({ hasText: /^\s*English\s*$/ }).first();
    if (await en.waitFor({ state: "visible", timeout: 10000 }).then(() => true, () => false)) { await en.click(); await sleep(1200); }
    else { await page.keyboard.press("Escape"); await sleep(1500); }
  }
  if (!/English/.test(await lang.innerText())) throw new Error("video language did not set");
  await shot(page, it, "details");

  await dlg.locator("#step-badge-1").click(); await sleep(2500); // Video elements
  const hasSubs = it.reschedule && /edit/i.test(await dlg.locator("#subtitles-button").innerText().catch(() => ""));
  if (!hasSubs) { if (!it.srt || !fs.existsSync(it.srt)) throw new Error("the draft has no subtitles and there is no .srt to add"); await addCaptions(page, dlg, it); } // a draft scheduled in place keeps its captions
  if (it.short && !it.publish_at) return saveDraft(page, dlg, it, rec);
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
  await timeInput.fill(it.clock);
  await timeInput.press("Enter");
  await sleep(1000);
  const shownDate = (await dlg.locator("#datepicker-trigger").first().innerText()).trim();
  const shownTime = await timeInput.inputValue();
  await shot(page, it, "visibility");
  if (!shownDate.includes(it.date) || shownTime.replace(/\s/g, "") !== it.clock.replace(/\s/g, ""))
    throw new Error(`schedule reads back as ${shownDate} ${shownTime}, wanted ${it.date} ${it.clock}`);
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
  // (a draft scheduled in place can answer "Video published" instead: for a Short, either counts, and the schedule is then
  // read back from the video's own page below)
  const confirmed = page.getByText(it.now ? /video published|published/i : it.short ? /will be set to public on|video published/i : /will be set to public on/i).first();
  await Promise.race([confirmed.waitFor({ timeout: 90000 }), ...(it.now ? [dlg.waitFor({ state: "hidden", timeout: 90000 })] : [])])
    .catch(() => { throw new Error(`Studio did not confirm the ${it.now ? "publish" : "schedule"}`); });
  Object.assign(rec, { title: it.title, meta: it.meta, captions: "studio" }, it.short ? {} : { thumbnail: THUMB(it) },
    it.short && !rec.uploaded ? { uploaded: new Date().toISOString().replace(/\.\d+Z$/, "Z") } : {},
    it.now ? { visibility: "public", published: new Date().toISOString().replace(/\.\d+Z$/, "Z") } : { publish_at: it.publish_at });
  Object.assign(rec, { playlist: it.playlist, status: it.now ? "public" : "scheduled", done: true }, it.replaces ? { replaces: it.replaces } : {});
  const said = (await page.locator("tp-yt-paper-dialog, ytcp-dialog, [role=dialog]").filter({ hasText: /will be set to public on|video published/i }).last().innerText().catch(() => "")).replace(/\s+/g, " ");
  await page.keyboard.press("Escape").catch(() => {});
  if (it.short && !it.now && !said.includes(`will be set to public on ${it.longDate} at ${it.clock}`)) await checkScheduled(page.context(), rec.video_id, it);
  delete rec.incomplete;
  fs.writeFileSync(it.record, JSON.stringify(rec, null, 2) + "\n");
  return rec.video_id;
}

// Reads a scheduled video's visibility, date and time back from its edit page, in a fresh tab (a tab Studio has already
// shown a dialog in can keep that dialog's old date in its page).
async function checkScheduled(ctx, id, it) {
  const tab = await ctx.newPage();
  tab.on("dialog", (d) => d.dismiss().catch(() => {}));
  try {
    await tab.goto(`https://studio.youtube.com/video/${id}/edit`, { waitUntil: "domcontentloaded" });
    let box, vis = "";
    for (let i = 0; i < 20; i++) { // while Studio processes a new upload the visibility reads "Pending"
      if (i) { await sleep(30000); await tab.reload({ waitUntil: "domcontentloaded" }); }
      box = tab.locator("ytcp-video-metadata-visibility").first();
      await box.waitFor({ timeout: 60000 }); await sleep(3000);
      if (await tab.getByRole("button", { name: /edit draft/i }).first().isVisible().catch(() => false)) throw new Error(`${id} is still a draft`);
      vis = (await box.innerText()).replace(/\s+/g, " ");
      if (!/Pending/i.test(vis)) break;
    }
    if (!/Scheduled/i.test(vis)) throw new Error(`${id} reads back as "${vis.trim()}", not Scheduled`);
    await box.click(); await sleep(2500);
    const date = (await tab.locator("#datepicker-trigger").first().innerText()).trim();
    const clock = await tab.locator("#time-of-day-container input").first().inputValue();
    if (!date.includes(it.date) || clock.replace(/\s/g, "") !== it.clock.replace(/\s/g, ""))
      throw new Error(`${id} is scheduled for ${date} ${clock}, wanted ${it.date} ${it.clock}`);
  } finally { await tab.close({ runBeforeUnload: false }).catch(() => {}); }
}

// A Short is left a draft: the file finishes uploading, the dialog (which saves as it goes) is closed without choosing a
// visibility, and the draft is opened again to read its title and description back.
async function saveDraft(page, dlg, it, rec) {
  for (let i = 0; i < 900; i++) { // closing before the file is up loses the upload
    const t = await dlg.locator(".progress-label").first().innerText().catch(() => "");
    if (!/uploading/i.test(t)) break;
    await sleep(2000);
  }
  await sleep(4000); // let the dialog's own save of the last field land
  await shot(page, it, "before-close");
  await dlg.locator("#ytcp-uploads-dialog-close-button").first().click({ timeout: 30000 }); // "Save and close"
  await sleep(3000);
  await shot(page, it, "closed");
  await openDraft(page, rec.video_id);
  const d = page.locator(DIALOG);
  const title = (await d.locator("#title-textarea #textbox").innerText()).trim();
  const desc = (await d.locator("#description-textarea #textbox").innerText()).trim();
  const lists = await picked(d.locator("ytcp-video-metadata-playlists").first());
  await shot(page, it, "draft");
  if (title !== it.title) throw new Error(`the draft's title reads back as "${title}", wanted "${it.title}"`);
  if (desc !== it.description.trim()) throw new Error("the draft's description reads back differently");
  if (it.playlist && !lists.includes(it.playlist)) throw new Error(`the draft's playlist reads back as "${lists.join(", ")}"`);
  await d.locator("#ytcp-uploads-dialog-close-button").first().click({ timeout: 30000 }).catch(() => {});
  await sleep(2000);
  Object.assign(rec, { title: it.title, meta: it.meta, captions: "studio", playlist: it.playlist, status: "draft", done: true,
    uploaded: new Date().toISOString().replace(/\.\d+Z$/, "Z") });
  delete rec.incomplete;
  fs.writeFileSync(it.record, JSON.stringify(rec, null, 2) + "\n");
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

// --thumb: set a new thumbnail on a video already up. It reads the title back first, so a wrong record can't touch another video.
async function rethumb(page, it, rec) {
  await page.goto(`https://studio.youtube.com/video/${rec.video_id}/edit`, { waitUntil: "domcontentloaded" });
  const titleBox = page.locator("#title-textarea #textbox").first();
  await titleBox.waitFor({ timeout: 60000 });
  await sleep(4000); // the edit page fills its boxes after it appears
  const got = (await titleBox.innerText()).trim();
  if (got !== rec.title) throw new Error(`video ${rec.video_id} is titled "${got}", not "${rec.title}" as on record: not touching it`);
  makeThumb(it);
  const input = page.locator("ytcp-thumbnails-compact-editor-uploader input#file-loader, input#file-loader").first();
  await input.setInputFiles(it.thumb);
  await sleep(5000);
  const thumbErr = await page.locator("ytcp-thumbnails-compact-editor-uploader .error, #thumbnail-error").first().innerText().catch(() => "");
  if (thumbErr.trim()) throw new Error(`thumbnail refused: ${thumbErr.trim()}`);
  await shot(page, it, "thumb");
  const save = page.locator("ytcp-button#save").first();
  await save.click();
  let saved = false;
  for (let i = 0; i < 30 && !saved; i++) {
    await sleep(1000);
    saved = (await save.getAttribute("aria-disabled").catch(() => null)) === "true" || !(await save.isEnabled().catch(() => true));
  }
  if (!saved) throw new Error("Studio did not save the new thumbnail");
  rec.thumbnail = THUMB(it); rec.thumbnail_set = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  fs.writeFileSync(it.record, JSON.stringify(rec, null, 2) + "\n");
}

// --delete: remove one video forever, through its Studio page. It reads the title back first and stops unless it matches
// --title exactly, so a wrong id can't delete the wrong video. Every step before the final click only looks.
async function deleteVideo(page, id, title) {
  await page.goto(`https://studio.youtube.com/video/${id}/edit`, { waitUntil: "domcontentloaded" });
  const titleBox = page.locator("#title-textarea #textbox").first();
  await titleBox.waitFor({ timeout: 60000 });
  await sleep(4000); // the edit page fills its boxes after it appears
  const got = (await titleBox.innerText()).trim();
  if (got !== title) throw new Error(`video ${id} is titled "${got}", not "${title}": not deleting it`);
  await shot(page, { id: `delete/${id}` }, "before");
  const more = page.locator("#overflow-menu-button, ytcp-icon-button[aria-label='Options'], ytcp-icon-button[aria-label='More actions'], [aria-label='Options'], [aria-label='More actions']").first();
  await more.click({ timeout: 30000 });
  await sleep(1200);
  await page.locator("tp-yt-paper-item, [role=menuitem], ytcp-text-menu tp-yt-paper-item").filter({ hasText: /^\s*Delete( forever)?\s*$/ }).first().click({ timeout: 15000 });
  await sleep(1500);
  const dlg = page.locator("ytcp-confirmation-dialog, ytcp-dialog, tp-yt-paper-dialog, [role=dialog]").filter({ hasText: /delet/i }).last();
  await dlg.waitFor({ state: "visible", timeout: 15000 });
  const box = dlg.locator("ytcp-checkbox-lit, tp-yt-paper-checkbox, [role=checkbox]").first();
  if (await box.isVisible().catch(() => false)) { await box.click(); await sleep(600); }
  await shot(page, { id: `delete/${id}` }, "confirm");
  await dlg.getByRole("button", { name: /^\s*Delete( forever| draft video)?\s*$/i }).last().click({ timeout: 15000 }); // a draft's says "Delete draft video"
  await sleep(6000);
  await shot(page, { id: `delete/${id}` }, "after");
  // the video's Studio page should now be gone
  await page.goto(`https://studio.youtube.com/video/${id}/edit`, { waitUntil: "domcontentloaded" });
  await sleep(6000);
  const still = await page.locator("#title-textarea #textbox").first().isVisible().catch(() => false);
  if (still) throw new Error(`video ${id} still has a Studio page after the delete`);
}

(async () => {
  const DEL = opt("--delete");
  if (DEL) {
    const title = opt("--title");
    if (!/^[\w-]{11}$/.test(DEL) || !title) { console.error("studio_upload: --delete <11-character video id> --title \"<its exact title>\""); process.exitCode = 2; return; }
    console.log(`delete forever  https://youtu.be/${DEL}\n  only if its Studio title reads exactly: ${title}`);
    if (PLAN) return;
    const ctx = await launch();
    const page = ctx.pages()[0] || (await ctx.newPage());
    try { await deleteVideo(page, DEL, title); console.log(`  deleted https://youtu.be/${DEL}`); }
    catch (e) {
      const shotPath = path.join(SHOTS, "studio-delete-error.png");
      await page.screenshot({ path: shotPath }).catch(() => {});
      fs.writeFileSync(shotPath.replace(/\.png$/, ".html"), await page.content().catch(() => ""));
      console.log(`STOPPED: ${e.message.split("\n")[0]}\n  screenshot: ${shotPath}`);
      process.exitCode = 1;
    } finally { await ctx.close(); }
    return;
  }
  if (opt("--draft")) {
    const id = opt("--draft"), title = opt("--title"), descFile = opt("--description"), time = opt("--time") || (V.shorts || {}).time;
    const problems = [];
    if (!/^[\w-]{11}$/.test(id || "")) problems.push("--draft takes an 11-character video id");
    if (!title) problems.push("--title: the draft's exact title in Studio");
    const description = descFile && fs.existsSync(descFile) ? fs.readFileSync(descFile, "utf8").trim() : "";
    if (!description) problems.push("--description: a file with the description");
    if (/https?:\/\/|www\.|youtu\.?be|\.com\b/i.test(description)) problems.push("the description has a link");
    if (description.length > 5000 || /[<>]/.test(description)) problems.push("the description is one Studio would reject (over 5000 characters, or < >)");
    if (!DAY || !/^\d{4}-\d\d-\d\d$/.test(DAY)) problems.push("--day YYYY-MM-DD");
    const dir = path.join(BOOK, "drafts"); fs.mkdirSync(dir, { recursive: true });
    const it = { id, kind: "short", short: true, title, description, playlist: (V.shorts || {}).playlist, srt: opt("--srt"),
      record: path.join(dir, `${id}.youtube.json`), reschedule: id, day: DAY, meta: crypto.createHash("sha1").update(title + "\n" + description).digest("hex").slice(0, 12) };
    if (DAY) Object.assign(it, slot(DAY, time));
    const prior = fs.existsSync(it.record) ? readJSON(it.record) : null;
    if (prior && prior.status === "scheduled") problems.push(`already scheduled for ${prior.publish_at}`);
    console.log(`${id}  ${title}\n  publish    ${it.day} ${it.clock} ${V.schedule.timezone} (${it.publish_at})\n  playlist   ${it.playlist}\n  description\n` + description.split("\n").map((l) => `    | ${l}`).join("\n"));
    for (const p of problems) console.log(`  PROBLEM: ${p}`);
    if (PLAN || problems.length) { if (problems.length) process.exitCode = 1; return; }
    if (!prior) fs.writeFileSync(it.record, JSON.stringify({ video_id: id, title, via: "studio", status: "draft", done: true }, null, 2) + "\n");
    const ctx = await launch();
    const page = ctx.pages()[0] || (await ctx.newPage());
    page.on("dialog", (d) => (d.type() === "beforeunload" ? d.accept() : d.dismiss()).catch(() => {}));
    try {
      await openDraft(page, id);
      const got = (await page.locator(`${DIALOG} #title-textarea #textbox`).innerText()).trim();
      if (got !== title) throw new Error(`the draft is titled "${got}", not "${title}": not touching it`);
      await page.locator(`${DIALOG} #ytcp-uploads-dialog-close-button`).first().click().catch(() => {}); await sleep(2000);
      const r = await upload(page, it);
      console.log(`  ${id}  scheduled ${it.day} ${it.clock}  ${title}`);
    } catch (e) {
      const shotPath = path.join(dir, `${id}-error.png`);
      await page.screenshot({ path: shotPath }).catch(() => {});
      console.log(`STOPPED: ${e.message.split("\n")[0]}\n  screenshot: ${shotPath}`);
      process.exitCode = 1;
    } finally { await ctx.close(); }
    return;
  }
  if (SHORT) {
    let items;
    try { items = shortDirs(SHORT).map((d, i) => shortPlan(d, i)); } catch (e) { console.error(`studio_upload: ${e.message}`); process.exitCode = 2; return; }
    const todo = items.filter((it) => !it.already);
    if (!PLAN) for (const it of todo) if (!it.problems.length && !it.qa) runQA(it); // last, because it takes minutes
    for (const it of items) printShort(it);
    // --lane k/n: this run takes every nth Short, starting at the kth; each keeps the day its place in the full list gives it
    const lane = opt("--lane") && opt("--lane").split("/").map(Number);
    if (lane) items.forEach((it, i) => { it.lane = (i % lane[1]) + 1; });
    const mine = (it) => !lane || it.lane === lane[0];
    const ready = todo.filter((it) => !it.problems.length && mine(it)).slice(0, LIMIT), held = todo.filter((it) => it.problems.length);
    const verb = DAY ? `to schedule (${ready.filter((it) => it.reschedule).length} of them drafts already up, scheduled in place)` : "to upload as drafts";
    console.log(`\n${items.length - todo.length} already up, ${ready.length} ${verb}, ${held.length} held back by a problem`);
    if (PLAN) { if (held.length) process.exitCode = 1; return; }
    if (!ready.length) { if (held.length) process.exitCode = 1; return; }
    const ctx = await launch();
    const page = ctx.pages()[0] || (await ctx.newPage());
    // a closed draft leaves its edit page with the form marked changed, and Studio then asks "Leave page?" on the next
    // navigation; the draft is already saved and read back, so leave (other dialogs are dismissed, as by default)
    page.on("dialog", (d) => (d.type() === "beforeunload" ? d.accept() : d.dismiss()).catch(() => {}));
    let n = 0;
    try {
      for (const it of ready) {
        if (it.again && fs.existsSync(it.record)) { // keep the earlier upload's record beside the new one
          const to = path.join(it.folder, `${it.stem}.earlier-${it.again}.youtube.json`);
          fs.renameSync(it.record, to); console.log(`  ${it.id}: the earlier record is now ${path.basename(to)}`);
        }
        const now = fs.existsSync(it.record) ? readJSON(it.record) : null; // another lane may have done it since the plan
        if (now && now.done && (now.status === "scheduled" || (!it.publish_at && now.status === "draft")) && !it.again) { console.log(`  ${it.id}  already ${now.status}, skipped`); n++; continue; }
        const r = await upload(page, it);
        if (r === "limit") { console.log("STOPPED: Studio's daily upload limit is reached; rerun later"); process.exitCode = 1; break; }
        console.log(`  ${it.id}  ${it.publish_at ? `scheduled ${it.day} ${it.clock}` : "draft"} https://youtu.be/${r}  ${it.title}  (${++n}/${ready.length})`);
      }
      if (n) console.log(`  commit the records: git -C videos add ${path.relative(path.join(ROOT, "videos"), BOOK)}/*/*.youtube.json && git -C videos commit`);
    } catch (e) {
      const it = ready[n], shotPath = path.join(it.folder, "studio-upload-error.png");
      await page.screenshot({ path: shotPath }).catch(() => {});
      fs.writeFileSync(shotPath.replace(/\.png$/, ".html"), await page.content().catch(() => ""));
      console.log(`STOPPED at ${it.id}: ${e.message.split("\n")[0]}\n  screenshot: ${shotPath}\n  rerun the same command to resume`);
      process.exitCode = 1;
    } finally { await ctx.close(); }
    if (held.length) process.exitCode = 1;
    return;
  }
  if (LONG && args.includes("--thumb")) {
    let it;
    try { it = longFormPlan(LONG); } catch (e) { console.error(`studio_upload: ${e.message}`); process.exitCode = 2; return; }
    const rec = fs.existsSync(it.record) ? JSON.parse(fs.readFileSync(it.record, "utf8")) : null;
    if (!rec || !rec.done) { console.error(`studio_upload: ${it.id} has no finished upload on record (${path.basename(it.record)})`); process.exitCode = 1; return; }
    console.log(`${it.id}  new thumbnail for https://youtu.be/${rec.video_id}  ${rec.title}`);
    if (PLAN) { makeThumb(it); console.log(`  made ${path.relative(ROOT, it.thumb)}; nothing set in Studio`); return; }
    const ctx = await launch();
    const page = ctx.pages()[0] || (await ctx.newPage());
    try { await rethumb(page, it, rec); console.log(`  thumbnail set`); }
    catch (e) {
      const shotPath = path.join(it.folder, "studio-thumb-error.png");
      await page.screenshot({ path: shotPath }).catch(() => {});
      console.log(`STOPPED: ${e.message.split("\n")[0]}\n  screenshot: ${shotPath}`);
      process.exitCode = 1;
    } finally { await ctx.close(); }
    return;
  }
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
      else console.log(`  uploaded https://youtu.be/${r}  ${it.title}  → ${it.now ? "public now" : `${it.date} ${it.clock} ${V.schedule.timezone}`}\n` +
        `  commit its record: git -C videos add ${path.basename(BOOK)}/${path.relative(BOOK, it.folder)}/${it.stem}*.youtube.json && git -C videos commit`);
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
