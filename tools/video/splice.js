/* splice.js — used by assemble.js --parts=… --into=<old.mp4>: put freshly recorded parts into a video recorded before.

   Each recorded part starts on its own section card (fully shown) and ends on the next part's card (fully shown), the
   way assemble.js joins parts. In the old video, the same cards hold still for a moment. So part k replaces the old
   video from the first frame where card k is fully shown to the first frame where card k + 1 is: a join falls on a still
   card, and nothing jumps. The intro (part 0) starts at 0:00, and the last part runs to the end.

   The picture is cut on the card, but the sound is cut on the words. A one-take recording can slip, so its narration
   may start a part before that part's card is up, or still be finishing the last part when it is. The old captions keep
   the old narration's own times, so they say where each part's first word starts and where the part before ends:
     - where a new part comes in, the old sound stops before the replaced part's first word (the old picture still runs
       to the card, in silence), and if the old part before is still talking at the card, the card is held until it ends;
     - where the old video takes over again, its sound starts after the replaced part's last word and before the next
       part's first word, and if that comes before the card is up, the card is held while the sound catches up.
   A new part starts with its card held in silence before its first word; when a join already leaves a long pause, some
   of that hold is dropped.

   The card frames are found near the old video's chapter times (<old>.chapters.txt: line k is part k), by comparing
   small greyscale frames against the part's own first and last frames. The video is encoded once more with studio.js's
   settings; each part keeps the levelled narration studio.js gave it. Old captions keep their place relative to their
   own sound, the part's own captions go in its span, and every chapter is put just before its part's first caption. */
const fs = require("fs"), path = require("path"), cp = require("child_process");

const FPS = 60, W = 96, H = 54, PIX = W * H;
const LEAD = 1.15; // a recorded part: its card is fully shown this long before its first word (studio.js)
const MIN_LEAD = 0.3, EDGE = 0.06; // shortest hold kept on a new part's card; silence kept around a cut in the old sound
const VENC = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
  "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-tune", "animation", "-g", "120"];
const run = (bin, a) => cp.execFileSync(bin, a, { maxBuffer: 2e9 });
const ff = (a) => run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a]);
const duration = (f) => +run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim();
const frames = (f) => +run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", f]).toString().trim();
const small = (pre, f) => run("ffmpeg", ["-hide_banner", "-loglevel", "error", ...pre, "-i", f, "-vf", `scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"]);
const diff = (a, ai, b) => { let d = 0; for (let i = 0; i < PIX; i++) d += Math.abs(a[ai * PIX + i] - b[i]); return d / PIX; };
const f6 = (x) => x.toFixed(6);

// the first frame, near `around` seconds into the old video, where the picture settles on `ref` (a card fully shown)
function settle(old, ref, around, what) {
  const from = Math.max(0, around - 25), buf = small(["-ss", from.toFixed(3), "-t", "50"], old), n = buf.length / PIX;
  const d = Array.from({ length: n }, (_, i) => diff(buf, i, ref)), best = Math.min(...d);
  if (best > 6) throw new Error(`${what}: no frame within 25 s of ${around.toFixed(1)} s looks like the part's card (closest differs by ${best.toFixed(1)}/255)`);
  const i = d.findIndex((x) => x <= best + 0.75);
  return { t: Math.round((from + i / FPS) * FPS) / FPS, best };
}

const parseT = (t) => { const [h, m, rest] = t.split(":"), [s, ms] = rest.split(","); return +h * 3600 + +m * 60 + +s + +ms / 1000; };
const stamp = (t) => { const ms = Math.round(t * 1000), z = (v, n = 2) => String(v).padStart(n, "0"); return `${z(ms / 3600000 | 0)}:${z((ms / 60000 | 0) % 60)}:${z((ms / 1000 | 0) % 60)},${z(ms % 1000, 3)}`; };
const readSrt = (f) => fs.readFileSync(f, "utf8").trim().split(/\n\s*\n/).map((blk) => {
  const [, time, ...text] = blk.split("\n"), [a, b] = time.split(" --> ");
  return [parseT(a), parseT(b), text.join("\n")];
});
const clockSecs = (c) => c.split(":").reduce((s, x) => s * 60 + +x, 0);
const clock = (t) => `${t / 60 | 0}:${String(t % 60 | 0).padStart(2, "0")}`;
const words = (t) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
const firstText = (p) => (p.segments.find((s) => String(s.text).trim()) || {}).text || "";

// the cue where `text` starts to be said: its first words, read across a few cues (a sentence may be split), nearest `near`
function cueOf(cues, text, near, within = 40) {
  const w = words(text).slice(0, 5); let best = -1;
  cues.forEach(([a], i) => {
    if (Math.abs(a - near) > within) return;
    const got = cues.slice(i, i + 4).flatMap(([, , t]) => words(t)).slice(0, w.length);
    if (w.length && got.join(" ") === w.join(" ") && (best < 0 || Math.abs(a - near) < Math.abs(cues[best][0] - near))) best = i;
  });
  return best;
}

module.exports = function splice({ parts, picked, old, out, build }) {
  const base = old.replace(/\.mp4$/, ""), chapFile = base + ".chapters.txt", srtFile = base + ".srt";
  for (const f of [old, chapFile, srtFile]) if (!fs.existsSync(f)) throw new Error(`splice: missing ${f}`);
  const chap = fs.readFileSync(chapFile, "utf8").trim().split("\n").map((l) => { const m = l.match(/^(\S+)\s+(.*)$/); return [clockSecs(m[1]), m[2]]; });
  if (chap.length !== parts.length) throw new Error(`splice: the old video has ${chap.length} chapters but the script has ${parts.length} parts`);
  const oldLen = duration(old), oldCues = readSrt(srtFile);

  // where the old narration of part k starts: its first cue, and the end of the last cue before it
  const speech = (k, near) => {
    const i = cueOf(oldCues, firstText(parts[k]), near);
    if (i < 0) throw new Error(`splice: can't find part ${k}'s first words ("${firstText(parts[k]).slice(0, 40)}…") in the old captions near ${clock(near)}`);
    return { start: oldCues[i][0], prevEnd: i ? oldCues[i - 1][1] : 0 };
  };

  // each picked part: its span in the old video (picture: card to card) and where the old sound may be cut around it
  const spans = picked.slice().sort((a, b) => a - b).map((k) => {
    const p = parts[k], file = path.join(p.dir, "part.mp4");
    const first = small(["-t", "0.05"], file).subarray(0, PIX);
    const tail = small(["-sseof", "-0.5"], file), last = tail.subarray(tail.length - PIX);
    const s = k === 0 ? { t: 0, best: 0 } : settle(old, first, chap[k][0], `part ${k} start`);
    const e = k === parts.length - 1 ? { t: oldLen, best: 0 } : settle(old, last, chap[k + 1][0], `part ${k} end`);
    if (e.t <= s.t) throw new Error(`splice: part ${k}'s span in the old video is empty`);
    const len = frames(file) / FPS, srt = path.join(p.dir, "part.srt");
    const own = fs.existsSync(srt) ? readSrt(srt) : [];
    // in: the old sound stops between the part before's last word and this part's first word
    const sIn = k === 0 ? null : speech(k, s.t);
    const aIn = k === 0 ? 0 : Math.max(sIn.prevEnd + EDGE, Math.min(s.t, sIn.start - EDGE));
    // out: the old sound starts again between this part's last word and the next part's first word
    const sOut = k === parts.length - 1 ? null : speech(k + 1, e.t);
    const aOut = k === parts.length - 1 ? oldLen : Math.min(sOut.start - EDGE, Math.max(e.t, sOut.prevEnd + EDGE));
    console.log(`  part ${k} (${p.title}): old ${clock(s.t)}–${clock(e.t)} (${(e.t - s.t).toFixed(2)} s) → new ${len.toFixed(2)} s` +
      `  [card match ${s.best.toFixed(2)}, ${e.best.toFixed(2)}; old sound cut ${(aIn - s.t >= 0 ? "+" : "") + (aIn - s.t).toFixed(2)} s, ${(aOut - e.t >= 0 ? "+" : "") + (aOut - e.t).toFixed(2)} s from the cards]`);
    return { k, file, own, timeline: path.join(p.dir, "timeline.json"), s: s.t, e: e.t, aIn, aOut, len,
      prevEnd: sIn ? sIn.prevEnd : 0, oldStart: sIn ? sIn.start : 0, lead: own.length ? own[0][0] : LEAD };
  });
  spans.forEach((x, i) => { if (i && x.s < spans[i - 1].e) throw new Error("splice: picked parts overlap in the old video"); });

  // pieces in order: old, new, old, …  An old piece runs its picture from `vFrom` to `vTo` and its sound from `aFrom` to
  // `aTo`; the picture holds its first frame while the sound starts early, and its last frame while the sound runs late.
  // An old instant t lands at the piece's start + (t - origin), origin = min(vFrom, aFrom).
  const pieces = []; let prev = null;
  const oldPiece = (vFrom, aFrom, vTo, aTo) => {
    const origin = Math.min(vFrom, aFrom), headHold = vFrom - origin;
    const end = Math.max(vTo, aTo), tailHold = end - vTo;
    return { old: true, vFrom, vTo, aFrom, aTo, origin, headHold, tailHold, dur: end - origin };
  };
  for (const x of spans) {
    const vFrom = prev ? prev.e : 0, aFrom = prev ? prev.aOut : 0;
    if (x.s > vFrom + 1e-6) pieces.push(oldPiece(vFrom, aFrom, x.s, x.aIn)); // adjacent parts have nothing old between them
    // the new part's card hold: drop some of it when the old sound before already leaves a long pause
    const before = pieces.length && pieces[pieces.length - 1].old ? pieces[pieces.length - 1] : null;
    const quiet = before ? before.dur - (Math.min(before.aTo, x.prevEnd) - before.origin) : 0; // silence the old piece ends with
    const natural = before ? x.oldStart - x.prevEnd : 0; // the pause the old take had here
    const cut = before ? Math.max(0, Math.min(x.lead - MIN_LEAD, quiet + x.lead - Math.max(natural, x.lead))) : 0;
    pieces.push({ part: x, cut, dur: x.len - cut });
    prev = x;
  }
  if (prev.e < oldLen - 1 / FPS || prev.aOut < oldLen - 1 / FPS) pieces.push(oldPiece(prev.e, prev.aOut, oldLen, oldLen));

  const inputs = ["-i", old, ...spans.flatMap((x) => ["-i", x.file])], flt = [];
  pieces.forEach((pc, i) => {
    if (pc.old) {
      const hold = [pc.headHold > 1e-4 ? `start_mode=clone:start_duration=${f6(pc.headHold)}` : "", pc.tailHold > 1e-4 ? `stop_mode=clone:stop_duration=${f6(pc.tailHold)}` : ""].filter(Boolean).join(":");
      flt.push(`[0:v]trim=start=${f6(pc.vFrom)}:end=${f6(pc.vTo)},setpts=PTS-STARTPTS${hold ? ",tpad=" + hold : ""}[v${i}]`);
      const lead = pc.aFrom - pc.origin; // silence before the sound, when the sound starts after the picture
      flt.push(`[0:a]aresample=48000,atrim=start=${f6(pc.aFrom)}:end=${f6(pc.aTo)},asetpts=PTS-STARTPTS` +
        `${lead > 1e-4 ? `,adelay=${Math.round(lead * 1000)}:all=1` : ""},apad,atrim=0:${f6(pc.dur)}[a${i}]`);
    } else {
      const n = 1 + spans.indexOf(pc.part);
      flt.push(`[${n}:v]trim=start=${f6(pc.cut)},setpts=PTS-STARTPTS[v${i}]`);
      flt.push(`[${n}:a]aresample=48000,atrim=start=${f6(pc.cut)},asetpts=PTS-STARTPTS,apad,atrim=0:${f6(pc.dur)}[a${i}]`);
    }
  });
  flt.push(pieces.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${pieces.length}:v=1:a=1[vc][a]`);
  flt.push("[vc]fps=60,format=yuv420p[v]");
  const tmp = path.join(build, "splice.mp4");
  console.log(`  encoding ${pieces.length} pieces (the whole video, once)…`);
  ff([...inputs, "-filter_complex", flt.join(";"), "-map", "[v]", "-map", "[a]", ...VENC, "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "1", "-movflags", "+faststart", tmp]);

  // captions: an old cue stays if its sound does, at its sound's new place; a new part's cues go in its piece
  let at = 0; const cues = [], joins = [];
  pieces.forEach((pc) => {
    if (pc.old) {
      for (const [a, b, t] of oldCues) if (a >= pc.aFrom - 1e-6 && a < pc.aTo - 1e-6) cues.push([at + a - pc.origin, at + Math.min(b, pc.aTo) - pc.origin, t]);
    } else {
      for (const [a, b, t] of pc.part.own) cues.push([at + a - pc.cut, at + b - pc.cut, t]);
      joins.push({ part: pc.part.k, at, len: pc.dur, cut: pc.cut });
    }
    at += pc.dur;
  });
  cues.sort((p, q) => p[0] - q[0]);

  // chapters: just before each part's first caption, as long as a recorded part holds its card
  const chapters = chap.map(([t, h], k) => {
    if (k === 0) return [0, h];
    const i = cueOf(cues, firstText(parts[k]), t, 120);
    if (i < 0) throw new Error(`splice: can't find part ${k}'s first words in the new captions`);
    return [Math.max(0, cues[i][0] - LEAD), h];
  });

  const outBase = out.replace(/\.mp4$/, "");
  fs.renameSync(tmp, out);
  fs.writeFileSync(outBase + ".srt", cues.map(([a, b, t], i) => `${i + 1}\n${stamp(a)} --> ${stamp(b)}\n${t}\n`).join("\n"));
  fs.writeFileSync(outBase + ".chapters.txt", chapters.map(([t, h]) => `${clock(t)} ${h}`).join("\n") + "\n");
  fs.writeFileSync(path.join(build, "splice.json"), JSON.stringify({ old: path.basename(old), at: new Date().toISOString(),
    spans: spans.map(({ k, s, e, aIn, aOut, len }) => ({ part: k, title: parts[k].title, old_from: s, old_to: e, sound_from: aIn, sound_to: aOut, new_len: len })),
    joins }, null, 1));
  console.log(`\nwrote ${out}  [${duration(out).toFixed(2)} s, was ${oldLen.toFixed(2)} s]  with ${spans.length} part${spans.length === 1 ? "" : "s"} spliced in`);
};
