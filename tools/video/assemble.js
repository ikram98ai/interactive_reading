#!/usr/bin/env node
/* assemble.js <manifest.json> [--dry-run] [--force] [--page-scenes=a,b] [--prune] — record a long form part by part, and join them.

   narrate.py writes one manifest for the whole script. This splits it at every section card ({goto id | kicker | head},
   one YouTube chapter each, plus the intro before the first card), records each part with studio.js on a page of its
   own, and joins them into the same video, captions and chapters a single studio.js run would make.

   Each part is cached under build/<voice>/parts/<hash>/, where the hash covers everything in the script that decides
   what the part looks and sounds like: its blocks (words, clip, timing, cues), the cards it starts and ends on, the
   layers earlier parts hid, and the targets it names. So after a script edit only the parts whose words or cues changed
   are recorded again, and the join takes about a minute. A part's narration is cached by its words (narrate.py), and
   so is its breath after each block, so changing one part never shifts another.

   The chapter page is one file for every scene, so a part can't tell from it which scenes an edit touched. When the
   page (or a script or stylesheet it loads, or studio.js) has changed since a part was recorded, the part is recorded
   again, unless --page-scenes names the scenes the page edit changed: then only the parts that show one of them are.

   How parts join without a seam: a part ends by fading in the veil (a flat frame of the page's background), exactly as
   the next {goto} would, and the next part starts under it and dissolves into its scene while the voice goes on. The video is joined without re-encoding, and the narration of all parts
   is levelled together, as one, so the loudness doesn't step at a join.

   --dry-run  list which parts would be recorded, and record nothing
   --force    record every part again
   --page-scenes=big-o,omega  the page changed only in these scenes (ids): keep the parts that don't show them
   --prune    delete cached parts the current script no longer uses (they are only a cache; nothing else reads them)
   --parts=3,15 --into=<old.mp4>  record only these parts (by index, 0 = the intro), and splice them into a video recorded
              before, instead of joining every part: each part replaces the span of the old video from its card to the next
              card, found by matching the card frames, so a join falls on a still card. The old video's captions and chapters
              are moved by the change in length. Writes the manifest's out (the old file can be the same path). For fixing a
              few sentences in a video whose parts were never cached. */
const fs = require("fs"), path = require("path"), cp = require("child_process"), crypto = require("crypto");

const ROOT = path.resolve(__dirname, "../..");
const STUDIO = path.join(__dirname, "studio.js");
const FPS = 60; // studio.js encodes at a constant 60 frames a second

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const mf = args.find((a) => !a.startsWith("--"));
if (!mf) { console.error("usage: assemble.js <build/<voice>/manifest.json> [--dry-run] [--force] [--prune]"); process.exit(1); }
const M = JSON.parse(fs.readFileSync(mf, "utf8"));
const build = path.dirname(path.resolve(mf)), cache = path.join(build, "parts");
const sha = (x) => crypto.createHash("sha256").update(x).digest("hex");

// --- split at the section cards
const cardOf = (s) => {
  const g = s.cues.find((c) => c.op === "goto" && c.arg.split("|").length >= 3);
  if (!g) return null;
  const [id, kicker, head] = g.arg.split("|").map((v) => v.trim());
  return { id, kicker, head };
};
const parts = [];
M.segments.forEach((s, i) => {
  const card = cardOf(s);
  if (card || !parts.length) parts.push({ card, from: i, segments: [] });
  parts[parts.length - 1].segments.push(s);
});

// the page and everything it loads from this repository: an edit to any of them changes what a part shows
function pageFiles(page) {
  const html = path.join(ROOT, page), files = [html], src = fs.readFileSync(html, "utf8");
  for (const [, ref] of src.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
    if (/^(https?:|data:|mailto:|\/\/)/.test(ref)) continue;
    const f = path.resolve(path.dirname(html), ref);
    if (/\.(js|css|json)$/.test(f) && fs.existsSync(f) && !files.includes(f)) files.push(f);
  }
  return files;
}
const pageHash = sha(pageFiles(M.meta.page).map((f) => path.relative(ROOT, f) + "\n" + fs.readFileSync(f)).join("\n"));
const studioHash = sha(fs.readFileSync(STUDIO));

const opt = (name) => { const a = args.find((x) => x.startsWith(name + "=")); return a ? a.slice(name.length + 1) : null; };
const changedScenes = opt("--page-scenes") ? opt("--page-scenes").split(",").map((v) => v.trim()).filter(Boolean) : null;
const INTO = opt("--into"), ONLY_PARTS = opt("--parts") ? opt("--parts").split(",").map(Number) : null;
if (!INTO !== !ONLY_PARTS) { console.error("--parts and --into go together: record these parts, and splice them into that video"); process.exit(1); }
const done = (p) => { try { return JSON.parse(fs.readFileSync(path.join(p.dir, "done.json"), "utf8")); } catch (e) { return null; } };

const hidden = []; // every {hide}/{show} so far: the layers a part inherits from the parts before it
parts.forEach((p, k) => {
  const next = parts[k + 1];
  p.part = {
    index: k, count: parts.length,
    enter: p.card ? [p.card.kicker, p.card.head] : null,
    exit: next ? [next.card.kicker, next.card.head] : null,
    prelude: hidden.slice(),
  };
  p.segments.forEach((s) => s.cues.forEach((c) => { if (c.op === "show" || c.op === "hide") hidden.push([c.op, c.arg]); }));
  p.title = p.card ? p.card.head : "Intro";
  const meta = { ...M.meta, scene: p.card ? p.card.id : M.meta.scene };
  p.scenes = new Set([meta.scene, ...p.segments.flatMap((s) => s.cues.filter((c) => c.op === "goto").map((c) => c.arg.split("|")[0].trim()))]);
  // what decides the recording; a clip is named by its key (voice, speed and words), not by its file, whose number shifts
  const look = p.segments.map(({ i, wav, wer, heard, ...rest }) => rest);
  const names = [...p.part.prelude.map(([, a]) => a), ...p.segments.flatMap((s) => s.cues.filter((c) => /^(focus|show|hide)$/.test(c.op)).map((c) => c.arg))]
    .flatMap((a) => a.split("+").map((x) => x.trim()));
  const targets = Object.fromEntries(Object.entries(M.meta.targets || {}).filter(([k]) => names.includes(k)));
  p.hash = sha(JSON.stringify({ meta: { ...meta, targets }, code: M.code, runs: M.runs, voice: M.voice, silent: M.silent, part: p.part, look })).slice(0, 16);
  p.dir = path.join(cache, p.hash);
  const d = !flag("--force") && fs.existsSync(path.join(p.dir, "part.mp4")) && done(p);
  const pageOk = d && (d.page === pageHash || (changedScenes && !changedScenes.some((id) => p.scenes.has(id))));
  p.cached = !!(d && pageOk && d.studio === studioHash);
  p.why = !d ? "new" : !pageOk ? "page changed" : d.studio !== studioHash ? "studio.js changed" : "";
  if (p.cached && d.page !== pageHash) p.accept = true; // the page edit doesn't reach this part: record that it's current
  p.manifest = { ...M, meta, segments: p.segments, part: p.part, name: `${M.name} part ${k}`, out: path.join(p.dir, "part.mp4") };
});

if (ONLY_PARTS) parts.forEach((p, k) => {
  const want = ONLY_PARTS.includes(k);
  if (want && p.cached) return;
  if (want) { p.cached = false; if (!p.why) p.why = "asked for"; } else { p.cached = true; p.why = "not asked for"; }
});
const speech = (p) => p.segments.reduce((t, s) => t + s.dur + (s.then && s.then.pause || 0) + (s.gap || 0), 0);
const todo = parts.filter((p) => !p.cached);
console.log(`${M.name}: ${parts.length} parts, ${parts.length - todo.length} cached, ${todo.length} to record` +
  (todo.length ? ` (about ${(todo.reduce((t, p) => t + speech(p), 0) / 60).toFixed(1)} min of recording)` : ""));
parts.forEach((p, k) => console.log(`  ${String(k).padStart(2)}  ${p.cached ? "cached  " : "record  "}${p.title}  [${p.hash}]${p.why ? "  (" + p.why + ")" : ""}`));
if (changedScenes) { const unknown = changedScenes.filter((id) => !parts.some((p) => p.scenes.has(id))); if (unknown.length) console.log(`  note: no part shows ${unknown.join(", ")}`); }

if (flag("--prune") && fs.existsSync(cache)) {
  const keep = new Set(parts.map((p) => p.hash));
  const old = fs.readdirSync(cache).filter((d) => !keep.has(d));
  old.forEach((d) => fs.rmSync(path.join(cache, d), { recursive: true, force: true }));
  console.log(`pruned ${old.length} cached part${old.length === 1 ? "" : "s"} the script no longer uses`);
}
if (flag("--dry-run")) process.exit(0);
const stampDone = (p) => fs.writeFileSync(path.join(p.dir, "done.json"), JSON.stringify({ title: p.title, page: pageHash, studio: studioHash, at: new Date().toISOString() }) + "\n");
parts.filter((p) => p.accept).forEach(stampDone);

// --- record the parts that changed
const failed = [];
for (const p of todo) {
  fs.rmSync(p.dir, { recursive: true, force: true });
  fs.mkdirSync(p.dir, { recursive: true });
  const pm = path.join(p.dir, "manifest.json");
  fs.writeFileSync(pm, JSON.stringify(p.manifest, null, 1));
  console.log(`\n=== part ${p.part.index} of ${parts.length - 1}: ${p.title}`);
  const r = cp.spawnSync("node", [STUDIO, pm], { stdio: "inherit" });
  // a part far longer than its speech was recorded across a sleep: the clock kept running and the gap became dead air
  let len = 0;
  try { len = +cp.execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(p.dir, "part.mp4")]).toString(); } catch {}
  const stretched = r.status === 0 && len > 2 * speech(p) + 60;
  if (stretched) console.error(`part ${p.part.index} runs ${len.toFixed(0)} s against about ${speech(p).toFixed(0)} s of speech: the machine likely slept while recording it (keep it awake with caffeinate -i). Not cached.`);
  if (r.status === 0 && !stretched) stampDone(p);
  else failed.push(p);
}
if (failed.length) {
  console.error(`\nNOT JOINED: ${failed.length} part${failed.length === 1 ? "" : "s"} failed: ${failed.map((p) => `${p.part.index} (${p.title})`).join(", ")}. ` +
    "Fix the script and run again; the parts that passed stay cached.");
  process.exit(2);
}

// --- splice into an old video
if (INTO) { require("./splice.js")({ parts, picked: ONLY_PARTS, old: path.resolve(INTO), out: path.resolve(M.out), build }); process.exit(0); }

// --- join
const ff = (a) => cp.execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a], { maxBuffer: 1e9 });
const frames = (f) => +cp.execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames", "-of", "csv=p=0", f]).toString().trim();
const out = path.resolve(M.out), work = path.join(build, "join");
fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });

let at = 0;
parts.forEach((p) => { p.at = at; p.len = frames(path.join(p.dir, "part.mp4")) / FPS; at += p.len; });
const list = path.join(work, "parts.txt");
fs.writeFileSync(list, parts.map((p) => `file '${path.join(p.dir, "part.mp4")}'\n`).join(""));
const VIDEO = ["-f", "concat", "-safe", "0", "-i", list];

fs.mkdirSync(path.dirname(out), { recursive: true });
if (M.silent) ff([...VIDEO, "-map", "0:v", "-c", "copy", "-movflags", "+faststart", out]);
else {
  // each part's narration, padded or cut to its picture's exact length, then levelled once as studio.js levels a whole video
  const inp = [], flt = [];
  parts.forEach((p, k) => { inp.push("-i", path.join(p.dir, "narration-raw.wav")); flt.push(`[${k}:a]aresample=48000,apad,atrim=0:${p.len.toFixed(6)},asetpts=PTS-STARTPTS[a${k}]`); });
  flt.push(parts.map((_, k) => `[a${k}]`).join("") + `concat=n=${parts.length}:v=0:a=1[mix]`);
  const raw = path.join(work, "narration-raw.wav"), wav = path.join(work, "narration.wav");
  ff([...inp, "-filter_complex", flt.join(";"), "-map", "[mix]", "-c:a", "pcm_s24le", raw]);
  const probe = cp.spawnSync("ffmpeg", ["-hide_banner", "-i", raw, "-af", "loudnorm=I=-15:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const m = JSON.parse(probe.match(/\{[^{}]*\}/g).pop());
  const lf = `loudnorm=I=-15:TP=-1.5:LRA=11:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:print_format=summary`;
  ff(["-i", raw, "-af", lf, "-ar", "48000", "-c:a", "pcm_s24le", wav]);
  ff([...VIDEO, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out]);
  fs.rmSync(raw, { force: true });

  // captions: each part's, moved to where the part starts
  const parse = (t) => { const [h, mm, rest] = t.split(":"), [s, ms] = rest.split(","); return +h * 3600 + +mm * 60 + +s + +ms / 1000; };
  const stamp = (t) => { const ms = Math.round(t * 1000), z = (v, n = 2) => String(v).padStart(n, "0"); return `${z(ms / 3600000 | 0)}:${z((ms / 60000 | 0) % 60)}:${z((ms / 1000 | 0) % 60)},${z(ms % 1000, 3)}`; };
  const cues = [];
  parts.forEach((p) => {
    const srt = path.join(p.dir, "part.srt");
    if (!fs.existsSync(srt)) return;
    for (const blk of fs.readFileSync(srt, "utf8").trim().split(/\n\s*\n/)) {
      const [, time, ...text] = blk.split("\n"), [a, b] = time.split(" --> ");
      cues.push([p.at + parse(a), p.at + parse(b), text.join("\n")]);
    }
  });
  fs.writeFileSync(out.replace(/\.mp4$/, ".srt"), cues.map(([a, b, x], i) => `${i + 1}\n${stamp(a)} --> ${stamp(b)}\n${x}\n`).join("\n"));
}

// chapters, as studio.js writes them: the first has to start at 0:00
const chapters = parts.flatMap((p) => JSON.parse(fs.readFileSync(path.join(p.dir, "timeline.json"), "utf8")).chapters.map(([t, h]) => [p.at + t, h]));
if (chapters.length) {
  const clock = (t) => `${t / 60 | 0}:${String(t % 60 | 0).padStart(2, "0")}`;
  fs.writeFileSync(out.replace(/\.mp4$/, ".chapters.txt"), (chapters[0][0] < 5 ? chapters : [[0, "Intro"], ...chapters]).map(([t, h]) => `${clock(t)} ${h}`).join("\n") + "\n");
}
fs.writeFileSync(path.join(build, "timeline.json"), JSON.stringify({ parts: parts.map((p) => ({ title: p.title, hash: p.hash, at: p.at, len: p.len })), total: at }, null, 1));
const info = cp.execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size", "-of", "csv=p=0", out]).toString().trim();
console.log(`\nwrote ${out}  [${info}]  from ${parts.length} parts, ${todo.length} recorded now`);
