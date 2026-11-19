/* Chapter 8 engines. Each scene is one numbered section.
   The code panel under a machine highlights the line that machine is on. */
const { h, s, draw, sleep, seg, slider, stat, whenVisible } = K;
K.page(8);
const cap = (id, html) => { const el = K.$("#" + id); if (el) el.innerHTML = html; };
const pill = (id, text) => { const el = K.$("#" + id); if (el) el.innerHTML = `<i></i>${text}`; };
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const join = (lines) => lines.join("\n");

function box(parent, x, y, w, hgt, cls, title, sub, size = 13) {
  const r = s("rect", { x, y, width: w, height: hgt, rx: 10, class: cls });
  parent.appendChild(r);
  let t = null, u = null;
  if (title != null) {
    t = s("text", {
      x: x + w / 2,
      y: sub != null ? y + hgt / 2 - 3 : y + hgt / 2 + 4.5,
      class: "sv-text", "text-anchor": "middle",
      style: { fontWeight: 700, fontSize: size + "px" },
    }, title);
    parent.appendChild(t);
  }
  if (sub != null) {
    u = s("text", { x: x + w / 2, y: y + hgt / 2 + 13, class: "sv-label", "text-anchor": "middle" }, sub);
    parent.appendChild(u);
  }
  return { r, t, u, x, y, w, h: hgt, cx: x + w / 2, cy: y + hgt / 2 };
}
const txt = (parent, x, y, str, o = {}) => {
  const t = s("text", {
    x, y, class: o.cls || "sv-text", "text-anchor": o.anchor || "middle",
    style: Object.assign({}, o.mono ? { fontFamily: "var(--f-mono)" } : {}, o.size ? { fontSize: o.size + "px" } : {}, o.bold ? { fontWeight: 700 } : {}, o.fill ? { fill: o.fill } : {}),
  }, str);
  parent.appendChild(t);
  return t;
};
function clickable(g, label, fn) {
  g.setAttribute("class", ((g.getAttribute("class") || "") + " clickable").trim());
  g.setAttribute("tabindex", "0");
  g.setAttribute("role", "button");
  g.setAttribute("aria-label", label);
  g.addEventListener("click", fn);
  g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
  return g;
}
function button(ctr, label, cls, fn) {
  const b = h("button", { class: "btn" + (cls ? " " + cls : ""), type: "button" }, label);
  b.addEventListener("click", fn);
  ctr.appendChild(b);
  return b;
}
function session(onBusy) {
  let gen = 0, busy = false;
  const STOP = { stop: true };
  const set = (v) => { busy = v; onBusy && onBusy(v); };
  return {
    get busy() { return busy; },
    cancel() { gen++; if (busy) set(false); },
    async run(fn) {
      if (busy) return false;
      const my = ++gen;
      set(true);
      const w = async (p) => { const v = await p; if (my !== gen) throw STOP; return v; };
      try { await fn(w); }
      catch (e) { if (e !== STOP) { if (my === gen) set(false); throw e; } return false; }
      if (my === gen) set(false);
      return true;
    },
  };
}

const TOKENS = {
  c: [
    [/\/\/.*|\/\*.*?\*\//, "cm"],
    [/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/, "st"],
    [/^\s*#\s*\w+/, "pp"],
    [/\b(?:int|long|short|char|float|double|void|unsigned|signed|const|static|extern|struct|typedef|size_t|ssize_t|pid_t|sigset_t|sig_atomic_t|jmp_buf|sigjmp_buf)\b/, "ty"],
    [/\b(?:return|for|while|if|else|do|break|sizeof|NULL|goto|switch|case|default|volatile)\b/, "kw"],
    [/\b(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?)\b/, "nu"],
    [/\b[A-Za-z_]\w*(?=\s*\()/, "fn"],
  ],
  rust: [
    [/\/\/.*|\/\*.*?\*\//, "cm"],
    [/[bc]?"(?:[^"\\]|\\.)*"|b?'(?:[^'\\]|\\.)'/, "st"],
    [/#!?\[[^\]]*\]/, "pp"],
    [/\b[a-z_]\w*!/, "pp"],
    [/\b(?:i8|i16|i32|i64|isize|u8|u16|u32|u64|usize|f32|f64|bool|char|str)\b/, "ty"],
    [/\b(?:fn|let|mut|for|in|while|loop|if|else|match|return|pub|static|const|unsafe|extern|as|true|false|Some|None)\b/, "kw"],
    [/\b(?:0x[0-9a-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?(?:f32|f64|i32|i64|u32|u8|usize)?)\b/, "nu"],
    [/\b[A-Za-z_]\w*(?=\s*\()/, "fn"],
  ],
  asm: [
    [/#.*/, "cm"],
    [/^[\w.]+:/, "lb"],
    [/%\w+/, "rg"],
    [/\$[\w.-]+/, "nu"],
    [/^\s*[a-z][\w.]*/, "kw"],
    [/\b(?:0x[0-9a-fA-F]+|\d+)\b/, "nu"],
  ],
  sh: [
    [/^linux>/, "pr"],
    [/#.*/, "cm"],
    [/"(?:[^"\\]|\\.)*"/, "st"],
    [/\s-{1,2}[\w-]+/, "kw"],
  ],
};
const TOKEN_RE = {};
function highlight(line, lang) {
  const rules = TOKENS[lang] || [];
  if (!rules.length) return esc(line);
  const re = TOKEN_RE[lang] || (TOKEN_RE[lang] = new RegExp(rules.map(([r]) => `(${r.source})`).join("|"), "g"));
  re.lastIndex = 0;
  let out = "", last = 0, m;
  while ((m = re.exec(line))) {
    if (!m[0]) { re.lastIndex++; continue; }
    const gi = m.slice(1).findIndex((g) => g !== undefined);
    out += esc(line.slice(last, m.index)) + `<span class="t-${rules[gi][1]}">${esc(m[0])}</span>`;
    last = re.lastIndex;
  }
  return out + esc(line.slice(last));
}
/* Every code panel on this page shows Rust (or rustc's x86-64 output); the book's C is described in words.
   A file's rs.map, where present, turns an engine's line numbers into Rust lines. */
const CODE_LANG = (() => {
  const v = "rust"; // fixed: the pages teach Rust only
  const subs = [];
  return {
    get v() { return v; },
    get rust() { return v === "rust"; },
    on(fn) { subs.push(fn); },
    set() {}, // there is no other language to switch to
  };
})();
/* fileC(key, unused, Rust source, opts): the key is the name the engine uses; the tab shows opts.name.
   opts: { name, map, cmd } (map: engine line → Rust line or lines; cmd: how it was built and run). */
function fileC(name, csrc, rsrc, o) {
  const opt = typeof o === "string" ? { name: o } : (o || {});
  const rustName = opt.name || (/\.c$/.test(name) ? name.replace(/\.c$/, ".rs") : name + ".rs");
  return { name, lang: "c", src: csrc, rs: { name: rustName, src: rsrc, map: opt.map || "same", cmd: opt.cmd || "" } };
}
function code(sel, o) {
  const root = K.$(sel);
  root.className = "codepane";
  const tabs = h("div", { class: "cp-tabs" });
  const cmd = h("span", { class: "cp-cmd" });
  root.appendChild(h("div", { class: "cp-head" }, h("span", { class: "cp-k" }, o.label || "The code"), tabs, cmd));
  const body = h("div", { class: "cp-body", tabindex: "0", role: "region", "aria-label": (o.label || "The code") + " listing" });
  const ol = h("ol", {});
  body.appendChild(ol);
  const out = h("pre", { class: "cp-out", hidden: true, "aria-live": "polite" });
  root.append(body, out);
  const clone = (f) => { const c = Object.assign({}, f); if (f.rs) c.rs = Object.assign({}, f.rs); return c; };
  let files = o.files.map(clone);
  let cur = null, lis = [];
  let req = { marks: {}, notes: {}, out: null };
  function labelOf(f) { return CODE_LANG.rust && f.rs ? f.rs.name : f.name; }
  function noteFor(f) {
    if (f.rsNote) return f.rsNote;
    if (f.lang === "asm") return ASM_NOTE;
    if (f.lang === "sh") return "a shell command";
    return "";
  }
  function view() {
    if (cur.rs) return { lang: "rust", src: cur.rs.src, cmd: cur.rs.cmd || cur.cmd || "" };
    // no Rust twin: assembly or a shell command, labelled as such
    const note = noteFor(cur);
    const base = cur.cmd || "";
    return { lang: cur.lang, src: cur.src, cmd: base && note ? base + "  ·  " + note : base || note };
  }
  function tr(n) {
    if (!CODE_LANG.rust || !cur.rs || !cur.rs.map || cur.rs.map === "same") return n;
    const hit = cur.rs.map[n];
    return hit == null ? null : hit;
  }
  function drawTabs() {
    K.clear(tabs);
    if (files.length === 1 && !o.tabs) { tabs.appendChild(h("span", { class: "cp-file" }, labelOf(files[0]))); return; }
    files.forEach((f) => {
      const b = h("button", { type: "button", class: "cp-tab", "aria-pressed": String(f === cur) }, labelOf(f));
      b.addEventListener("click", () => show(f.name));
      tabs.appendChild(b);
    });
  }
  function paintMarks() {
    const HL = ["on", "on2", "good", "bad", "dim"];
    lis.forEach((li) => HL.forEach((c) => li.classList.remove(c)));
    Object.entries(req.marks).forEach(([cls, lines]) => {
      (lines || []).forEach((n) => {
        const hit = tr(n);
        if (hit == null) return;
        [].concat(hit).forEach((m) => lis[m - 1] && lis[m - 1].classList.add(cls));
      });
    });
  }
  function paintNotes() {
    lis.forEach((li) => { const n = li.querySelector(".cp-note"); if (n) n.remove(); });
    Object.entries(req.notes || {}).forEach(([k, v]) => {
      const hit = tr(Number(k));
      const li = hit == null ? null : lis[[].concat(hit)[0] - 1];
      if (!li || v == null || v === "") return;
      const pair = Array.isArray(v) ? v : [v];
      li.appendChild(h("span", { class: "cp-note" + (pair[1] ? " " + pair[1] : "") }, pair[0]));
    });
  }
  function paintOut() {
    out.hidden = req.out == null;
    out.textContent = req.out || "";
  }
  function render() {
    K.clear(ol);
    const shown = view();
    lis = shown.src.split("\n").map((line, i) => {
      const li = h("li", { "data-n": String(i + 1) });
      li.innerHTML = highlight(line, shown.lang) || " ";
      ol.appendChild(li);
      return li;
    });
    cmd.textContent = shown.cmd;
    paintMarks(); paintNotes(); paintOut();
  }
  function show(name) {
    const f = files.find((x) => x.name === name) || files[0];
    if (!f) { drawTabs(); return; }
    if (f !== cur) { cur = f; req.marks = {}; req.notes = {}; render(); body.scrollTop = 0; }
    drawTabs();
  }
  function scrollTo(li) {
    const top = li.offsetTop, bottom = top + li.offsetHeight;
    if (top < body.scrollTop + 6) body.scrollTop = Math.max(0, top - 24);
    else if (bottom > body.scrollTop + body.clientHeight - 6) body.scrollTop = bottom - body.clientHeight + 24;
  }
  const api = {
    show,
    setFiles(list) { files = list.map(clone); cur = null; req = { marks: {}, notes: {}, out: null }; if (files[0]) show(files[0].name); api.out(null); },
    src(name, text, extra) {
      const f = files.find((x) => x.name === name);
      if (!f) return;
      f.src = text;
      if (extra && extra.rs) {
        const kept = f.rs && f.rs.cmd;
        f.rs = Object.assign({ name: (f.rs && f.rs.name) || name.replace(/\.c$/, ".rs"), map: "same", cmd: kept || "" }, extra.rs);
      }
      if (extra) {
        const rest = Object.assign({}, extra);
        delete rest.rs;
        Object.assign(f, rest);
      }
      if (f === cur) render();
    },
    at(lines, cls = "on", scroll = true) {
      const list = lines == null ? [] : [].concat(lines);
      req.marks[cls] = list;
      paintMarks();
      if (!scroll) return;
      const first = list.map((n) => tr(n)).find((n) => n != null && lis[[].concat(n)[0] - 1]);
      const li = first == null ? null : lis[[].concat(first)[0] - 1];
      if (li) scrollTo(li);
    },
    notes(map) { req.notes = map || {}; paintNotes(); },
    calm() {
      ["on", "on2", "good", "bad", "dim"].forEach((c) => api.at(null, c, false));
      api.notes({});
    },
    out(textOrNull) { req.out = textOrNull == null ? null : textOrNull; paintOut(); },
  };
  CODE_LANG.on(() => { drawTabs(); if (cur) render(); });
  if (files[0]) show(files[0].name);
  return api;
}
function useStats(id, labels) {
  const row = K.$("#" + id);
  K.clear(row);
  const els = {};
  labels.forEach((k) => { els[k] = stat(k, "—"); row.appendChild(els[k]); });
  return els;
}

/* ================= HERO ================= */
/* Every listing, output and number below comes from a real run (see videos/csapp/claims/ch08.md).
   X86: compiled and run in the x86-64 Linux toolbox. LNX: process and signal runs on Linux (arm64). */
const X86 = "rustc 1.100.0 -C opt-level=1 · x86-64 Linux (emulated)";
const ASM_NOTE = "rustc 1.100.0 -C opt-level=1, x86-64 Linux · assembler directives dropped, comments ours";
const LNX = "rustc 1.100.0 -C opt-level=1 · run on Linux";
const TALLY_RS = join([
  "// Remember the last x, and add 2x + 1 to the count.",
  "// u64: an unsigned 64-bit integer. &mut u64: a borrowed u64 we may change.",
  "#[no_mangle] // keep the name tally in the object file",
  "#[inline(never)] // ask rustc not to inline it (a hint)",
  "pub fn tally(count: &mut u64, last: &mut u64, x: u64) { // pub: callable from outside",
  "    *last = x; // *last: the u64 that last points at",
  "    *count += 2 * x + 1;",
  "}",
]);
const TALLY_S = join([
  "tally:",
  "    movq  %rdx, (%rsi)          # *last = x",
  "    movq  (%rdi), %rax          # load *count",
  "    leaq  (%rax,%rdx,2), %rax   # add 2 * x",
  "    incq  %rax                  # add 1",
  "    movq  %rax, (%rdi)          # store *count",
  "    retq",
]);
/* objdump of tally: offsets and lengths of the first four instructions */
const TALLY_INS = [
  { a: "tally+0x0", t: "movq", n: "+3 bytes" },
  { a: "tally+0x3", t: "movq", n: "+3 bytes" },
  { a: "tally+0x6", t: "leaq", n: "+4 bytes" },
  { a: "tally+0xa", t: "incq", n: "+3 bytes" },
];
(function hero() {
  const svg = K.$("#hero-svg");
  txt(svg, 330, 28, "USER CODE · rustc's tally", { cls: "sv-label" });
  const boxes = TALLY_INS.map((ins, i) => box(svg, 36 + i * 150, 48, 120, 52, "sv-panel", ins.t, ins.a, 14));
  const kernel = box(svg, 210, 150, 240, 48, "sv-server", "kernel handler", "timer interrupt");
  const pc = s("circle", { r: 7, class: "sv-fill-sun" });
  svg.appendChild(pc);
  const cv = code("#hero-code", {
    label: "The code",
    tabs: true,
    files: [
      { name: "tally.s", lang: "asm", src: TALLY_S, rsNote: ASM_NOTE },
      fileC("tally.rs", "", TALLY_RS, { name: "tally.rs", cmd: X86 }),
    ],
  });
  let i = 0;
  function show(n) {
    i = n;
    boxes.forEach((b) => b.r.setAttribute("class", "sv-panel"));
    kernel.r.setAttribute("class", "sv-server");
    cv.show("tally.s");
    cv.calm();
    if (n < 4) {
      boxes[n].r.setAttribute("class", "sv-good");
      pc.setAttribute("cx", boxes[n].cx);
      pc.setAttribute("cy", boxes[n].cy);
      cv.at([n + 2]);
      pill("hero-pill", "smooth");
      cap("hero-cap", n === 0
        ? "The program counter holds <b>tally+0x0</b>, the first instruction rustc made for tally. The next one sits 3 bytes later."
        : `Smooth step ${n + 1}: ${TALLY_INS[n].a}. Nothing yanked the walk; the next address is this one plus the instruction’s length.`);
    } else {
      kernel.r.setAttribute("class", "sv-good");
      pc.setAttribute("cx", kernel.cx);
      pc.setAttribute("cy", kernel.cy);
      cv.at([6], "dim");
      cv.notes({ 6: ["runs after the handler", "warn"] });
      pill("hero-pill", "exception");
      cap("hero-cap", "A timer event yanks the walk into the <b>kernel</b>. That yank is an exception. The handler is kernel code, not in this listing; when it returns, tally carries on at the next instruction.");
    }
  }
  const ctr = K.$("#hero-controls");
  const btns = [];
  const S = session((b) => btns.forEach((x) => (x.disabled = b)));
  btns.push(button(ctr, "Step", "primary", () => show((i + 1) % 5)));
  btns.push(button(ctr, "Play", "", () => S.run(async (w) => {
    for (let n = 0; n < 5; n++) { show(n); await w(sleep(420)); }
  })));
  show(0);
  let played = false;
  whenVisible(svg, () => { if (!played) { played = true; S.run(async (w) => { await w(sleep(500)); for (let n = 0; n < 5; n++) { show(n); await w(sleep(480)); } }); } });
})();

/* ================= 8.1 ================= */
(function ecf() {
  const svg = K.$("#s81-svg");
  const PICK_RS = join([
    "#[no_mangle]",
    "#[inline(never)]",
    "pub fn note(x: u64) -> u64 { x ^ 0x55 } // -> u64: returns a u64. ^: bitwise xor",
    "",
    "// If x is 0, answer 7; otherwise ask note.",
    "#[no_mangle]",
    "#[inline(never)]",
    "pub fn pick(x: u64) -> u64 {",
    "    if x == 0 { return 7; }",
    "    note(x)",
    "}",
  ]);
  const PICK_S = join([
    "pick:",
    "    testq  %rdi, %rdi             # is x zero?",
    "    je     .LBB1_1                # yes: jump to pick+0xb",
    "    jmpq   *note@GOTPCREL(%rip)   # no: tail-call note(x)",
    ".LBB1_1:",
    "    movl   $7, %eax               # the answer is 7",
    "    retq",
  ]);
  const MODES = [
    { name: "Smooth", ins: TALLY_INS, src: TALLY_S, rs: TALLY_RS, file: "tally.s", rsFile: "tally.rs", lines: [2, 3, 4, 5],
      rule: "next = this address + this instruction’s length" },
    { name: "Jump", ins: [
        { a: "pick+0x0", t: "testq", n: "+3 bytes" },
        { a: "pick+0x3", t: "je", n: "x is 0: → +0xb" },
        { a: "pick+0xb", t: "movl", n: "+5 bytes" },
        { a: "pick+0x10", t: "retq", n: "done" },
      ], src: PICK_S, rs: PICK_RS, file: "pick.s", rsFile: "pick.rs", lines: [2, 3, 6, 7],
      rule: "the instruction itself names a new address" },
    { name: "Exception", ins: [
        TALLY_INS[0],
        { a: "tally+0x3", t: "movq", n: "event!" },
        { a: "kernel", t: "handler", n: "not in the program" },
        { a: "tally+0x6", t: "leaq", n: "after the handler" },
      ], src: TALLY_S, rs: TALLY_RS, file: "tally.s", rsFile: "tally.rs", lines: [2, 3, 3, 4],
      rule: "an event chooses an address the program did not write" },
  ];
  const layer = s("g");
  svg.appendChild(layer);
  const cv = code("#s81-code", { label: "The code", tabs: true, files: [{ name: "tally.s", lang: "asm", src: TALLY_S, rsNote: ASM_NOTE }] });
  const st = useStats("s81-stats", ["PC", "Rule"]);
  let mode = 0, step = 0;
  function paint() {
    const M = MODES[mode];
    K.clear(layer);
    M.ins.forEach((ins, i) => {
      box(layer, 28 + (i % 4) * 158, 36, 142, 64, i === step ? "sv-good" : "sv-panel", ins.t, ins.a, 14);
      txt(layer, 28 + (i % 4) * 158 + 71, 124, ins.n, { cls: "sv-label", size: 12 });
    });
    txt(layer, 330, 168, M.rule, { size: 14, bold: true });
    txt(layer, 330, 210, mode === 2 && step === 2 ? "The handler address comes from the exception table, not from this listing." : "Press Step. The highlighted box is where the program counter is.", { cls: "sv-label" });
    cv.show(M.file);
    const line = M.lines[step];
    cv.calm();
    cv.at([line], mode === 2 && step === 2 ? "bad" : "on");
    cv.notes({ [line]: mode === 2 && step === 2 ? ["interrupted here", "bad"] : M.ins[step].n });
    st.PC.set(M.ins[step].a, step === 2 && mode === 2 ? "bad" : "good");
    st.Rule.set(mode === 0 ? "smooth" : mode === 1 ? "program" : "event");
    cap("s81-cap", `<b>${M.name}.</b> PC is <span class="mono">${M.ins[step].a}</span>. ${M.rule[0].toUpperCase() + M.rule.slice(1)}.` +
      (mode === 1 && step === 1 ? " Here x is 0, so <b>je</b> is taken and the PC skips to pick+0xb." : "") +
      (mode === 2 && step === 3 ? " An interrupt handler returns to the next instruction, so tally goes on at +0x6." : ""));
  }
  function load(i) {
    mode = i; step = 0;
    const M = MODES[i];
    cv.setFiles([{ name: M.file, lang: "asm", src: M.src, rsNote: ASM_NOTE }, fileC(M.rsFile, "", M.rs, { name: M.rsFile, cmd: X86 })]);
    paint();
  }
  K.$("#s81-seg").appendChild(seg(MODES.map((m) => m.name), 0, load, "s81-mode"));
  const ctr = K.$("#s81-controls");
  button(ctr, "Step", "primary", () => { step = (step + 1) % 4; paint(); });
  button(ctr, "Reset", "", () => { step = 0; paint(); });
  load(0);
})();

/* ================= 8.1.1 ================= */
(function table() {
  const svg = K.$("#s811-svg");
  const ROWS = [
    { k: 0, name: "divide", ret: "abort", note: "Linux will not return" },
    { k: 13, name: "protection", ret: "abort", note: "bad address, no repair" },
    { k: 14, name: "page fault", ret: "Icurr", note: "map the page, retry" },
    { k: 32, name: "syscall", ret: "Inext", note: "trap, then the next instruction" },
  ];
  txt(svg, 90, 28, "EVENT", { cls: "sv-label" });
  txt(svg, 330, 28, "EXCEPTION TABLE", { cls: "sv-label" });
  txt(svg, 560, 28, "RETURN", { cls: "sv-label" });
  const icurr = box(svg, 24, 48, 140, 44, "sv-panel", "Icurr", "the instruction");
  const inext = box(svg, 24, 104, 140, 44, "sv-panel", "Inext", "the one after");
  const rows = ROWS.map((r, i) => box(svg, 230, 48 + i * 52, 200, 42, "sv-box", `#${r.k}  ${r.name}`, null, 13));
  const back = box(svg, 490, 78, 140, 64, "sv-server", "handler", "—");
  const cv = code("#s811-code", {
    label: "The code",
    files: [fileC("dispatch.rs", "", join([
      "// static: one value for the whole program. [fn(); 256]: 256 function pointers.",
      "static EXCEPTION_TABLE: [fn(); 256] = [nop; 256]; // [nop; 256]: 256 copies of nop",
      "",
      "fn on_event(k: usize) { // the hardware does this part",
      "    let h = EXCEPTION_TABLE[k]; // let: name a value. usize: an index",
      "    switch_to_kernel_mode();",
      "    h(); // the handler",
      "    // return to Icurr, Inext, or not at all",
      "}",
      "fn nop() {}",
      "fn switch_to_kernel_mode() {}",
    ]), { name: "dispatch.rs (sketch)", map: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9 } })],
  });
  let sel = 2, phase = 0;
  function paint() {
    const r = ROWS[sel];
    rows.forEach((b, i) => b.r.setAttribute("class", i === sel ? "sv-good" : "sv-box"));
    icurr.r.setAttribute("class", phase && r.ret === "Icurr" ? "sv-good" : "sv-panel");
    inext.r.setAttribute("class", phase && r.ret === "Inext" ? "sv-good" : "sv-panel");
    back.u.textContent = phase ? r.ret : "waiting";
    back.r.setAttribute("class", phase ? (r.ret === "abort" ? "sv-bad" : "sv-server") : "sv-server");
    pill("s811-pill", phase ? `k = ${r.k} → ${r.ret}` : `k = ${r.k}`);
    cv.calm();
    cv.at(phase ? [4, 5, 6] : [4]);
    cv.notes({
      4: `k = ${r.k}`,
      6: phase ? [r.ret === "abort" ? "does not return" : `return ${r.ret}`, r.ret === "abort" ? "bad" : "good"] : "handler not run yet",
    });
    cap("s811-cap", phase
      ? `Exception <b>${r.k}</b> (${r.name}) selected a handler. ${r.note}. The return choice here is <b>${r.ret}</b>.`
      : `Pick a number, then <b>Dispatch</b>. Entry ${r.k} is the handler for ${r.name}.`);
  }
  const ctr = K.$("#s811-controls");
  ROWS.forEach((r, i) => button(ctr, String(r.k), i === 2 ? "primary" : "", () => { sel = i; phase = 0; paint(); }));
  button(ctr, "Dispatch", "primary", () => { phase = 1; paint(); });
  button(ctr, "Reset", "", () => { phase = 0; paint(); });
  paint();
})();

/* ================= 8.1.2 ================= */
(function classes() {
  const svg = K.$("#s812-svg");
  const CLS = [
    { name: "Interrupt", cause: "I/O pin", sync: "async", ret: "Inext", lines: [3, 4] },
    { name: "Trap", cause: "syscall", sync: "sync", ret: "Inext", lines: [6, 7] },
    { name: "Fault", cause: "maybe fixable", sync: "sync", ret: "Icurr", lines: [9, 10] },
    { name: "Abort", cause: "fatal hardware", sync: "sync", ret: "nowhere", lines: [12, 13] },
  ];
  const cards = CLS.map((c, i) => box(svg, 24 + i * 160, 36, 148, 150, "sv-panel", c.name, null, 15));
  cards.forEach((b, i) => {
    b.t.setAttribute("y", b.y + 28);
    txt(svg, b.cx, b.y + 58, CLS[i].cause, { cls: "sv-label" });
    txt(svg, b.cx, b.y + 80, CLS[i].sync, { cls: "sv-label" });
    txt(svg, b.cx, b.y + 112, "returns to", { cls: "sv-label" });
    b.ret = txt(svg, b.cx, b.y + 134, CLS[i].ret, { bold: true, size: 16 });
  });
  const cv = code("#s812-code", {
    label: "The code",
    files: [fileC("classes.c", "", join([
        "// where does the handler return? enum: a type with fixed choices",
        "enum Resume { Next, Curr, Nowhere }",
        "// interrupt: timer, disk, network",
        "let mut resume = Resume::Next; // mut: this value may change",
        "",
        "// trap: the program asked, via syscall",
        "resume = Resume::Next;",
        "",
        "// fault: page not in memory, maybe (if/else yields a value)",
        "resume = if handler_fixed_it { Resume::Curr } else { abort_process() };",
        "",
        "// abort: machine check",
        "resume = Resume::Nowhere;",
      ]), { name: "classes.rs (sketch)" })],
  });
  let cur = -1;
  function paint(i) {
    cur = i;
    cards.forEach((b, k) => {
      const on = k === i;
      b.r.setAttribute("class", on ? (CLS[k].ret === "nowhere" ? "sv-bad" : "sv-good") : "sv-panel");
    });
    cv.calm();
    if (i < 0) {
      pill("s812-pill", "pick one");
      cap("s812-cap", "Four classes. The thing a program can observe is <b>where control comes back</b>.");
      return;
    }
    const c = CLS[i];
    pill("s812-pill", c.ret);
    cv.at(c.lines, c.ret === "nowhere" ? "bad" : "good");
    cv.notes({ [c.lines[1]]: [c.ret, c.ret === "nowhere" ? "bad" : "good"] });
    cap("s812-cap", `<b>${c.name}.</b> Cause: ${c.cause} (${c.sync}). The handler’s return rule is <b>${c.ret}</b>.`);
  }
  const ctr = K.$("#s812-controls");
  CLS.forEach((c, i) => button(ctr, c.name, "", () => paint(i)));
  paint(-1);
})();

/* ================= 8.1.3 ================= */
(function linux() {
  const svg = K.$("#s813-svg");
  const cpu = box(svg, 24, 40, 200, 180, "sv-panel", "x86-64", null, 16);
  cpu.t.setAttribute("y", 64);
  const regs = ["%rax", "%rdi", "%rsi", "%rdx"].map((name, i) => {
    const b = box(svg, 44, 84 + i * 30, 160, 26, "sv-box", name, null, 12);
    b.t.setAttribute("x", 56);
    b.t.setAttribute("text-anchor", "start");
    b.v = txt(svg, 190, b.cy + 4, "—", { mono: true, size: 12, anchor: "end", bold: true });
    return b;
  });
  const shell = box(svg, 260, 40, 370, 70, "sv-db", "what the run reported", "waiting", 14);
  shell.t.setAttribute("y", 66);
  const table = txt(svg, 445, 140, "", { mono: true, size: 13, bold: true });
  txt(svg, 445, 168, "exception number → class → what Linux does", { cls: "sv-label" });
  /* outputs: the x86-64 toolbox runs of fault.rs and hello.rs */
  const CASES = {
    div: { n: "0", cls: "Fault", linux: "fatal: SIGFPE (the book’s C)", regs: ["—", "—", "—", "—"], file: "fault.rs", lines: [5], note: ["Rust panics first", "bad"], shell: "panic · exit status: 101", out: "thread 'main' (137) panicked at fault.rs:5:5:\nattempt to divide by zero\nnote: run with `RUST_BACKTRACE=1` environment variable to display a backtrace\ndiv -> exit status: 101  code=Some(101)", rust: " That is the book’s C. Rust checks every integer divisor first and <b>panics</b> (stops the program with a message), so the processor never divides by zero and exception 0 never happens.", tone: "bad" },
    gpf: { n: "13", cls: "Fault", linux: "fatal: SIGSEGV", regs: ["—", "—", "—", "—"], file: "fault.rs", lines: [9], note: ["exception 13", "bad"], shell: "signal: 11 (SIGSEGV)", out: "gpf -> signal: 11 (SIGSEGV)  code=None", rust: " The address is not a real one (not even in the canonical form x86-64 requires), so on x86-64 the read is a general protection fault. Rust allowed it only inside <span class=\"mono\">unsafe</span>, where the programmer vouches for the pointer; here we broke that promise on purpose, which Rust calls undefined behaviour. The ExitStatus has no exit code (code=None) because a signal ended the process.", tone: "bad" },
    pf: { n: "14", cls: "Fault", linux: "map the page, retry Icurr", regs: ["—", "—", "—", "—"], file: "fault.rs", lines: [13, 14], note: ["16,390 faults, all repaired", "good"], shell: "16,384 pages, 16,390 faults", out: "touched 16384 pages, 16390 page faults", rust: " Our run touched 16,384 fresh pages and counted 16,390 page faults. Each was repaired and the write retried, so the program never noticed.", tone: "good" },
    mc: { n: "18", cls: "Abort", linux: "machine check, no return", regs: ["—", "—", "—", "—"], file: "fault.rs", lines: [], note: null, shell: "no program can cause this", out: "(no Rust line: the hardware reports its own failure)", rust: " No instruction in a program causes it, so there is no line to point at.", tone: "bad" },
    write: { n: "syscall 1", cls: "Trap", linux: "write, then Inext", regs: ["1", "1", "&msg", "13"], file: "hello.s", lines: [3, 4, 5, 6, 7], note: ["%rax = 1", "good"], shell: "hello, world", out: "hello, world", rust: " Our hello.rs puts the numbers in place with <span class=\"mono\">asm!</span>; the listing is what rustc emitted. rustc chose the order and used 32-bit moves: writing %eax also clears the top half of %rax.", tone: "good" },
  };
  const FAULT_RS = join([
    "use std::process::Command; // use: bring a name into scope (main, not shown, runs each case)",
    "",
    "fn divide() -> i32 { // -> i32: returns a 32-bit integer",
    "    let x = 1;",
    "    x / std::hint::black_box(0) // a hidden 0: Rust checks, then panics",
    "}",
    "fn protect() -> i32 {",
    "    let p = 0x8000_0000_0000_0000_usize as *const i32; // as: the number as a raw pointer, to no real memory",
    "    unsafe { p.read_volatile() } // undefined behaviour, on purpose: exception 13 on x86-64, then SIGSEGV",
    "}",
    "fn page() -> u64 {",
    "    let before = minflt(); // page faults so far (from /proc)",
    "    let mut v = vec![0u8; 64 << 20]; // vec!: a heap array, 64 MiB of zeros; the kernel maps it lazily",
    "    for i in (0..v.len()).step_by(4096) { v[i] = 1; } // every 4096th index: one byte per page",
    "    minflt() - before",
    "}",
  ]);
  const HELLO_RS = join([
    "use std::arch::asm; // asm!: write machine instructions inside Rust",
    "",
    "fn main() {",
    "    let msg = b\"hello, world\\n\"; // b\"...\": the bytes of the text",
    "    let n: isize; // the syscall's answer lands here",
    "    unsafe {",
    "        asm!(\"syscall\",",
    "            inlateout(\"rax\") 1isize => n, // write is system call 1",
    "            in(\"rdi\") 1,                  // Arg1: stdout is descriptor 1",
    "            in(\"rsi\") msg.as_ptr(),       // Arg2: where the bytes are",
    "            in(\"rdx\") msg.len(),          // Arg3: how many: 13",
    "            lateout(\"rcx\") _, lateout(\"r11\") _); // syscall overwrites these",
    "        asm!(\"syscall\",",
    "            in(\"rax\") 60,                 // _exit is system call 60",
    "            in(\"rdi\") n - 13,             // Arg1: exit status 0 if all 13 went",
    "            options(noreturn));",
    "    }",
    "}",
  ]);
  const HELLO_S = join([
    "hello::main:   # objdump -d of hello (v0-mangled name shortened)",
    "    push   %rax",
    "    lea    -0xf9d8(%rip),%rsi   # Arg2: the bytes of \"hello, world\\n\"",
    "    mov    $0x1,%eax            # write is system call 1",
    "    mov    $0xd,%edx            # Arg3: 13 bytes",
    "    mov    $0x1,%edi            # Arg1: stdout is descriptor 1",
    "    syscall                     # make the system call",
    "    lea    -0xd(%rax),%rdi      # Arg1: n - 13",
    "    mov    $0x3c,%eax           # _exit is system call 60",
    "    syscall                     # make the system call",
    "    ud2                         # never reached",
  ]);
  const cv = code("#s813-code", {
    label: "The code",
    tabs: true,
    files: [
      fileC("fault.rs", "", FAULT_RS, { name: "fault.rs", cmd: X86 + " · excerpt" }),
      fileC("hello.rs", "", HELLO_RS, { name: "hello.rs", cmd: X86 }),
      { name: "hello.s", lang: "asm", src: HELLO_S, rsNote: "objdump -d of hello · rustc 1.100.0 -C opt-level=1, x86-64 Linux · comments ours" },
    ],
  });
  const st = useStats("s813-stats", ["number", "class", "%rax after"]);
  function run(key) {
    const c = CASES[key];
    regs.forEach((r, i) => { r.v.textContent = c.regs[i]; r.r.setAttribute("class", c.regs[i] === "—" ? "sv-box" : "sv-data-soft"); });
    shell.u.textContent = c.shell;
    shell.r.setAttribute("class", c.tone === "bad" ? "sv-bad" : "sv-good");
    table.textContent = `${c.n} · ${c.cls}`;
    pill("s813-pill", c.n);
    st.number.set(c.n);
    st.class.set(c.cls, c.tone === "bad" ? "bad" : "good");
    st["%rax after"].set(key === "write" ? "13 (bytes)" : "—");
    cv.show(c.file);
    cv.calm();
    if (c.lines.length) cv.at(c.lines, c.tone === "bad" ? "bad" : "good");
    if (c.note) cv.notes({ [c.lines[0]]: c.note });
    cv.out(c.out);
    cap("s813-cap", `<b>Exception ${c.n}</b> is a ${c.cls}. Linux: ${c.linux}.` + (c.rust || "") + (key === "write" ? " A return in %rax from −4095 to −1 would be −errno." : ""));
  }
  const ctr = K.$("#s813-controls");
  button(ctr, "Divide by 0", "", () => run("div"));
  button(ctr, "Bad address", "", () => run("gpf"));
  button(ctr, "Page fault", "primary", () => run("pf"));
  button(ctr, "Machine check", "", () => run("mc"));
  button(ctr, "syscall write", "", () => run("write"));
  cap("s813-cap", "Numbers 0–31 are the processor’s. 32–255 belong to the operating system. Press an example; each one is a real run of the code below.");
})();

/* ================= 8.2 ================= */
(function proc() {
  const svg = K.$("#s82-svg");
  const names = ["A", "B", "C"];
  txt(svg, 330, 24, "WHAT EACH PROGRAM BELIEVES", { cls: "sv-label" });
  const cards = names.map((name, i) => box(svg, 36 + i * 210, 40, 180, 90, "sv-panel", `process ${name}`, "I own the CPU", 15));
  const cpu = box(svg, 210, 170, 240, 52, "sv-server", "the one CPU", "idle");
  const cv = code("#s82-code", {
    label: "The code",
    tabs: true,
    files: names.map((name) => fileC(name + ".c", "",
      join([`// process ${name} — believes it is alone`, "fn main() {", "    loop { work(); } // loop: repeat forever. My logical flow", "}", "fn work() {}"]), { name: name + ".rs (sketch)" })),
  });
  let turn = -1, counts = [0, 0, 0];
  function paint() {
    cards.forEach((b, i) => {
      const on = i === turn;
      b.r.setAttribute("class", on ? "sv-good" : "sv-panel");
      b.u.textContent = `I have run ${counts[i]} instruction${counts[i] === 1 ? "" : "s"}`;
    });
    cpu.u.textContent = turn < 0 ? "idle" : `running ${names[turn]}`;
    cpu.r.setAttribute("class", turn < 0 ? "sv-server" : "sv-good");
    if (turn >= 0) {
      cv.show(names[turn] + ".c");
      cv.calm();
      cv.at([3], "on");
      cv.notes({ 3: [`slice ${counts[turn]}`, "good"] });
      pill("s82-pill", names[turn]);
      cap("s82-cap", `The CPU is inside <b>${names[turn]}</b>. ${names[turn]}’s private counter moved. The others still believe they own the machine — their counters did not change, and they cannot see this slice.`);
    }
  }
  const ctr = K.$("#s82-controls");
  button(ctr, "Run a slice", "primary", () => {
    turn = (turn + 1) % 3;
    counts[turn]++;
    paint();
  });
  button(ctr, "Reset", "", () => { turn = -1; counts = [0, 0, 0]; cards.forEach((b) => { b.r.setAttribute("class", "sv-panel"); b.u.textContent = "I own the CPU"; }); cpu.u.textContent = "idle"; cpu.r.setAttribute("class", "sv-server"); cv.calm(); cv.out(null); pill("s82-pill", "idle"); cap("s82-cap", "Three instances of a program. One processor. Press <b>Run a slice</b>."); });
  cap("s82-cap", "A process is an instance of a program in execution. Press <b>Run a slice</b> to share one CPU.");
})();

/* ================= 8.2.1 ================= */
(function flow() {
  const svg = K.$("#s821-svg");
  /* Figure 8.12 shape: A, B to completion, a bit of C, A finishes, C finishes. */
  const SLICES = [
    { who: 0, line: 1, say: "A starts" },
    { who: 1, line: 1, say: "B runs" },
    { who: 1, line: 2, say: "B finishes" },
    { who: 2, line: 1, say: "C starts" },
    { who: 0, line: 2, say: "A resumes, then finishes" },
    { who: 2, line: 2, say: "C finishes" },
  ];
  const labels = ["A", "B", "C"];
  const rows = labels.map((name, i) => {
    txt(svg, 28, 58 + i * 48, name, { anchor: "start", bold: true });
    return { y: 40 + i * 48 };
  });
  txt(svg, 330, 200, "physical time →    gaps are other processes, invisible inside a logical flow", { cls: "sv-label" });
  const layer = s("g");
  svg.appendChild(layer);
  const files = [
    fileC("A.c", "", join(["println!(\"A1\"); // println!: print a line (! marks a macro)", "println!(\"A2\"); // A's whole logical flow"])),
    fileC("B.c", "", join(["println!(\"B1\");", "println!(\"B2\"); // B runs to completion"])),
    fileC("C.c", "", join(["println!(\"C1\");", "println!(\"C2\");"])),
  ];
  const cv = code("#s821-code", { label: "The code", tabs: true, files });
  let n = -1;
  function paint() {
    K.clear(layer);
    SLICES.forEach((sl, i) => {
      const x = 70 + i * 90;
      const b = box(layer, x, rows[sl.who].y, 78, 32, i <= n ? (i === n ? "sv-good" : "sv-data-soft") : "sv-panel", labels[sl.who], null, 13);
      if (i > n) b.r.style.opacity = 0.35;
    });
    if (n < 0) {
      cv.calm();
      pill("s821-pill", "t = 0");
      cap("s821-cap", "Figure 8.12’s schedule is drawn, dimmed. Press <b>Step</b>. Only the running process’s file advances.");
      return;
    }
    const sl = SLICES[n];
    cv.show(labels[sl.who] + ".c");
    cv.calm();
    cv.at([sl.line]);
    cv.notes({ [sl.line]: [`physical step ${n + 1}`, "warn"] });
    pill("s821-pill", `t = ${n + 1}`);
    const seen = labels.map((name, i) => {
      const last = SLICES.slice(0, n + 1).filter((s2) => s2.who === i).pop();
      return `${name}:${last ? "line " + last.line : "not started"}`;
    }).join("  ");
    cap("s821-cap", `<b>${sl.say}.</b> Logical progress so far — ${seen}. ${labels[sl.who]} does not execute anyone else’s instructions in the gaps.`);
  }
  const ctr = K.$("#s821-controls");
  button(ctr, "Step", "primary", () => { if (n < SLICES.length - 1) n++; paint(); });
  button(ctr, "Reset", "", () => { n = -1; paint(); });
  paint();
})();

/* ================= 8.2.2 ================= */
(function concur() {
  const svg = K.$("#s822-svg");
  const layer = s("g");
  svg.appendChild(layer);
  let cores = 1;
  let span = { A: [1, 3], B: [2, 5], C: [4, 6] };
  const cv = code("#s822-code", {
    label: "The code",
    files: [fileC("overlap.c", "", "", { name: "overlap.rs", cmd: X86 + " · excerpt: main left out" })],
  });
  const st = useStats("s822-stats", ["A∩B", "A∩C", "B∩C"]);
  function overlaps(p, q) { return p[0] < q[1] && q[0] < p[1]; }
  function paint() {
    K.clear(layer);
    const T = 8, X0 = 70, W = 540;
    const x = (t) => X0 + (t / T) * W;
    layer.appendChild(s("line", { x1: X0, y1: 36, x2: X0 + W, y2: 36, class: "sv-wire-solid" }));
    for (let t = 0; t <= T; t++) txt(layer, x(t), 28, String(t), { cls: "sv-label", size: 11 });
    const rows = [["A", span.A], ["B", span.B], ["C", span.C]];
    rows.forEach(([name, iv], i) => {
      const y = 58 + i * 36;
      txt(layer, 36, y + 16, name, { anchor: "start", bold: true });
      layer.appendChild(s("rect", { x: x(iv[0]), y, width: Math.max(4, x(iv[1]) - x(iv[0])), height: 24, rx: 6, class: "sv-data-soft" }));
    });
    const ab = overlaps(span.A, span.B), ac = overlaps(span.A, span.C), bc = overlaps(span.B, span.C);
    const word = (on) => cores > 1 && on ? "parallel" : on ? "concurrent" : "no";
    st["A∩B"].set(word(ab), ab ? "good" : "");
    st["A∩C"].set(word(ac), ac ? "good" : "");
    st["B∩C"].set(word(bc), bc ? "good" : "");
    const rsrc = join([
      "fn overlaps(s1: i32, e1: i32, s2: i32, e2: i32) -> bool {",
      "    s1 < e2 && s2 < e1 // no semicolon: this is the result",
      "}",
      "fn is_parallel(overlap: bool, cores: i32) -> bool {",
      "    overlap && cores > 1",
      "}",
      `// A[${span.A[0]},${span.A[1]}) B[${span.B[0]},${span.B[1]}) C[${span.C[0]},${span.C[1]})`,
    ]);
    cv.src("overlap.c", "", { rs: { src: rsrc } });
    cv.calm();
    cv.out(span.A.join() === "1,3" && span.B.join() === "2,5" && span.C.join() === "4,6" ? "Practice 8.1 run (x86-64, emulated): AB true AC false BC true" : null);
    cv.at([2, 5]);
    cv.notes({
      2: `AB ${ab ? "yes" : "no"}, AC ${ac ? "yes" : "no"}, BC ${bc ? "yes" : "no"}`,
      5: [cores > 1 ? "two cores" : "one core: concurrent, not parallel", cores > 1 ? "good" : "warn"],
    });
    cap("s822-cap", cores === 1
      ? "On <b>one core</b> a pair that overlaps in time is concurrent, and still not parallel. Touching endpoints do not overlap: one has finished as the other starts."
      : "On <b>two cores</b>, a pair that overlaps can run at the same time. That overlap is parallel. A pair with no overlap is neither.");
  }
  function syncSlider(key, which, value) {
    const el = K.$("#s822-" + key + (which === 0 ? "s" : "e"));
    if (!el) return;
    el.value = String(value);
    const out = el.parentNode && el.parentNode.querySelector("output");
    if (out) out.textContent = String(value);
  }
  function setSpan(key, which, v) {
    const next = span[key].slice();
    next[which] = v;
    if (next[0] >= next[1]) {
      if (which === 0) next[1] = Math.min(8, next[0] + 1);
      else next[0] = Math.max(0, next[1] - 1);
      syncSlider(key, which === 0 ? 1 : 0, which === 0 ? next[1] : next[0]);
    }
    span = Object.assign({}, span, { [key]: next });
    paint();
  }
  K.$("#s822-seg").appendChild(seg(["1 core", "2 cores"], 0, (i) => { cores = i + 1; paint(); }, "s822-cores"));
  const ctr = K.$("#s822-controls");
  ["A", "B", "C"].forEach((key) => {
    ctr.appendChild(slider({ id: "s822-" + key + "s", label: key + " start", min: 0, max: 7, value: span[key][0], onInput: (v) => setSpan(key, 0, v) }));
    ctr.appendChild(slider({ id: "s822-" + key + "e", label: key + " end", min: 1, max: 8, value: span[key][1], onInput: (v) => setSpan(key, 1, v) }));
  });
  button(ctr, "Practice 8.1", "primary small", () => {
    span = { A: [1, 3], B: [2, 5], C: [4, 6] };
    ["A", "B", "C"].forEach((key) => { syncSlider(key, 0, span[key][0]); syncSlider(key, 1, span[key][1]); });
    paint();
  });
  paint();
})();

/* ================= 8.2.3 ================= */
(function space() {
  const svg = K.$("#s823-svg");
  const stage = s("g");
  svg.appendChild(stage);
  /* addresses: maps.rs in the emulated x86-64 toolbox (code, data, heap and libs were the same every run there; only the stack moved a little) */
  const ADDR = { code: "0x5555555691d0", data: "0x5555555a8f60", heap: "0x5555555aac60", libs: "0x7fffff6a56a0", stack: "0x7ffffffc79ac", kernel: "the top" };
  const REG = [
    { k: "kernel", d: "Invisible to user code. A direct touch is a protection fault. No Rust name reaches it." },
    { k: "stack", d: "Grows down. <span class=\"mono\">local</span> lives here, at 0x7ffffffc79ac in our run." },
    { k: "libs", d: "Shared libraries. The C library’s <span class=\"mono\">write</span> was at 0x7fffff6a56a0." },
    { k: "heap", d: "Grows up when the program asks for heap memory, as <span class=\"mono\">vec!</span> does here: 0x5555555aac60." },
    { k: "data", d: "Globals, loaded from the executable. <span class=\"mono\">GLOBAL</span> was at 0x5555555a8f60." },
    { k: "code", d: "Read-only code. rustc builds a position-independent executable, so the loader chose where it goes: <span class=\"mono\">main</span> was at 0x5555555691d0, not the book’s 0x400000." },
  ];
  const MAP_RS = join([
    "static mut GLOBAL: i32 = 1; // data. static mut: a changeable global (unsafe to touch)",
    "",
    "fn main() { // code",
    "    let local = 2; // stack",
    "    let heap = vec![0u8; 100]; // heap: vec! makes a Vec, a growable array",
    "    let lib = write as *const u8; // write lives in the C library",
    "    println!(\"code  {:p}\", main as *const u8); // as: treat main as a pointer. {:p}: print an address",
    "    println!(\"data  {:p}\", &raw const GLOBAL); // &raw const: a raw pointer",
    "    println!(\"heap  {:p}\", heap.as_ptr());",
    "    println!(\"libs  {:p}\", lib);",
    "    println!(\"stack {:p}\", &local);",
    "    drop(heap); // give the heap block back now",
    "    // kernel memory: no Rust name reaches it",
    "    if std::env::args().nth(1).as_deref() == Some(\"two\") { // the first argument, if any",
    "        let pid = unsafe { fork() };",
    "        if pid == 0 { unsafe { GLOBAL = 2 }; } // only the child's copy",
    "        else { unsafe { waitpid(pid, std::ptr::null_mut(), 0) }; } // null: no status wanted",
    "        let who = if pid == 0 { \"child \" } else { \"parent\" };",
    "        println!(\"{who}: GLOBAL at {:p} holds {}\", &raw const GLOBAL, unsafe { GLOBAL });",
    "    }",
    "}",
  ]);
  const LINE = { data: 1, code: 3, stack: 4, heap: 5, libs: 6, kernel: 13 };
  const OUT = "code  0x5555555691d0\ndata  0x5555555a8f60\nheap  0x5555555aac60\nlibs  0x7fffff6a56a0\nstack 0x7ffffffc79ac";
  const cv = code("#s823-code", { label: "The code", files: [fileC("maps.rs", "", MAP_RS, { name: "maps.rs", cmd: X86 })] });
  function mapMode() {
    K.clear(stage);
    txt(stage, 200, 22, "ONE PROCESS · VIRTUAL ADDRESSES", { cls: "sv-label" });
    const order = ["kernel", "stack", "libs", "heap", "data", "code"];
    const bands = {};
    order.forEach((key, i) => {
      const b = box(stage, 70, 36 + i * 40, 260, 34, "sv-panel", key, ADDR[key], 13);
      bands[key] = b;
      const g = s("g");
      stage.appendChild(g);
      g.appendChild(b.r);
      if (b.t) g.appendChild(b.t);
      if (b.u) g.appendChild(b.u);
      clickable(g, key, () => select(key));
    });
    txt(stage, 480, 80, "Tap a region.", { cls: "sv-label" });
    txt(stage, 480, 110, "Same layout for every process.", { size: 13 });
    function select(key) {
      order.forEach((k) => bands[k].r.setAttribute("class", "sv-panel"));
      bands[key].r.setAttribute("class", key === "kernel" ? "sv-bad" : "sv-good");
      const meta = REG.find((r) => r.k === key);
      cv.calm();
      cv.at([LINE[key]], key === "kernel" ? "bad" : "on");
      cv.notes({ [LINE[key]]: key === "kernel" ? ["no user access", "bad"] : ADDR[key] });
      cap("s823-cap", `<b>${key}.</b> ${meta.d}`);
    }
    cv.calm();
    cv.out(OUT);
    cap("s823-cap", "This is the private map every process sees, with the addresses our x86-64 run printed. Tap a band. The matching line is what lives there.");
  }
  function twoMode() {
    K.clear(stage);
    txt(stage, 330, 24, "VIRTUAL ADDRESS 0xaaaaad470008 · LINUX RUN", { cls: "sv-label" });
    const a = box(stage, 40, 50, 250, 120, "sv-panel", "parent", "GLOBAL holds 1", 15);
    const b = box(stage, 370, 50, 250, 120, "sv-good", "child", "GLOBAL holds 2", 15);
    a.t.setAttribute("y", 78);
    b.t.setAttribute("y", 78);
    txt(stage, 330, 210, "One address. Two values. Each process’s addresses are translated on their own.", { cls: "sv-label" });
    cv.calm();
    cv.at([15, 16], "on2");
    cv.at([19], "good", false);
    cv.notes({ 16: ["child writes 2", "warn"], 19: ["same address, 2 and 1", "good"] });
    cv.out("child : GLOBAL at 0xaaaaad470008 holds 2\nparent: GLOBAL at 0xaaaaad470008 holds 1");
    cap("s823-cap", "After fork, the child set <b>GLOBAL</b> to 2. Both processes then printed the same address, 0xaaaaad470008, and saw 2 and 1. One virtual address names a different byte in each process. That privacy is the address-space illusion.");
  }
  K.$("#s823-seg").appendChild(seg(["The map", "Same address"], 0, (i) => { (i ? twoMode : mapMode)(); }, "s823-mode"));
  mapMode();
})();

/* ================= 8.2.4 ================= */
(function modebit() {
  const svg = K.$("#s824-svg");
  const user = box(svg, 36, 50, 250, 140, "sv-good", "user mode", "your program", 16);
  const kern = box(svg, 374, 50, 250, 140, "sv-server", "kernel mode", "handlers live here", 16);
  user.t.setAttribute("y", 100);
  kern.t.setAttribute("y", 100);
  const bit = txt(svg, 330, 36, "mode bit = user", { bold: true, size: 14 });
  const MODE_RS = join([
    "fn main() {",
    "    match std::env::args().nth(1).as_deref() { // match: pick the branch for the first argument",
    "        Some(\"add\") => { // Some(x): there is a value, x",
    "            let x = std::hint::black_box(1) + 2; // ordinary, stays in user mode",
    "            println!(\"x = {x}\");",
    "        }",
    "        Some(\"hlt\") => unsafe { std::arch::asm!(\"hlt\") }, // privileged",
    "        Some(\"peek\") => {",
    "            let kernel = 0xffff_ffff_8100_0000_usize as *const u8; // kernel half",
    "            unsafe { kernel.read_volatile() }; // user mode may not touch it",
    "        }",
    "        _ => { // _: anything else",
    "            let text = std::fs::read_to_string(\"/proc/cpuinfo\").unwrap(); // system calls; unwrap: the value, or panic",
    "            println!(\"{}\", text.lines().find(|l| l.starts_with(\"model name\")).unwrap()); // |l| ...: a closure",
    "        }",
    "    }",
    "}",
  ]);
  const cv = code("#s824-code", { label: "The code", files: [fileC("mode.rs", "", MODE_RS, { name: "mode.rs", cmd: X86 })] });
  /* outputs: ./mode add|hlt|peek|cpuinfo in the x86-64 toolbox (an emulator on Apple hardware, hence its CPU name) */
  const OPS = [
    { label: "add", line: 4, ok: true, out: "x = 3", say: "An ordinary add never leaves user mode. The mode bit stays clear, and the run printed x = 3." },
    { label: "halt", line: 7, ok: false, out: "Segmentation fault   (exit 139)", say: "hlt is privileged. In user mode it faults; the handler runs in kernel mode and Linux kills the process with SIGSEGV. The shell reported Segmentation fault." },
    { label: "peek kernel", line: 10, ok: false, out: "Segmentation fault   (exit 139)", say: "That address is in the kernel’s half. User mode cannot touch it, so the read faults and the process gets SIGSEGV. Rust allowed the raw read only inside unsafe." },
    { label: "read /proc", line: 13, ok: true, out: "model name\t: VirtualApple @ 2.50GHz", say: "Reading /proc/cpuinfo is a system call: the legal door into kernel mode. It came back with text. Our x86-64 toolbox is emulated, so the CPU it names is the emulator’s." },
  ];
  function run(op) {
    const sys = op.line === 13;
    bit.textContent = sys ? "mode bit = kernel, then user" : "mode bit = user";
    user.r.setAttribute("class", op.ok ? "sv-good" : "sv-panel");
    kern.r.setAttribute("class", !op.ok ? "sv-bad" : sys ? "sv-good" : "sv-server");
    pill("s824-pill", op.ok ? (sys ? "syscall" : "user") : "fault");
    cv.calm();
    cv.at([op.line], op.ok ? "good" : "bad");
    cv.notes({ [op.line]: [op.ok ? "allowed" : "protection fault", op.ok ? "good" : "bad"] });
    cv.out(op.out);
    cap("s824-cap", op.say);
  }
  const ctr = K.$("#s824-controls");
  OPS.forEach((op, i) => button(ctr, op.label, i === 3 ? "primary" : "", () => run(op)));
  cap("s824-cap", "The mode bit is part of the process context. The only path from user mode into kernel mode is an exception.");
})();

/* ================= 8.2.5 ================= */
(function ctx() {
  const svg = K.$("#s825-svg");
  const a = box(svg, 24, 36, 180, 70, "sv-panel", "process A", "read()", 14);
  const k = box(svg, 240, 36, 180, 70, "sv-server", "kernel", "scheduler", 14);
  const b = box(svg, 456, 36, 180, 70, "sv-panel", "process B", "ready", 14);
  const disk = box(svg, 240, 140, 180, 52, "sv-db", "disk", "idle", 14);
  const shelf = txt(svg, 330, 230, "saved context: —", { mono: true, size: 13, bold: true });
  const STEPS = [
    { box: a, cap: "A is running and calls <b>read</b>. The disk will take far longer than a time slice.", file: "A.c", lines: [3], shelf: "—", disk: "idle" },
    { box: k, cap: "The system call traps. The kernel <b>saves A’s context</b> (PC, registers) and starts the disk.", file: "A.c", lines: [3], note: ["trap", "warn"], shelf: "A’s PC, registers", disk: "working" },
    { box: b, cap: "The kernel <b>restores B</b> and runs it while the disk works. A is not on the CPU, but A is not gone.", file: "B.c", lines: [2], shelf: "A’s PC, registers", disk: "working" },
    { box: disk, cap: "The disk finishes and raises an <b>interrupt</b>. That exception enters the kernel again.", file: "B.c", lines: [2], note: ["interrupted", "warn"], shelf: "A waiting, B running", disk: "done" },
    { box: a, cap: "The kernel restores A. <b>read returns</b>, and A continues at the next line — not back at the start of read.", file: "A.c", lines: [4], note: ["n = 12", "good"], shelf: "B’s context saved", disk: "idle" },
  ];
  const cv = code("#s825-code", {
    label: "The code",
    tabs: true,
    files: [
      fileC("A.c", "", join([
        "use std::io::{Read, Write}; // use: bring names into scope",
        "fn main() {",
        "    let mut buf = [0u8; 16]; // 16 bytes, all zero",
        "    // &mut buf: lend buf so read can fill it. read returns a Result,",
        "    // the count or an error; unwrap takes the count (or panics).",
        "    let n = std::io::stdin().read(&mut buf).unwrap();",
        "    std::io::stdout().write_all(&buf[..n]).unwrap(); // first n bytes",
        "}",
      ]), { name: "A.rs", cmd: "echo \"hello, disk\" | ./a  →  hello, disk  (Linux)", map: { 1: 2, 2: 3, 3: 6, 4: 7, 5: 8 } }),
      fileC("B.c", "", join([
        "fn b() {",
        "    compute(); // runs during A's disk wait",
        "}",
        "fn compute() {}",
      ]), { name: "B.rs (sketch)" }),
    ],
  });
  let i = -1;
  function paint() {
    [a, k, b, disk].forEach((bx) => bx.r.setAttribute("class", bx === disk ? "sv-db" : bx === k ? "sv-server" : "sv-panel"));
    if (i < 0) {
      shelf.textContent = "saved context: —";
      cv.calm();
      pill("s825-pill", "step 0");
      cap("s825-cap", "A will call read. The disk is slow, so the kernel can run B in the meantime. Press <b>Step</b>.");
      return;
    }
    const st = STEPS[i];
    st.box.r.setAttribute("class", "sv-good");
    disk.u.textContent = st.disk;
    shelf.textContent = "saved context: " + st.shelf;
    cv.show(st.file);
    cv.calm();
    cv.at(st.lines);
    if (st.note) cv.notes({ [st.lines[0]]: st.note });
    pill("s825-pill", `step ${i + 1}`);
    cap("s825-cap", st.cap);
  }
  const ctr = K.$("#s825-controls");
  button(ctr, "Step", "primary", () => { if (i < STEPS.length - 1) { i++; paint(); } });
  button(ctr, "Reset", "", () => { i = -1; disk.u.textContent = "idle"; paint(); });
  paint();
})();

/* ================= 8.3 ================= */
(function errnoScene() {
  const svg = K.$("#s83-svg");
  const call = box(svg, 36, 60, 180, 80, "sv-server", "fork()", "—", 16);
  const ret = box(svg, 250, 60, 160, 80, "sv-panel", "return", "—", 16);
  const err = box(svg, 450, 60, 170, 80, "sv-panel", "errno", "0", 16);
  call.t.setAttribute("y", 88); ret.t.setAttribute("y", 88); err.t.setAttribute("y", 88);
  let wrap = false;
  /* errno.rs on Linux. The failing runs: user nobody, `ulimit -u 1`, so the process table is "full" for us. */
  const RAW_RS = join([
    "let pid = unsafe { fork() }; // the C library's fork",
    "if pid < 0 {",
    "    eprintln!(\"fork error: {}\", std::io::Error::last_os_error());",
    "    std::process::exit(1);",
    "}",
    "// pid is 0 in the child, or the child's PID here",
  ]);
  const WRAP_RS = join([
    "// Result: either Ok(a value) or Err(an error). io::Result<i32> = Result<i32, io::Error>",
    "fn fork_checked() -> std::io::Result<i32> {",
    "    let pid = unsafe { fork() };",
    "    if pid < 0 {",
    "        return Err(std::io::Error::last_os_error()); // errno, as a value",
    "    }",
    "    Ok(pid)",
    "}",
    "",
    "fn main() -> std::io::Result<()> {",
    "    let pid = fork_checked()?; // ?: on Err, return it from main at once",
  ]);
  const cv = code("#s83-code", { label: "The code", files: [fileC("check.rs", "", RAW_RS, { name: "check.rs", cmd: LNX + " · excerpt" })] });
  const st = useStats("s83-stats", ["return", "errno"]);
  function run(ok) {
    call.u.textContent = ok ? "process table has room" : "process limit reached";
    ret.u.textContent = ok ? "488" : "−1";
    ret.r.setAttribute("class", ok ? "sv-good" : "sv-bad");
    err.u.textContent = ok ? "0" : "EAGAIN (11)";
    err.r.setAttribute("class", ok ? "sv-panel" : "sv-bad");
    st.return.set(ok ? "488" : "−1", ok ? "good" : "bad");
    st.errno.set(ok ? "0" : "EAGAIN", ok ? "" : "bad");
    cv.calm();
    if (!wrap) {
      cv.at(ok ? [1, 6] : [1, 2, 3], ok ? "good" : "bad");
      cv.notes(ok ? { 1: ["pid = 488", "good"] } : { 1: ["pid = -1", "bad"], 3: ["errno’s message", "bad"] });
      cv.out(ok ? "fork returned 488" : "fork error: Resource temporarily unavailable (os error 11)\n[exit status 1]");
    } else {
      cv.at(ok ? [3, 7, 11] : [3, 4, 5, 11], ok ? "good" : "bad");
      cv.notes(ok ? { 7: ["Ok(488)", "good"] } : { 5: ["Err(EAGAIN)", "bad"], 11: ["? returns it", "bad"] });
      cv.out(ok ? "fork returned 488" : "Error: Os { code: 11, kind: WouldBlock, message: \"Resource temporarily unavailable\" }\n[exit status 1]");
    }
    cap("s83-cap", ok
      ? "fork worked. The return value is a PID (488 in our run), and errno does not matter."
      : (wrap
        ? "fork failed. <b>fork_checked</b> turns −1 and errno into an <b>Err</b>, so no caller can mistake it for a PID. <b>?</b> passes it up; main returned it, and Rust printed the error and exited with status 1."
        : "fork failed with −1. If the next line treated −1 as a PID, the bug would be quiet. <b>last_os_error</b> read errno: 11, “Resource temporarily unavailable.”"));
  }
  function setWrap(i) {
    wrap = i === 1;
    cv.setFiles([wrap ? fileC("wrapper.rs", "", WRAP_RS, { name: "wrapper.rs", cmd: LNX + " · excerpt" }) : fileC("check.rs", "", RAW_RS, { name: "check.rs", cmd: LNX + " · excerpt" })]);
    ret.u.textContent = "—"; ret.r.setAttribute("class", "sv-panel");
    err.u.textContent = "0"; err.r.setAttribute("class", "sv-panel");
    call.u.textContent = "—";
    cv.out(null);
    cap("s83-cap", wrap ? "The wrapper returns a Result, and <b>?</b> hands any error up. Press either outcome." : "Every call checks for −1. Press either outcome.");
  }
  K.$("#s83-seg").appendChild(seg(["Check each call", "Fork wrapper"], 0, setWrap, "s83-mode"));
  const ctr = K.$("#s83-controls");
  button(ctr, "fork succeeds", "primary", () => run(true));
  button(ctr, "fork fails", "", () => run(false));
  setWrap(0);
})();

/* ================= 8.4 ================= */
(function states() {
  const svg = K.$("#s84-svg");
  const nodes = {
    running: box(svg, 40, 80, 160, 64, "sv-good", "running", "on CPU or ready", 14),
    stopped: box(svg, 250, 80, 160, 64, "sv-panel", "stopped", "suspended", 14),
    dead: box(svg, 460, 80, 160, 64, "sv-panel", "terminated", "still a zombie", 14),
  };
  txt(svg, 330, 40, "SIGTSTP → stopped     SIGCONT → running     exit / SIGKILL → terminated", { cls: "sv-label" });
  const proc = txt(svg, 330, 190, "/proc/499/stat says: R", { mono: true, size: 13, bold: true });
  /* states.rs on Linux: the letter is the state field of /proc/<pid>/stat after each step */
  const ST_RS = join([
    "let mut child = Command::new(&me).arg(\"busy\") // busy: loop forever",
    "    .process_group(0) // its own group, as a shell gives each job",
    "    .spawn().unwrap();",
    "let pid = child.id();",
    "unsafe { kill(pid as i32, SIGTSTP) }; // Ctrl+Z. as i32: id() is a u32; C wants an int",
    "unsafe { kill(pid as i32, SIGCONT) };",
    "child.kill().unwrap(); // std: send SIGKILL",
    "let status = child.wait().unwrap(); // reap it",
    "// another child: Command::new(&me).arg(\"quick\"), which calls exit(3)",
  ]);
  const cv = code("#s84-code", { label: "The code", files: [fileC("states.rs", "", ST_RS, { name: "states.rs", cmd: LNX + " · excerpt: prints and pauses left out" })] });
  let state = "running", how = null;
  function paint(why, line, tone, letter, out) {
    Object.entries(nodes).forEach(([k, b]) => b.r.setAttribute("class", k === state ? (state === "dead" ? "sv-bad" : "sv-good") : "sv-panel"));
    pill("s84-pill", state);
    proc.textContent = letter;
    cv.calm();
    cv.at([line], tone === "bad" ? "bad" : tone === "good" ? "good" : "on");
    cv.notes({ [line]: letter });
    cv.out(out);
    cap("s84-cap", why);
  }
  function go(next, why, line, letter, out) {
    if (state === "dead") { paint("Terminated stays terminated. Nothing runs it again; it waits only to be reaped.", 8, "bad", proc.textContent, null); return; }
    state = next;
    paint(why, line, next === "dead" ? "bad" : "good", letter, out);
  }
  function start() {
    state = "running";
    paint("The child is running: on a CPU, or waiting for a turn. /proc shows <b>R</b>.", 3, "good", "/proc/499/stat says: R", "499: R  running");
  }
  start();
  const ctr = K.$("#s84-controls");
  button(ctr, "SIGTSTP", "", () => go("stopped", "SIGTSTP (Ctrl+Z) stopped it: /proc shows <b>T</b>. SIGSTOP, SIGTTIN, and SIGTTOU stop a process the same way.", 5, "/proc/499/stat says: T", "499: T  after SIGTSTP"));
  button(ctr, "SIGCONT", "primary", () => {
    if (state !== "stopped") { paint(state === "dead" ? "Terminated stays terminated." : "SIGCONT has nothing to continue; it is already running.", state === "dead" ? 8 : 3, state === "dead" ? "bad" : "warn", proc.textContent, null); return; }
    go("running", "SIGCONT made the stopped process run again: back to <b>R</b>.", 6, "/proc/499/stat says: R", "499: R  after SIGCONT");
  });
  button(ctr, "exit", "", () => go("dead", "A second child called exit(3). It will not run again, but until it is reaped /proc shows <b>Z</b>, a zombie. Reaping returns “exit status: 3”.", 9, "/proc/500/stat says: Z", "500: Z  after exit(3)\n500: reaped, exit status: 3"));
  button(ctr, "SIGKILL", "", () => go("dead", "<b>Child::kill</b> sent SIGKILL, which cannot be caught. The process is terminated (<b>Z</b>) but not yet reaped. <b>wait</b> then reports “signal: 9 (SIGKILL)”.", 7, "/proc/499/stat says: Z", "499: Z  after SIGKILL, not yet waited for\n499: reaped, signal: 9 (SIGKILL)"));
  button(ctr, "Reset", "", start);
})();

/* ================= 8.4.1 ================= */
(function pids() {
  const svg = K.$("#s841-svg");
  const parent = box(svg, 40, 50, 250, 120, "sv-server", "parent", "pid —", 16);
  const child = box(svg, 370, 50, 250, 120, "sv-panel", "child", "not created", 16);
  parent.t.setAttribute("y", 78);
  child.t.setAttribute("y", 78);
  /* ids.rs on Linux, started from a shell whose pid was 501 */
  const IDS_RS = join([
    "use std::os::unix::process::parent_id; // std's getppid",
    "use std::process::id; // std's getpid",
    "",
    "fn main() {",
    "    println!(\"before fork: {} {}\", id(), parent_id()); // each {} takes a value",
    "    let pid = unsafe { fork() }; // the child starts here too",
    "    if pid == 0 {",
    "        println!(\"child:  {} {}\", id(), parent_id());",
    "        std::thread::sleep(std::time::Duration::from_millis(300));",
    "        println!(\"child, later: {} {}\", id(), parent_id()); // adopted",
    "    } else {",
    "        println!(\"parent: {} {}\", id(), parent_id());",
    "        std::thread::sleep(std::time::Duration::from_millis(100));",
    "        std::process::exit(0); // the parent dies first",
    "    }",
    "}",
  ]);
  const cv = code("#s841-code", { label: "The code", files: [fileC("ids.rs", "", IDS_RS, { name: "ids.rs", cmd: LNX })] });
  let step = 0;
  function paint() {
    cv.calm();
    if (step === 0) {
      parent.r.setAttribute("class", "sv-server");
      parent.u.textContent = "id 502 · parent_id 501";
      child.u.textContent = "not created";
      child.r.setAttribute("class", "sv-panel");
      cv.at([5]);
      cv.notes({ 5: "502 501" });
      cv.out("before fork: 502 501");
      pill("s841-pill", "before fork");
      cap("s841-cap", "Before fork there is one process. <b>id()</b> is 502. <b>parent_id()</b> is 501, the shell that started it.");
    } else if (step === 1) {
      parent.u.textContent = "id 502 · parent_id 501";
      child.u.textContent = "id 503 · parent_id 502";
      child.r.setAttribute("class", "sv-good");
      cv.at([8], "on", false);
      cv.at([12], "on2", false);
      cv.notes({ 8: ["child 503, parent 502", "good"], 12: ["still 502 and 501", "warn"] });
      cv.out("before fork: 502 501\nparent: 502 501\nchild:  503 502");
      pill("s841-pill", "after fork");
      cap("s841-cap", "fork returned twice. The child printed <span class=\"mono\">503 502</span>. The parent’s own ids did not change.");
    } else {
      parent.u.textContent = "terminated";
      parent.r.setAttribute("class", "sv-bad");
      child.u.textContent = "id 503 · parent_id 1";
      child.r.setAttribute("class", "sv-good");
      cv.at([14, 10], "bad");
      cv.notes({ 10: ["parent_id is now 1", "warn"], 14: "parent exited" });
      cv.out("before fork: 502 501\nparent: 502 501\nchild:  503 502\nchild, later: 503 1");
      pill("s841-pill", "adopted");
      cap("s841-cap", "The parent exited first. The child was adopted by PID 1 (in our container, the first process plays init), so <b>parent_id</b> changed to 1. <b>id</b> did not.");
    }
  }
  const ctr = K.$("#s841-controls");
  button(ctr, "Step", "primary", () => { if (step < 2) { step++; paint(); } });
  button(ctr, "Reset", "", () => { step = 0; cv.out(null); paint(); });
  paint();
})();

/* ================= 8.4.2 ================= */
(function forks() {
  const svg = K.$("#s842-svg");
  const stage = s("g");
  svg.appendChild(stage);
  /* forkx.rs and nested.rs on Linux. strace -f shows fork as one clone system call. */
  const XRS = join([
    "fn main() {",
    "    let mut x = 1;",
    "    let pid = unsafe { fork() }; // called once, returns twice",
    "    if pid == 0 {",
    "        x += 1;",
    "        println!(\"child : x={x}\"); // {x}: the value of x",
    "    } else {",
    "        x -= 1;",
    "        println!(\"parent: x={x}\");",
    "    }",
    "    std::process::exit(0);",
    "}",
  ]);
  const NRS = join([
    "fn main() {",
    "    unsafe { fork() }; // now 2 processes",
    "    unsafe { fork() }; // now 4",
    "    println!(\"hello from {}\", std::process::id());",
    "    std::process::exit(0);",
    "}",
  ]);
  const xfile = () => fileC("forkx.rs", "", XRS, { name: "forkx.rs", cmd: LNX });
  const cv = code("#s842-code", { label: "The code", files: [xfile()] });
  let mode = 0;
  let xStep = 0;
  let procs = [];
  let nextId = 2;
  let lines = [];

  function paintX() {
    K.clear(stage);
    const showChild = xStep >= 1;
    const parent = box(stage, 40, 40, 250, 150, "sv-server", "parent", "", 16);
    parent.t.setAttribute("y", 68);
    const px = xStep >= 2 ? 0 : 1;
    txt(stage, parent.cx, 100, `x = ${px}`, { mono: true, size: 18, bold: true });
    txt(stage, parent.cx, 128, xStep >= 1 ? "fork returned the child’s PID" : "about to fork", { cls: "sv-label" });
    txt(stage, parent.cx, 150, xStep >= 2 ? "printed parent: x=0" : "", { cls: "sv-label" });
    if (showChild) {
      const child = box(stage, 370, 40, 250, 150, "sv-good", "child", "", 16);
      child.t.setAttribute("y", 68);
      const cx = xStep >= 3 ? 2 : 1;
      txt(stage, child.cx, 100, `x = ${cx}`, { mono: true, size: 18, bold: true });
      txt(stage, child.cx, 128, "fork returned 0", { cls: "sv-label" });
      txt(stage, child.cx, 150, xStep >= 3 ? "printed child : x=2" : "", { cls: "sv-label" });
    } else {
      txt(stage, 490, 120, "no child yet", { cls: "sv-label" });
    }
    cv.calm();
    if (xStep === 0) { cv.at([2, 3]); cv.notes({ 2: "x = 1" }); cv.out(null); }
    if (xStep === 1) { cv.at([3, 4]); cv.notes({ 3: ["0 and a PID", "warn"], 2: ["two copies of x", "good"] }); cv.out(null); }
    if (xStep === 2) { cv.at([9], "on2"); cv.notes({ 9: ["parent x = 0", "good"] }); cv.out("parent: x=0"); }
    if (xStep === 3) { cv.at([6], "on"); cv.notes({ 6: ["child x = 2", "good"], 9: "parent already printed" }); cv.out("parent: x=0\nchild : x=2"); }
    const caps = [
      "One process, <b>x = 1</b>, about to call fork.",
      "Called once, returned twice. Both copies of x are still 1. They are not the same variable.",
      "The parent decrements <b>its</b> x and prints 0. In both of our Linux runs the parent printed first; nothing promises that order.",
      "The child increments <b>its</b> x and prints 2. Both lines show up, because they share the open screen, not the variable.",
    ];
    cap("s842-cap", caps[xStep]);
  }
  function resetNest() {
    procs = [{ id: 1, pc: 0 }];
    nextId = 2;
    lines = [];
    paintNest();
  }
  function paintNest() {
    K.clear(stage);
    procs.forEach((p, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const done = p.pc >= 3;
      const b = box(stage, 24 + col * 160, 30 + row * 100, 146, 80, done ? "sv-good" : "sv-panel", `P${p.id}`, p.pc === 0 ? "at first fork" : p.pc === 1 ? "at second fork" : p.pc === 2 ? "at println!" : "exited", 14);
      b.t.setAttribute("y", b.y + 28);
    });
    if (!procs.length) return;
    cv.calm();
    const active = procs.filter((p) => p.pc < 3);
    if (active.length) {
      cv.at(active.map((p) => p.pc + 2));
      cv.notes({ 2: `${procs.length < 2 ? "1 process" : procs.length + " processes"}` });
    } else {
      cv.at([4], "good");
      cv.notes({ 4: [`${lines.length} hellos`, "good"] });
    }
    cv.out(lines.length ? lines.join("\n") : null);
    cap("s842-cap", active.length
      ? `There ${procs.length === 1 ? "is" : "are"} <b>${procs.length}</b> process${procs.length === 1 ? "" : "es"}. Press a Run button: any runnable process may go next. Hello count: ${lines.length}.`
      : `All ${procs.length} processes printed hello. The lines are a valid order. Our Linux run printed PIDs 507, 509, 508, 510, in that order; another run can differ, and the count stays 4.`);
  }
  function runProc(p) {
    if (p.pc === 0 || p.pc === 1) {
      const child = { id: nextId++, pc: p.pc + 1 };
      p.pc++;
      procs.push(child);
    } else if (p.pc === 2) {
      p.pc = 3;
      lines.push(`hello from P${p.id}`);
    }
    paintNest();
  }
  function controlsFor() {
    const ctr = K.$("#s842-controls");
    K.clear(ctr);
    if (mode === 0) {
      button(ctr, "Step", "primary", () => { if (xStep < 3) { xStep++; paintX(); } });
      button(ctr, "Reset", "", () => { xStep = 0; cv.out(null); paintX(); });
    } else {
      procs.filter((p) => p.pc < 3).forEach((p) => button(ctr, `Run P${p.id}`, "primary", () => { runProc(p); controlsFor(); }));
      button(ctr, "Reset", "", () => { resetNest(); controlsFor(); });
    }
  }
  function setMode(i) {
    mode = i;
    if (i === 0) { cv.setFiles([xfile()]); xStep = 0; paintX(); }
    else { cv.setFiles([fileC("nested.rs", "", NRS, { name: "nested.rs", cmd: LNX })]); resetNest(); }
    controlsFor();
  }
  K.$("#s842-seg").appendChild(seg(["Private x", "Four hellos"], 0, setMode, "s842-mode"));
  setMode(0);
})();

/* ================= 8.4.3 ================= */
(function reap() {
  const svg = K.$("#s843-svg");
  const PIDS = [513, 514]; /* reap.rs any, on Linux */
  const parent = box(svg, 230, 24, 200, 56, "sv-server", "parent", "running", 14);
  const kids = [0, 1].map((i) => box(svg, 80 + i * 280, 120, 200, 80, "sv-panel", `child ${PIDS[i]}`, "running", 14));
  const init = box(svg, 460, 24, 160, 56, "sv-panel", "init 1", "adopt?", 14);
  const ANY_RS = join([
    "for i in 0..N { // 0..N: 0, 1, up to N-1",
    "    if unsafe { fork() } == 0 { std::process::exit(100 + i); }",
    "}",
    "let mut status = 0;",
    "loop {",
    "    let pid = unsafe { waitpid(-1, &mut status, 0) }; // any child",
    "    if pid <= 0 { break; } // -1: no children left (ECHILD)",
    "    println!(\"child {pid} status={}\", (status >> 8) & 0xff); // the exit code",
    "}",
  ]);
  const ORD_RS = join([
    "let mut kids = Vec::new(); // Child handles, in creation order",
    "for i in 0..N {",
    "    kids.push(Command::new(me).arg(\"exit\").arg((100 + i).to_string()).spawn().unwrap());",
    "}",
    "for mut k in kids { // take each Child in the order we made them",
    "    let status = k.wait().unwrap(); // std's waitpid for this one child",
    "    println!(\"child {} {status}\", k.id());",
    "}",
  ]);
  const WNO_RS = join([
    "match k.try_wait().unwrap() { // WNOHANG: never blocks",
    "    None => println!(\"{}: still running\", k.id()),",
    "    Some(status) => println!(\"{}: {status}\", k.id()), // reaped",
    "}",
  ]);
  /* engine lines are the any-child listing's; the other listings map them */
  const ANY_MAP = "same";
  const ORD_MAP = { 2: 3, 6: [6, 5], 8: 7 };
  const cv = code("#s843-code", { label: "The code", tabs: true, files: [fileC("reap.rs", "", ANY_RS, { name: "reap.rs · any", cmd: LNX + " · excerpt" })] });
  let mode = 0; /* 0 any, 1 order, 2 wnohang */
  let parentAlive = true;
  let child = [];
  let out = [];
  function fileFor() {
    if (mode === 2) return fileC("reap.rs", "", WNO_RS, { name: "reap.rs · try_wait", cmd: LNX + " · excerpt" });
    return fileC("reap.rs", "", mode === 0 ? ANY_RS : ORD_RS, { name: mode === 0 ? "reap.rs · any" : "reap.rs · in order", map: mode === 0 ? ANY_MAP : ORD_MAP, cmd: LNX + " · excerpt" });
  }
  function zombies() { return child.filter((c) => c.st === "zombie"); }
  function paint() {
    parent.r.setAttribute("class", parentAlive ? "sv-server" : "sv-bad");
    parent.u.textContent = parentAlive ? "running" : "gone";
    init.r.setAttribute("class", parentAlive ? "sv-panel" : "sv-good");
    init.u.textContent = parentAlive ? "idle" : "adopted leftovers";
    kids.forEach((b, i) => {
      const c = child[i];
      const adopted = !parentAlive && c.st === "running";
      b.u.textContent = adopted ? "running · parent_id 1" : c.st + (c.st === "running" ? "" : ` · status ${c.status}`);
      b.r.setAttribute("class", c.st === "running" ? "sv-panel" : c.st === "reaped" ? "sv-good" : "sv-bad");
    });
    cv.setFiles([fileFor()]);
    cv.calm();
    const z = zombies();
    const reaped = child.filter((c) => c.st === "reaped");
    const running = child.filter((c) => c.st === "running");
    if (mode === 2) {
      if (!parentAlive) { cv.at([1], "dim"); cv.notes({ 1: ["parent is gone", "bad"] }); }
      else if (z.length) { cv.at([3]); cv.notes({ 3: ["would return Some", "good"] }); }
      else if (reaped.length) { cv.at([3], "good"); cv.notes({ 3: [`reaped ${reaped.length}`, "good"] }); }
      else { cv.at([2]); cv.notes({ 2: ["None: no wait", "warn"] }); }
    } else if (!parentAlive) {
      cv.at([6], "dim");
      cv.notes({ 6: ["parent is gone", "bad"] });
    } else if (z.length) {
      cv.at([6]);
      cv.notes({ 6: [`${z.length} zombie${z.length > 1 ? "s" : ""}`, "warn"] });
    } else if (reaped.length) {
      cv.at([8], "good");
      cv.notes({ 8: [`reaped ${reaped.map((c) => c.pid).join(", ")}`, "good"] });
    }
    cv.out(out.length ? out.join("\n") : null);
    const waiting = z.map((c) => c.pid);
    const reapedIds = reaped.map((c) => c.pid).join(" and ");
    const runningIds = running.map((c) => c.pid).join(" and ");
    cap("s843-cap", !parentAlive
      ? "The parent exited first. Init (PID 1) reaped any zombies at once. A child that was still running is adopted (parent_id 1) and keeps going until it exits."
      : waiting.length
        ? (waiting.length > 1
          ? `Zombies ${waiting.join(" and ")} still occupy kernel slots. Press <b>waitpid</b>.`
          : `Zombie ${waiting[0]} still occupies a kernel slot. Press <b>waitpid</b>.`)
        : reaped.length && running.length
          ? `Reaped ${reapedIds}. ${runningIds} ${running.length > 1 ? "are" : "is"} still running, so the next wait ${mode === 2 ? "returns None at once" : "would block"}.`
          : reaped.length === child.length
            ? (mode === 0 ? "Every child has been reaped. Another waitpid returned −1 with ECHILD: “No child processes (os error 10)” in our run." : "Every child has been waited for.")
            : "Children that are still running are not zombies. Exit them, or press waitpid and see what happens.");
  }
  function reapOne() {
    if (!parentAlive) { paint(); return; }
    if (mode === 2) {
      const z = child.find((c) => c.st === "zombie");
      const r = child.find((c) => c.st === "running");
      if (!z) { out.push(`${r ? r.pid : child[0].pid}: still running`); paint(); return; }
      z.st = "reaped";
      out.push(`${z.pid}: exit status: ${z.status}`);
      paint();
      return;
    }
    if (mode === 1) {
      const target = child.find((c) => c.st !== "reaped");
      if (!target) { out.push("(every Child has been waited for)"); paint(); return; }
      if (target.st === "running") { out.push(`wait() on ${target.pid} blocks: it is still running`); paint(); return; }
      target.st = "reaped";
      out.push(`child ${target.pid} exit status: ${target.status}`);
      paint();
      return;
    }
    const zs = child.filter((c) => c.st === "zombie");
    const z = zs.length ? zs[Math.floor(Math.random() * zs.length)] : null;
    if (!z) {
      out.push(child.some((c) => c.st === "running") ? "waitpid blocks: a child is still running" : "waitpid: No child processes (os error 10)");
      paint();
      return;
    }
    z.st = "reaped";
    out.push(`child ${z.pid} status=${z.status}`);
    paint();
  }
  function exitChild(i) {
    if (child[i].st !== "running") return;
    child[i].st = parentAlive ? "zombie" : "reaped";
    paint();
  }
  function parentExit() {
    if (!parentAlive) return;
    parentAlive = false;
    child.forEach((c) => { if (c.st === "zombie") c.st = "reaped"; });
    out.push("init reaped the zombies; running children now have parent_id 1");
    paint();
  }
  function reset() {
    parentAlive = true;
    child = [{ pid: PIDS[0], status: 100, st: "running" }, { pid: PIDS[1], status: 101, st: "running" }];
    out = [];
    paint();
  }
  K.$("#s843-seg").appendChild(seg(["any child", "creation order", "WNOHANG"], 0, (i) => { mode = i; out = []; paint(); }, "s843-mode"));
  const ctr = K.$("#s843-controls");
  button(ctr, `Child ${PIDS[0]} exits`, "", () => exitChild(0));
  button(ctr, `Child ${PIDS[1]} exits`, "", () => exitChild(1));
  button(ctr, "waitpid", "primary", reapOne);
  button(ctr, "Parent exits", "", parentExit);
  button(ctr, "Reset", "", reset);
  reset();
})();

/* ================= 8.4.4 ================= */
(function snooze() {
  const svg = K.$("#s844-svg");
  const label = txt(svg, 40, 36, "sleep(3)", { anchor: "start", bold: true });
  const track = s("rect", { x: 40, y: 48, width: 420, height: 28, rx: 8, class: "sv-panel" });
  const fill = s("rect", { x: 40, y: 48, width: 0, height: 28, rx: 8, class: "sv-good" });
  svg.append(track, fill);
  const clock = txt(svg, 490, 68, "0.0 s", { mono: true, bold: true, anchor: "start" });
  const pauseBox = box(svg, 40, 110, 420, 52, "sv-panel", "pause()", "awake", 14);
  /* snooze.rs on Linux; a do-nothing SIGALRM handler is installed first */
  const SNOOZE_RS = join([
    "unsafe { alarm(1) }; // SIGALRM in 1 second",
    "let left = unsafe { sleep(3) }; // the C library's sleep",
    "println!(\"sleep(3) returned {left}\"); // seconds still left",
    "",
    "std::thread::sleep(Duration::from_secs(3)); // never less than 3 s",
    "",
    "let r = unsafe { pause() }; // no duration: wait for a signal",
  ]);
  const cv = code("#s844-code", { label: "The code", files: [fileC("snooze.rs", "", SNOOZE_RS, { name: "snooze.rs", cmd: LNX + " · excerpt" })] });
  function bar(sec, cls, name) {
    label.textContent = name;
    fill.setAttribute("width", String(Math.min(420, (sec / 3) * 420)));
    fill.setAttribute("class", cls);
    clock.textContent = sec.toFixed(1) + " s";
    pauseBox.u.textContent = "awake";
    pauseBox.r.setAttribute("class", "sv-panel");
  }
  function slept(early) {
    bar(early ? 1 : 3, early ? "sv-data-soft" : "sv-good", "sleep(3)");
    cv.calm();
    cv.at(early ? [1, 2] : [2], early ? "bad" : "good");
    cv.notes(early ? { 1: "fires at 1 s", 2: ["returns 1", "warn"] } : { 1: "not called", 2: ["returns 0", "good"] });
    cv.out(early ? "sleep(3) returned 1" : "sleep(3) returned 0");
    pill("s844-pill", early ? "interrupted" : "slept 3");
    cap("s844-cap", early
      ? "SIGALRM arrived after 1 second, and sleep came back early. strace showed 1.9997 s still left; sleep returns whole seconds, so it returned <b>1</b>. That is time left, not an error code."
      : "The whole interval elapsed. sleep returns <b>0</b>.");
  }
  function stdSleep() {
    bar(3, "sv-good", "thread::sleep(3 s)");
    cv.calm();
    cv.at([5], "good");
    cv.notes({ 5: ["slept 3.0 s", "good"] });
    cv.out("thread::sleep slept 3.0 s\n(strace: clock_nanosleep interrupted at 1 s, then called again for the 1.9997 s left)");
    pill("s844-pill", "slept 3");
    cap("s844-cap", "Rust’s <b>std::thread::sleep</b> promises at least the time you ask. The same SIGALRM interrupted it at 1 second; std called the system call again for the rest, so it slept the full 3.0 s.");
  }
  function paused(woke) {
    bar(0, "sv-good", "sleep(3)");
    clock.textContent = "—";
    pauseBox.r.setAttribute("class", woke ? "sv-good" : "sv-data-soft");
    pauseBox.u.textContent = woke ? "returned −1" : "sleeping until a signal";
    cv.calm();
    cv.at([7], woke ? "good" : "on");
    cv.notes({ 7: woke ? ["returns -1", "good"] : "no timeout" });
    cv.out(woke ? "pause returned -1: Interrupted system call (os error 4)" : null);
    pill("s844-pill", woke ? "signaled" : "paused");
    cap("s844-cap", woke
      ? "SIGALRM arrived and its handler ran. pause returned −1 with errno EINTR. It does not say which signal, and it has no time left to report."
      : "pause has no duration. It sits here until a signal is received.");
  }
  const ctr = K.$("#s844-controls");
  button(ctr, "sleep(3) finishes", "primary", () => slept(false));
  button(ctr, "Signal at 1s", "", () => slept(true));
  button(ctr, "thread::sleep", "", stdSleep);
  button(ctr, "pause", "", () => paused(false));
  button(ctr, "Deliver SIGALRM", "", () => paused(true));
  cap("s844-cap", "sleep takes a duration and may return early. pause waits only for a signal. Rust’s own sleep never comes back early.");
})();

/* ================= 8.4.5 ================= */
(function exec() {
  const svg = K.$("#s845-svg");
  const proc = box(svg, 24, 28, 200, 150, "sv-server", "PID 7", "program: exec", 15);
  proc.t.setAttribute("y", 56);
  const fds = txt(svg, 124, 150, "fds 0, 1, 2 open", { cls: "sv-label" });
  txt(svg, 450, 24, "ARGV", { cls: "sv-label" });
  const slots = ["exec", "NULL", "", ""].map((label, i) => box(svg, 360, 36 + i * 40, 260, 34, "sv-panel", label || "—", null, 13));
  /* exec.rs on Linux; strace -e execve showed the system call std made */
  const EXEC_RS = join([
    "use std::os::unix::process::CommandExt; // adds exec and arg0 to Command",
    "use std::process::Command;",
    "",
    "fn main() {",
    "    let target = std::env::args().nth(1).unwrap_or(\"/bin/sh\".into());",
    "    println!(\"before exec: pid {}\", std::process::id());",
    "    let mut cmd = Command::new(&target);",
    "    cmd.arg0(\"sh\").args([\"-c\", \"echo now pid $$ runs $0, USER=$USER\"]); // argv",
    "    cmd.env_clear().env(\"USER\", \"ada\").env(\"PWD\", \"/home/ada\"); // envp",
    "    let err = cmd.exec(); // execve: returns only on failure",
    "    // only reached on error",
    "    eprintln!(\"exec: {err}\");",
    "    std::process::exit(1);",
    "}",
  ]);
  const cv = code("#s845-code", { label: "The code", files: [fileC("exec.rs", "", EXEC_RS, { name: "exec.rs", cmd: LNX })] });
  function show(kind) {
    const ok = kind === "ok";
        proc.u.textContent = ok ? "program: sh" : "program: exec";
    proc.r.setAttribute("class", ok ? "sv-good" : kind === "bad" ? "sv-bad" : "sv-server");
    fds.textContent = "fds 0, 1, 2 open";
    const args = ok ? ["sh", "-c", "echo now pid $$ runs …", "NULL"] : ["exec", kind === "bad" ? "/bin/nope" : "NULL", kind === "bad" ? "NULL" : "—", "—"];
    slots.forEach((b, i) => { b.t.textContent = args[i]; b.r.setAttribute("class", ok ? "sv-data-soft" : "sv-panel"); });
    cv.calm();
    if (kind === "ok") {
      cv.at([10], "good");
      cv.notes({ 10: ["does not return", "good"], 8: "argv[0] is the name" });
      cv.out("before exec: pid 7\nnow pid 7 runs sh, USER=ada\n\nstrace: execve(\"/bin/sh\", [\"sh\", \"-c\", \"echo now pid $$ runs $0, USER=$U\"...], 0xaaaaf575d370 /* 2 vars */) = 0");
      pill("s845-pill", "PID 7 · sh");
      cap("s845-cap", "Success. The PID is still <b>7</b>: sh printed its own pid, and it is ours. Code, data, heap, and stack were replaced; open files stayed. sh received our argv and only the two variables we set. <b>exec</b> did not return.");
    } else if (kind === "bad") {
      cv.at([10, 12], "bad");
      cv.notes({ 10: ["returns an Err", "bad"], 12: "why it failed" });
      cv.out("before exec: pid 7\nexec: No such file or directory (os error 2)");
      pill("s845-pill", "PID 7 · exec");
      cap("s845-cap", "The file was missing. exec came back with an error (errno 2), and <b>our program is still the program</b>. The PID never changed.");
    } else {
      cv.out(null);
      pill("s845-pill", "exec");
      cap("s845-cap", "This process runs our program, exec, as PID 7. Press execve to load another program into it.");
    }
  }
  const ctr = K.$("#s845-controls");
  button(ctr, "execve /bin/sh", "primary", () => show("ok"));
  button(ctr, "execve missing", "", () => show("bad"));
  button(ctr, "Reset", "", () => show("reset"));
  show("reset");
})();

/* ================= 8.4.6 ================= */
(function shell() {
  const svg = K.$("#s846-svg");
  const sh = box(svg, 24, 30, 200, 80, "sv-server", "shell", "pid 529", 15);
  const job = box(svg, 250, 30, 180, 80, "sv-panel", "child", "none", 15);
  const prompt = box(svg, 456, 30, 180, 80, "sv-panel", "prompt", "waiting", 14);
  sh.t.setAttribute("y", 58); job.t.setAttribute("y", 58); prompt.t.setAttribute("y", 58);
  txt(svg, 330, 150, "foreground waits · background does not · quit is not a program", { cls: "sv-label" });
  const term = txt(svg, 330, 190, ">", { mono: true, size: 14, bold: true });
  /* shell.rs on Linux, fed: ls /tmp/d, sleep 1 &, sleep 2, ps -o pid,stat,comm, quit */
  const SRC_RS = join([
    "fn eval(cmdline: &str) {",
    "    let (argv, bg) = parseline(cmdline); // a pair: (words, background?)",
    "    if argv.is_empty() { return; } // a blank line",
    "    if builtin_command(&argv) { return; } // quit",
    "    // spawn: std starts a child process and runs the program in it",
    "    let mut child = match Command::new(argv[0]).args(&argv[1..]).spawn() { // &argv[1..]: the words after the first",
    "        Ok(c) => c,",
    "        Err(e) => { println!(\"{}: {e}\", argv[0]); return; }",
    "    };",
    "    if !bg { child.wait().unwrap(); } // foreground: wait for it",
    "    else { println!(\"{} {cmdline}\", child.id()); } // background: don't",
    "}",
  ]);
  const cv = code("#s846-code", { label: "The code", files: [fileC("shell.rs", "", SRC_RS, { name: "shell.rs", cmd: LNX + " · excerpt: eval" })] });
  const JOBS = {
    quit: [
      { lines: [2, 4], note: { 4: ["builtin quit", "good"] }, shell: "exits", job: "none", prompt: "gone", term: "> quit", cap: "<b>quit</b> is a builtin. The shell does not spawn anything: builtin_command calls exit, and the shell process terminates." },
    ],
    ls: [
      { lines: [2], note: { 2: "bg = false" }, shell: "parsing", job: "none", prompt: "blocked", term: "> ls /tmp/d", cap: "parseline split the line into words and reported a <b>foreground</b> job." },
      { lines: [6], note: { 6: ["child runs ls", "good"] }, shell: "waiting", job: "child · ls", prompt: "blocked", term: "> ls /tmp/d", cap: "<b>spawn</b> did the work of fork and exec in one call. strace on Linux showed a clone3 with CLONE_VM|CLONE_VFORK (the child borrows the parent’s memory until it execs, instead of copying it), then execve of /usr/bin/ls after a search of PATH." },
      { lines: [10], note: { 10: ["reaped", "good"] }, shell: "ready", job: "reaped", prompt: "ready", term: "> ls /tmp/d\na.txt\nb.txt\n>", cap: "ls printed a.txt and b.txt and exited. <b>wait</b> reaped it (strace: wait4). The shell is ready for another line. No zombie." },
    ],
    bg: [
      { lines: [2], note: { 2: "bg = true" }, shell: "parsing", job: "none", prompt: "ready", term: "> sleep 1 &", cap: "The trailing <b>&</b> marks a background job." },
      { lines: [6, 11], note: { 11: ["prints 531", "warn"] }, shell: "ready", job: "pid 531 · running", prompt: "ready", term: "> sleep 1 &\n531 sleep 1 &\n>", cap: "The shell does <b>not</b> wait. It printed the child’s PID, 531, and the prompt came back while sleep runs." },
      { lines: [11], note: { 11: ["no wait", "bad"] }, shell: "ready", job: "pid 531 · zombie", prompt: "ready", term: "> ps -o pid,stat,comm\n    531 Z    sleep", cap: "sleep finished. This simple shell never waits for background children, so ps showed 531 with STAT <b>Z</b>: a zombie. Rust’s Child does not reap on its own either. Signals, next, are how a real shell notices." },
    ],
  };
  let story = null, step = -1;
  function paint() {
    if (!story) {
      sh.u.textContent = "pid 529"; job.u.textContent = "none"; prompt.u.textContent = "waiting";
      job.r.setAttribute("class", "sv-panel"); prompt.r.setAttribute("class", "sv-panel");
      term.textContent = ">";
      cv.calm(); cv.out(null);
      pill("s846-pill", "ready");
      cap("s846-cap", "Pick a command. Then step through eval.");
      return;
    }
    const st = story[step];
    sh.u.textContent = st.shell;
    job.u.textContent = st.job;
    prompt.u.textContent = st.prompt;
    job.r.setAttribute("class", st.job.includes("zombie") ? "sv-bad" : st.job === "none" || st.job === "reaped" ? "sv-panel" : "sv-good");
    prompt.r.setAttribute("class", st.prompt === "blocked" ? "sv-data-soft" : st.prompt === "gone" ? "sv-bad" : "sv-good");
    term.textContent = st.term.split("\n").pop();
    cv.calm();
    cv.at(st.lines, st.job.includes("zombie") ? "bad" : "on");
    cv.notes(st.note);
    cv.out(st.term);
    pill("s846-pill", `step ${step + 1}`);
    cap("s846-cap", st.cap);
  }
  function choose(key) { story = JOBS[key]; step = 0; paint(); }
  const ctr = K.$("#s846-controls");
  button(ctr, "quit", "", () => choose("quit"));
  button(ctr, "ls  (foreground)", "primary", () => choose("ls"));
  button(ctr, "sleep 1 &", "", () => choose("bg"));
  button(ctr, "Step", "", () => { if (story && step < story.length - 1) { step++; paint(); } });
  button(ctr, "Reset", "", () => { story = null; step = -1; paint(); });
  paint();
})();

/* ================= 8.5 ================= */
(function signalsIntro() {
  const svg = K.$("#s85-svg");
  const kernel = box(svg, 24, 70, 180, 80, "sv-server", "kernel", "notices an event", 14);
  const proc = box(svg, 430, 70, 200, 80, "sv-panel", "process", "no signal", 14);
  kernel.t.setAttribute("y", 98);
  proc.t.setAttribute("y", 98);
  /* real runs: fault.rs (emulated x86-64 toolbox) for the first three, events.rs (Linux) for the last two */
  const EV = [
    { label: "divide by 0", sig: "no signal", n: "—", line: 2, out: "thread 'main' (137) panicked at fault.rs:5:5:\nattempt to divide by zero\nnote: run with `RUST_BACKTRACE=1` environment variable to display a backtrace\ndiv -> exit status: 101  code=Some(101)",
      say: "In the book’s C, the kernel turns the divide error into <b>SIGFPE</b> (8). Our Rust divide never reached the processor: Rust checked the divisor and panicked, so no signal was sent and the run ended with exit status 101." },
    { label: "bad instruction", sig: "SIGILL", n: 4, line: 3, out: "ud2 -> signal: 4 (SIGILL)  code=None", say: "Our Rust ran <span class=\"mono\">ud2</span>, an undefined instruction, through asm!. The kernel sent <b>SIGILL</b>, number 4, and its default action ended the process." },
    { label: "bad address", sig: "SIGSEGV", n: 11, line: 4, out: "gpf -> signal: 11 (SIGSEGV)  code=None", say: "The unsafe read through a bad pointer faulted. The kernel sent <b>SIGSEGV</b>, number 11." },
    { label: "Ctrl+C", sig: "SIGINT", n: 2, line: 5, out: "child signal: 2 (SIGINT)", say: "Ctrl+C makes the kernel send <b>SIGINT</b>, number 2. Our run sent it with kill to a child waiting in pause; the child’s ExitStatus read “signal: 2 (SIGINT)”." },
    { label: "child exits", sig: "SIGCHLD", n: 17, line: 6, out: "parent received signal 17", say: "When a child exits, the kernel sends its parent <b>SIGCHLD</b>, number 17. Our parent’s handler recorded it." },
  ];
  const KERNEL_RS = join([
    "// kernel turns an event into a signal",
    "if divide_by_zero { send(p, SIGFPE); } // 8",
    "if illegal_inst { send(p, SIGILL); } // 4",
    "if bad_address { send(p, SIGSEGV); } // 11",
    "if ctrl_c { send(fg, SIGINT); } // 2",
    "if child_done { send(parent, SIGCHLD); } // 17",
  ]);
  const cv = code("#s85-code", { label: "The code", files: [fileC("kernel.rs", "", KERNEL_RS, { name: "kernel.rs (sketch)" })] });
  function send(ev) {
    const none = ev.n === "—";
    proc.u.textContent = none ? "panicked, no signal" : `${ev.sig} (${ev.n})`;
    proc.r.setAttribute("class", none ? "sv-bad" : "sv-good");
    pill("s85-pill", ev.sig);
    cv.calm();
    cv.at([ev.line], none ? "dim" : "good");
    cv.notes({ [ev.line]: none ? ["Rust never gets here", "warn"] : [`${ev.sig} = ${ev.n}`, "good"] });
    cv.out(ev.out);
    cap("s85-cap", ev.say);
  }
  const ctr = K.$("#s85-controls");
  EV.forEach((ev) => button(ctr, ev.label, "", () => send(ev)));
  cap("s85-cap", "The book lists 30 signal types; today’s Linux numbers 31 standard ones. Press an event to see which number the kernel sends. The black bar is what our real run reported.");
})();

/* ================= 8.5.1 ================= */
(function terms() {
  const svg = K.$("#s851-svg");
  const names = ["SIGINT", "SIGCHLD", "SIGALRM"];
  txt(svg, 180, 28, "PENDING", { cls: "sv-label" });
  txt(svg, 420, 28, "BLOCKED", { cls: "sv-label" });
  const pending = names.map((name, i) => box(svg, 80, 48 + i * 58, 200, 46, "sv-panel", name, "0", 14));
  const blocked = names.map((name, i) => box(svg, 340, 48 + i * 58, 200, 46, "sv-panel", name, "0", 14));
  let P = [0, 0, 0], B = [0, 0, 0], focus = 0, lost = 0;
  const BITS_RS = join([
    "// one bit per signal type, not a counter",
    "struct Sigs { pending: u64, blocked: u64 } // the kernel's two bit sets",
    "fn send(p: &mut Sigs, sig: u32) { // &mut Sigs: may change *p",
    "    if p.pending & (1 << sig) != 0 { return; } // discard",
    "    p.pending |= 1 << sig;",
    "}",
    "fn receive(p: &mut Sigs, sig: u32) { // only if not blocked",
    "    if p.blocked & (1 << sig) != 0 { return; }",
    "    p.pending &= !(1 << sig); // !: flip every bit",
    "}",
  ]);
  /* pending.rs on Linux: SIGINT blocked, raised 3 times, then unblocked */
  const REAL = "pending.rs on Linux (block SIGINT, raise it 3 times, unblock):\npending: true, handled: 0\npending: false, handled: 1";
  const cv = code("#s851-code", { label: "The code", files: [fileC("bits.rs", "", BITS_RS, { name: "bits.rs (sketch)" })] });
  function paint(msg) {
    names.forEach((name, i) => {
      pending[i].u.textContent = P[i] ? "1  pending" : "0";
      blocked[i].u.textContent = B[i] ? "1  blocked" : "0";
      pending[i].r.setAttribute("class", P[i] ? "sv-data-soft" : "sv-panel");
      blocked[i].r.setAttribute("class", B[i] ? "sv-bad" : "sv-panel");
    });
    cv.calm();
    cv.notes({
      4: lost ? [`discarded ${lost} extra`, "bad"] : "second copy is dropped",
      5: P[focus] ? [`${names[focus]} pending`, "warn"] : "clear",
      9: !B[focus] && !P[focus] ? ["received at most once", "good"] : "",
    });
    pill("s851-pill", names[focus]);
    cap("s851-cap", msg);
  }
  function send() {
    if (P[focus]) { lost++; paint(`A second <b>${names[focus]}</b> was discarded. Pending is a bit: at least one, not how many.`); cv.at([4], "bad"); return; }
    P[focus] = 1;
    paint(`<b>${names[focus]}</b> is pending. ${B[focus] ? "It is blocked, so it is not received yet." : "It is not blocked, so the process can receive it."}`);
    cv.at(B[focus] ? [5] : [5, 9]);
  }
  function receive() {
    if (!P[focus]) { paint(`No pending ${names[focus]} to receive.`); return; }
    if (B[focus]) { paint(`<b>${names[focus]}</b> stays pending because it is blocked.`); cv.at([8], "on"); cv.notes({ 8: ["still pending", "warn"] }); return; }
    P[focus] = 0;
    paint(`Received <b>${names[focus]}</b> once. The pending bit is clear, including any duplicates that were thrown away. Our real Linux run did the same: three sends while blocked, one handler call.`);
    cv.at([9], "good");
    cv.out(REAL);
  }
  const ctr = K.$("#s851-controls");
  ctr.appendChild(seg(names, 0, (i) => { focus = i; lost = 0; paint(`Watching <b>${names[i]}</b>. Send it, block it, send it again.`); }, "s851-sig"));
  button(ctr, "Send", "primary", send);
  button(ctr, "Block", "", () => { B[focus] = 1; paint(`<b>${names[focus]}</b> is blocked. Sending it can set pending, and receiving waits.`); cv.at([8]); });
  button(ctr, "Unblock", "", () => { B[focus] = 0; paint(`<b>${names[focus]}</b> is unblocked.` + (P[focus] ? " It can be received now, still only once." : "")); });
  button(ctr, "Receive", "", receive);
  button(ctr, "Reset", "", () => { P = [0, 0, 0]; B = [0, 0, 0]; lost = 0; cv.out(null); paint("Both vectors are clear."); });
  paint("Pending means “at least one arrived.” Blocked means “do not receive it yet.”");
})();

/* ================= 8.5.2 ================= */
(function sendSig() {
  const svg = K.$("#s852-svg");
  /* groups.rs on Linux, each scenario in a fresh container: the "shell" is our program, pid 7 */
  const GROUPS = [
    { title: "our shell · pid 7", pids: [{ id: 7, name: "groups" }] },
    { title: "foreground · group 8", pids: [{ id: 8, name: "sleep" }, { id: 9, name: "sleep" }, { id: 10, name: "sleep" }] },
    { title: "background · groups 11 and 12", pids: [{ id: 11, name: "sleep" }, { id: 12, name: "sleep" }] },
  ];
  const nodes = {};
  GROUPS.forEach((g, gi) => {
    txt(svg, 36, 28 + gi * 82, g.title, { anchor: "start", cls: "sv-label" });
    g.pids.forEach((p, i) => {
      nodes[p.id] = box(svg, 40 + i * 150, 36 + gi * 82, 136, 48, "sv-panel", String(p.id), p.name, 14);
    });
  });
  const GROUPS_RS = join([
    "fn job(group: i32) -> Child { // a child that sleeps, in process group `group`",
    "    Command::new(\"sleep\").arg(\"5\").process_group(group).spawn().unwrap()",
    "}",
    "let mut fg = vec![job(0)]; // 0: a new group, named after this child",
    "let g = fg[0].id() as i32;",
    "fg.push(job(g)); // two more in the same group",
    "fg.push(job(g));",
    "let mut bg = vec![job(0), job(0)]; // two background jobs, own groups",
    "match what.as_str() {",
    "    \"ctrl-c\" => unsafe { kill(-g, SIGINT) }, // -g: every member of group g",
    "    \"ctrl-z\" => unsafe { kill(-g, SIGTSTP) }, // Ctrl+Z is this idea",
    "    \"kill-one\" => { fg[1].kill().unwrap(); 0 } // std: SIGKILL to one pid",
    "    \"kill-group\" => unsafe { kill(-g, SIGKILL) }, // the whole group",
    "    \"alarm\" => { unsafe { alarm(1) }; std::thread::sleep(std::time::Duration::from_secs(2)); 0 }",
  ]);
  const cv = code("#s852-code", { label: "The code", files: [fileC("groups.rs", "", GROUPS_RS, { name: "groups.rs", cmd: LNX + " · excerpt" })] });
  const OUT = {
    "ctrl-c": "8: signal: 2 (SIGINT)\n9: signal: 2 (SIGINT)\n10: signal: 2 (SIGINT)\n11: alive, state S\n12: alive, state S",
    "ctrl-z": "8: alive, state T\n9: alive, state T\n10: alive, state T\n11: alive, state S\n12: alive, state S",
    "kill-one": "8: alive, state S\n9: signal: 9 (SIGKILL)\n10: alive, state S\n11: alive, state S\n12: alive, state S",
    "kill-group": "8: signal: 9 (SIGKILL)\n9: signal: 9 (SIGKILL)\n10: signal: 9 (SIGKILL)\n11: alive, state S\n12: alive, state S",
    "alarm": "Alarm clock\n[exit status 142 = 128 + 14, SIGALRM]",
  };
  function hit(ids, label, line, tone, key, say) {
    Object.values(nodes).forEach((b) => b.r.setAttribute("class", "sv-panel"));
    ids.forEach((id) => nodes[id].r.setAttribute("class", tone === "bad" ? "sv-bad" : tone === "warn" ? "sv-data-soft" : "sv-good"));
    cv.calm();
    cv.at([line], tone === "bad" ? "bad" : "good");
    cv.notes({ [line]: [label, tone || "good"] });
    cv.out(OUT[key]);
    pill("s852-pill", label);
    cap("s852-cap", say);
  }
  const ctr = K.$("#s852-controls");
  button(ctr, "Ctrl+C", "primary", () => hit([8, 9, 10], "SIGINT to group 8", 10, "", "ctrl-c", "Ctrl+C sends <b>SIGINT</b> to every process in the foreground group. Our run did it with <span class=\"mono\">kill(-8, SIGINT)</span>: 8, 9, and 10 died of SIGINT. Our shell and the background jobs stayed up."));
  button(ctr, "Ctrl+Z", "", () => hit([8, 9, 10], "SIGTSTP to group 8", 11, "warn", "ctrl-z", "Ctrl+Z sends <b>SIGTSTP</b> to that same foreground group. 8, 9, and 10 show state T, stopped until SIGCONT. The background jobs kept sleeping (S)."));
  button(ctr, "kill -9 9", "", () => hit([9], "SIGKILL 9", 12, "bad", "kill-one", "A positive PID is one process. <b>Child::kill</b> sends SIGKILL, which cannot be caught or ignored, so 9 terminated. 8 and 10, in the same group, did not."));
  button(ctr, "kill -9 -8", "", () => hit([8, 9, 10], "SIGKILL group 8", 13, "bad", "kill-group", "A negative PID is a group. <span class=\"mono\">kill(-8, SIGKILL)</span> terminated 8, 9, and 10. Rust’s std has no call for a whole group, so this one goes through the C library’s kill."));
  button(ctr, "alarm(1)", "", () => hit([7], "SIGALRM to self", 14, "bad", "alarm", "<b>alarm(1)</b> asked the kernel to send SIGALRM to our own program a second later. We installed no handler, so the default action ended it; the shell printed “Alarm clock”. (In that fresh container our program was pid 6 and its children 7 to 11, one lower than in the picture.)"));
  cap("s852-cap", "Our program started three sleeps in one new group and two more in groups of their own, the shape of the book’s Figure 8.28. Press a way to send a signal.");
})();

/* ================= 8.5.3 ================= */
(function recv() {
  const svg = K.$("#s853-svg");
  const stage = s("g");
  svg.appendChild(stage);
  /* catch.rs and nest.rs on Linux */
  const CATCH_RS = join([
    "extern \"C\" fn handler(_sig: c_int) { // extern \"C\": C can call it. _: unused",
    "    sio_puts(\"caught SIGINT\\n\"); // catch: run this, then resume",
    "}",
    "fn child(how: &str) {",
    "    match how {",
    "        \"default\" => unsafe { signal_action(SIGINT, SIG_DFL) },",
    "        \"ignore\" => unsafe { signal_action(SIGINT, SIG_IGN) },",
    "        _ => unsafe { signal(SIGINT, handler) },",
    "    };",
    "    unsafe { alarm(1) }; // SIGALRM ends the wait if SIGINT does not",
    "    unsafe { pause() };",
    "    sio_puts(\"back in main after pause\\n\");",
  ]);
  const NEST_RS = join([
    "extern \"C\" fn handler_s(_sig: c_int) {",
    "    sio_puts(\"S starts\\n\");",
    "    unsafe { raise(SIGUSR2) }; // t arrives while S runs",
    "    sio_puts(\"S resumes\\n\");",
    "}",
    "extern \"C\" fn handler_t(_sig: c_int) {",
    "    sio_puts(\"T runs\\n\"); // returns to S, not to main",
    "}",
    "fn main() {",
    "    unsafe { signal(SIGUSR1, handler_s) };",
    "    unsafe { signal(SIGUSR2, handler_t) };",
    "    sio_puts(\"main\\n\");",
    "    unsafe { raise(SIGUSR1) }; // s",
    "    sio_puts(\"main again\\n\");",
    "}",
  ]);
  const catchFile = () => fileC("catch.rs", "", CATCH_RS, { name: "catch.rs", cmd: LNX + " · excerpt" });
  const cv = code("#s853-code", { label: "The code", files: [catchFile()] });
  let mode = 0, disp = "catch", nest = 0;
  function paintDisp() {
    K.clear(stage);
    const main = box(stage, 30, 40, 180, 70, "sv-panel", "main", "pause", 14);
    const hand = box(stage, 240, 40, 180, 70, "sv-panel", "handler", disp, 14);
    const end = box(stage, 450, 40, 180, 70, "sv-panel", "after", "—", 14);
    main.t.setAttribute("y", 68); hand.t.setAttribute("y", 68); end.t.setAttribute("y", 68);
    cv.calm();
    if (disp === "default") {
      end.u.textContent = "terminated"; end.r.setAttribute("class", "sv-bad");
      cv.at([6], "bad"); cv.notes({ 6: ["SIG_DFL", "bad"] });
      cv.out("default: signal: 2 (SIGINT)");
      cap("s853-cap", "Default for SIGINT is to <b>terminate</b>. No handler ran; the child’s ExitStatus said “signal: 2 (SIGINT)”. SIGKILL and SIGSTOP have defaults you cannot replace.");
    } else if (disp === "ignore") {
      main.r.setAttribute("class", "sv-good"); end.u.textContent = "still in pause";
      cv.at([7], "dim"); cv.notes({ 7: ["SIG_IGN", "warn"] });
      cv.out("ignore: signal: 14 (SIGALRM)");
      cap("s853-cap", "The child <b>ignored</b> SIGINT and stayed in pause. Only the one-second SIGALRM, whose default is to terminate, ended it.");
    } else {
      hand.r.setAttribute("class", "sv-good"); end.u.textContent = "back to main"; end.r.setAttribute("class", "sv-good");
      cv.at([1, 2, 8, 12], "good"); cv.notes({ 2: ["caught", "good"] });
      cv.out("caught SIGINT\nback in main after pause\ncatch: exit status: 0");
      cap("s853-cap", "The child <b>caught</b> SIGINT. The handler ran, then the main program resumed: pause returned and the next line printed.");
    }
  }
  function paintNest() {
    K.clear(stage);
    const frames = [
      { t: "main", s: "running" },
      { t: "handler S", s: "caught s" },
      { t: "handler T", s: "t interrupted S" },
      { t: "handler S", s: "T returned" },
      { t: "main", s: "S returned" },
    ];
    const OUTS = ["main", "main\nS starts", "main\nS starts\nT runs", "main\nS starts\nT runs\nS resumes", "main\nS starts\nT runs\nS resumes\nmain again"];
    frames.forEach((f, i) => {
      const on = i === nest;
      const b = box(stage, 24 + i * 126, 70, 116, 70, on ? "sv-good" : "sv-panel", f.t, on ? f.s : "", 12);
      b.t.setAttribute("y", b.y + 28);
    });
    cv.calm();
    const line = [12, 2, 7, 4, 14][nest];
    cv.at([line]);
    cv.notes({ [line]: frames[nest].s });
    cv.out(OUTS[nest]);
    cap("s853-cap", `<b>Step ${nest + 1}.</b> ${frames[nest].t}: ${frames[nest].s}. A different signal can interrupt a handler. The same signal usually cannot, because it is blocked while its handler runs.`);
  }
  function setMode(i) {
    mode = i;
    if (i === 0) { cv.setFiles([catchFile()]); paintDisp(); }
    else { nest = 0; cv.setFiles([fileC("nest.rs", "", NEST_RS, { name: "nest.rs", cmd: LNX })]); paintNest(); }
    build();
  }
  function build() {
    const ctr = K.$("#s853-controls");
    K.clear(ctr);
    if (mode === 0) {
      button(ctr, "Default", "", () => { disp = "default"; paintDisp(); });
      button(ctr, "Ignore", "", () => { disp = "ignore"; paintDisp(); });
      button(ctr, "Catch", "primary", () => { disp = "catch"; paintDisp(); });
    } else {
      button(ctr, "Step the nest", "primary", () => { nest = (nest + 1) % 5; paintNest(); });
    }
  }
  K.$("#s853-seg").appendChild(seg(["Disposition", "Nested handlers"], 0, setMode, "s853-mode"));
  setMode(0);
})();

/* ================= 8.5.4 ================= */
(function block() {
  const svg = K.$("#s854-svg");
  const pend = box(svg, 40, 40, 250, 80, "sv-panel", "SIGINT pending", "0", 15);
  const blk = box(svg, 360, 40, 250, 80, "sv-panel", "SIGINT blocked", "0", 15);
  const hand = box(svg, 180, 150, 300, 56, "sv-panel", "handler", "not running", 14);
  pend.t.setAttribute("y", 68); blk.t.setAttribute("y", 68);
  let pending = 0, blocked = 0, inHandler = false;
  /* block.rs on Linux. Its run printed:
     blocked: no handler yet / handler: depth 1 / handler: depth 1 / handler ran 2 times */
  const BLOCK_RS = join([
    "extern \"C\" fn handler(_sig: c_int) {",
    "    let d = DEPTH.fetch_add(1, Ordering::Relaxed) + 1; // fetch_add: add 1 atomically, get the old value",
    "    let n = RUNS.fetch_add(1, Ordering::Relaxed) + 1; // Relaxed: only this one atomic must stay consistent",
    "    if n == 1 { unsafe { raise(SIGINT) }; } // SIGINT again, from inside",
    "    sio_puts(if d == 1 { \"handler: depth 1\\n\" } else { \"handler: depth 2\\n\" });",
    "    DEPTH.fetch_sub(1, Ordering::Relaxed);",
    "}",
    "fn main() {",
    "    unsafe { signal(SIGINT, handler) };",
    "    let mut mask = empty_set(); // a signal set with no bits",
    "    let mut prev = empty_set();",
    "    unsafe { sigaddset(&mut mask, SIGINT) };",
    "    unsafe { sigprocmask(SIG_BLOCK, &mask, &mut prev) }; // block SIGINT",
    "    unsafe { raise(SIGINT) }; // stays pending",
    "    unsafe { raise(SIGINT) }; // already pending: lost",
    "    sio_puts(\"blocked: no handler yet\\n\");",
    "    unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) }; // unblock",
    "    println!(\"handler ran {} times\", RUNS.load(Ordering::Relaxed));",
  ]);
  const REAL = "blocked: no handler yet\nhandler: depth 1\nhandler: depth 1\nhandler ran 2 times";
  const cv = code("#s854-code", { label: "The code", files: [fileC("block.rs", "", BLOCK_RS, { name: "block.rs", cmd: LNX + " · excerpt: the DEPTH and RUNS atomics left out" })] });
  function paint(msg, lines, tone, out) {
    pend.u.textContent = pending ? "1" : "0";
    blk.u.textContent = blocked || inHandler ? "1" : "0";
    pend.r.setAttribute("class", pending ? "sv-data-soft" : "sv-panel");
    blk.r.setAttribute("class", (blocked || inHandler) ? "sv-bad" : "sv-panel");
    hand.u.textContent = inHandler ? "running" : "not running";
    hand.r.setAttribute("class", inHandler ? "sv-good" : "sv-panel");
    pill("s854-pill", inHandler ? "in handler" : blocked ? "blocked" : "open");
    cv.calm();
    if (lines) cv.at(lines, tone === "bad" ? "bad" : tone === "good" ? "good" : "on");
    cv.notes({
      14: pending ? ["pending = 1", "warn"] : "pending = 0",
      4: inHandler ? ["implicit block", "warn"] : "",
    });
    cv.out(out === undefined ? null : out);
    cap("s854-cap", msg);
  }
  const ctr = K.$("#s854-controls");
  button(ctr, "Block", "", () => { blocked = 1; paint("SIGINT is explicitly blocked. The handler will not run.", [13]); });
  button(ctr, "Send", "primary", () => {
    if (inHandler) {
      pending = 1;
      paint("The handler is running, so SIGINT is implicitly blocked. This send sets pending and does <b>not</b> start a second handler inside the first. Our run never printed depth 2.", [4], "warn");
      return;
    }
    if (pending) { paint("Already pending. The extra SIGINT is discarded.", [15], "bad"); return; }
    pending = 1;
    if (blocked) paint("Pending is set. Because the signal is blocked, nothing runs yet.", [14], "warn", "blocked: no handler yet");
    else { pending = 0; inHandler = true; paint("It was not blocked, so it is received at once and the handler starts. SIGINT is now implicitly blocked.", [1, 2], "good"); }
  });
  button(ctr, "Unblock", "", () => {
    if (inHandler) { paint("You cannot drop the implicit block by hand in this toy. Return from the handler.", [4], "warn"); return; }
    blocked = 0;
    if (pending) { pending = 0; inHandler = true; paint("Unblocking a pending SIGINT receives it <b>once</b>, even though it was sent twice. The handler starts.", [17, 1], "good", "blocked: no handler yet\nhandler: depth 1"); }
    else paint("Unblocked, and nothing was pending.", [17]);
  });
  button(ctr, "Handler returns", "", () => {
    if (!inHandler) { paint("The handler is not running.", [1]); return; }
    inHandler = false;
    if (pending && !blocked) {
      pending = 0; inHandler = true;
      paint("The SIGINT sent during the handler is received now, as a fresh call at depth 1. Our run: the handler ran 2 times, never nested.", [7, 1], "warn", REAL);
    } else paint("The handler returned. The implicit block is gone.", [7], "good");
  });
  button(ctr, "Reset", "", () => { pending = 0; blocked = 0; inHandler = false; paint("Nothing pending, nothing blocked.", [10]); });
  paint("Block SIGINT, send it twice, then unblock. Or start the handler and send again before it returns.", [10]);
})();

/* ================= 8.5.5 ================= */
(function handlers() {
  const svg = K.$("#s855-svg");
  const stage = s("g");
  svg.appendChild(stage);
  /* tangle.rs, safe.rs and reaper.rs on Linux */
  const UNSAFE_RS = join([
    "extern \"C\" fn handler(_sig: c_int) {",
    "    println!(\"Caught SIGALRM!\"); // not async-signal-safe",
    "}",
    "fn main() {",
    "    unsafe { signal(SIGALRM, handler) };",
    "    let long = \"x\".repeat(4000);",
    "    for _ in 0..200 {",
    "        unsafe { ualarm(50, 0) }; // SIGALRM in 50 microseconds",
    "        for _ in 0..20 { println!(\"{long}\"); } // main is printing too",
    "    }",
    "}",
  ]);
  const SAFE_RS = join([
    "extern \"C\" fn handler(_sig: c_int) {",
    "    sio_puts(\"Caught SIGALRM!\\n\"); // only calls write: safe",
    "    unsafe { _exit(0) }; // not std::process::exit",
    "}",
  ]);
  const ONE_RS = join([
    "extern \"C\" fn reap_one(_sig: c_int) {",
    "    let pid = unsafe { waitpid(-1, std::ptr::null_mut(), 0) }; // one child",
    "    if pid > 0 { REAPED.fetch_add(1, Ordering::Relaxed); }",
    "}",
    "// three children exit while SIGCHLD is blocked, then it is unblocked",
  ]);
  const LOOP_RS = join([
    "extern \"C\" fn reap_all(_sig: c_int) {",
    "    let old = unsafe { *__errno_location() }; // save errno",
    "    while unsafe { waitpid(-1, std::ptr::null_mut(), 0) } > 0 {",
    "        REAPED.fetch_add(1, Ordering::Relaxed); // reap every zombie",
    "    }",
    "    unsafe { *__errno_location() = old }; // put errno back",
    "}",
  ]);
  const TANGLE_OUT = "thread 'main' (10) panicked at …/library/std/src/io/stdio.rs:896:20:\nRefCell already borrowed\nnote: run with `RUST_BACKTRACE=1` environment variable to display a backtrace\n\nthread 'main' (10) panicked at …/library/core/src/panicking.rs:225:5:\npanic in a function that cannot unwind\nstack backtrace:\n  … (55 frames left out)\nthread caused non-unwinding panic. aborting.\nAborted   (exit status 134)";
  const KIDS = () => (mode === 2 ? [585, 586, 587] : [581, 582, 583]); /* each mode is its own run */
  const unsafeFile = () => fileC("tangle.rs", "", UNSAFE_RS, { name: "tangle.rs", cmd: LNX + " · ualarm declared in its own extern block" });
  const cv = code("#s855-code", { label: "The code", files: [unsafeFile()] });
  let mode = 0;
  let kids = [];
  function drawKids() {
    K.clear(stage);
    if (mode === 0) {
      const b = box(stage, 180, 60, 300, 90, "sv-panel", "SIGALRM handler", "shares the process", 15);
      b.t.setAttribute("y", 92);
      txt(stage, 330, 190, "println! and process::exit are not on the safe list. write and _exit are.", { cls: "sv-label" });
      return;
    }
    txt(stage, 36, 28, "children", { anchor: "start", cls: "sv-label" });
    kids.forEach((k, i) => {
      const b = box(stage, 36 + i * 200, 48, 180, 70, k === "zombie" ? "sv-bad" : k === "reaped" ? "sv-good" : "sv-panel", `pid ${KIDS()[i]}`, k, 14);
      b.t.setAttribute("y", b.y + 28);
    });
    txt(stage, 330, 160, `SIGCHLD pending bit: ${kids.includes("zombie") && kids.every((k) => k !== "reaped") ? "1" : "0"}`, { bold: true });
    txt(stage, 330, 190, "One bit no matter how many children exited.", { cls: "sv-label" });
  }
  function setMode(i) {
    mode = i;
    kids = ["running", "running", "running"];
    const files = [
      [unsafeFile()],
      [fileC("reaper.rs", "", ONE_RS, { name: "reaper.rs · one", cmd: LNX + " · excerpt" })],
      [fileC("reaper.rs", "", LOOP_RS, { name: "reaper.rs · loop", cmd: LNX + " · excerpt" })],
    ][i];
    cv.setFiles(files);
    drawKids();
    cv.calm();
    build();
    if (i === 0) cap("s855-cap", "This handler calls println! while main is printing too. Press the unsafe call to see what happened in our runs, then the safe version.");
    else cap("s855-cap", "Three children are running. Exit them all while SIGCHLD is blocked, then receive it. Watch the pending bit stay a single 1.");
  }
  function build() {
    const ctr = K.$("#s855-controls");
    K.clear(ctr);
    if (mode === 0) {
      button(ctr, "Show the unsafe call", "", () => {
        cv.setFiles([unsafeFile()]);
        cv.calm(); cv.at([2], "bad"); cv.at([9], "on2", false);
        cv.notes({ 2: ["not safe", "bad"], 9: "main holds stdout" });
        cv.out(TANGLE_OUT);
        cap("s855-cap", "Most runs finished, but 3 of our 37 Linux runs died. The signal landed while main’s <b>println!</b> was in the middle of a write. The handler’s println! found stdout’s buffer already in use and panicked, and a panic cannot leave an <span class=\"mono\">extern \"C\"</span> function, so Rust aborted the process. That is why a handler must not call println!.");
      });
      button(ctr, "Safe handler", "primary", () => {
        cv.setFiles([fileC("safe.rs", "", SAFE_RS, { name: "safe.rs", cmd: LNX + " · excerpt: main sets alarm(1), then prints a long line forever" })]);
        cv.calm(); cv.at([2, 3], "good");
        cv.notes({ 2: ["sio_puts → write", "good"], 3: ["_exit", "good"] });
        cv.out("…xxxx\nCaught SIGALRM!\n[exit status 0]");
        cap("s855-cap", "<b>sio_puts</b>, like the book’s Sio_puts, only calls write. <b>_exit</b> ends the process at once, without flushing buffers or running exit handlers. Main was printing a long line in a loop when the alarm fired, and the run still ended cleanly. Keep the handler tiny.");
      });
    } else {
      button(ctr, "All three exit", "primary", () => {
        kids = ["zombie", "zombie", "zombie"];
        drawKids();
        cv.calm();
        cv.notes({ 1: ["pending bit = 1", "warn"] });
        cv.out(null);
        cap("s855-cap", "Three children exited while SIGCHLD was blocked. The kernel still has <b>one</b> pending SIGCHLD. The bit does not count.");
      });
      button(ctr, "Receive SIGCHLD", "", () => {
        if (!kids.includes("zombie")) { cap("s855-cap", "Nothing pending. Press <b>All three exit</b> first."); return; }
        if (mode === 1) {
          kids = ["reaped", "zombie", "zombie"];
          drawKids();
          cv.calm(); cv.at([2], "bad");
          cv.notes({ 2: ["one reap, zombies remain", "bad"] });
          cv.out("reaped 1 of 3\n  581: gone\n  582: Z\n  583: Z");
          cap("s855-cap", "The handler reaped <b>one</b> child and returned. 582 and 583 are still zombies (state Z in /proc), and no second SIGCHLD is coming for them.");
        } else {
          kids = ["reaped", "reaped", "reaped"];
          drawKids();
          cv.calm(); cv.at([3, 4], "good");
          cv.notes({ 3: ["loop until -1", "good"], 6: "errno restored" });
          cv.out("reaped 3 of 3\n  585: gone\n  586: gone\n  587: gone");
          cap("s855-cap", "The loop called waitpid until it failed. All three were reaped in this one delivery. errno is saved and restored so the handler does not clobber the main program’s.");
        }
      });
      button(ctr, "Reset", "", () => setMode(mode));
    }
  }
  K.$("#s855-seg").appendChild(seg(["println! vs write", "Reap one", "Reap loop"], 0, setMode, "s855-mode"));
  setMode(0);
})();

/* ================= 8.5.6 ================= */
(function race() {
  const svg = K.$("#s856-svg");
  const list = box(svg, 40, 50, 250, 140, "sv-panel", "job list", "empty", 16);
  const child = box(svg, 370, 50, 250, 140, "sv-panel", "child", "not forked", 16);
  list.t.setAttribute("y", 90);
  child.t.setAttribute("y", 90);
  /* race.rs on Linux. A 300 ms sleep widens the window so the race happens on every run.
     The SIGCHLD handler reaps with waitpid and calls deletejob; JOBS is an array of atomics. */
  const RACE_RS = join([
    "let pid = unsafe { fork() };",
    "if pid == 0 { exec_date(); } // the child runs /bin/date",
    "std::thread::sleep(std::time::Duration::from_millis(300)); // widen the window",
    "addjob(pid); // race window above",
    "println!(\"job list after addjob({pid}): {:?}\", jobs()); // {:?}: debug form, [589]",
  ]);
  const FIX_RS = join([
    "unsafe { sigprocmask(SIG_BLOCK, &mask_one, &mut prev) };",
    "let pid = unsafe { fork() };",
    "if pid == 0 {",
    "    unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) };",
    "    exec_date();",
    "}",
    "std::thread::sleep(std::time::Duration::from_millis(300)); // same wide window",
    "addjob(pid);",
    "println!(\"job list after addjob({pid}): {:?}\", jobs());",
    "unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) };",
  ]);
  const cv = code("#s856-code", { label: "The code", files: [fileC("race.rs", "", RACE_RS, { name: "race.rs", cmd: LNX + " · excerpt" })] });
  let safe = false, step = 0;
  function paint() {
    cv.calm();
    if (!safe) {
      const frames = [
        { list: "empty", child: "not forked", lines: [1], cap: "The parent is about to fork. The job list does not know the child yet." },
        { list: "empty", child: "running pid 589", lines: [1, 2], tone: "warn", cap: "fork returned. The child, 589, is running /bin/date, and the list still does not contain it. This is the window." },
        { list: "empty", child: "exited · handler ran", lines: [3], tone: "bad", cap: "The child printed the date and exited during the window. SIGCHLD ran the handler: it reaped 589 and called <b>deletejob(589)</b> on an empty list. Nothing was removed." },
        { list: "[589] stuck", child: "gone, already reaped", lines: [4, 5], tone: "bad", out: "Tue Nov 17 04:49:16 UTC 2026\njob list after addjob(589): [589]\njob list at the end: [589]", cap: "<b>addjob(589)</b> records a job whose delete already happened. The entry is never removed: our run ended with [589]." },
      ];
      const f = frames[step];
      list.u.textContent = f.list;
      child.u.textContent = f.child;
      list.r.setAttribute("class", step === 3 ? "sv-bad" : "sv-panel");
      child.r.setAttribute("class", step >= 2 ? "sv-bad" : step === 1 ? "sv-data-soft" : "sv-panel");
      cv.at(f.lines, f.tone === "bad" ? "bad" : "on");
      cv.notes({ [f.lines[0]]: step === 3 ? ["never deleted", "bad"] : step === 2 ? ["deletejob missed", "bad"] : "window" });
      cv.out(f.out || null);
      cap("s856-cap", f.cap);
    } else {
      const frames = [
        { list: "empty", child: "not forked", lines: [1], cap: "SIGCHLD is blocked before fork. A fast child cannot run the handler yet." },
        { list: "empty", child: "pid 591, signal pending", lines: [2, 3, 4], cap: "The child inherits the blocked set, so it <b>unblocks</b> before it runs date. In the parent, SIGCHLD stays blocked. When the child exits, the bit stays pending." },
        { list: "[591]", child: "exited, not reaped yet", lines: [8, 9], tone: "good", out: "Tue Nov 17 04:49:17 UTC 2026\njob list after addjob(591): [591]", cap: "<b>addjob</b> runs while the handler is still blocked. The job is on the list before anyone can delete it." },
        { list: "[]  deleted", child: "reaped", lines: [10], tone: "good", out: "Tue Nov 17 04:49:17 UTC 2026\njob list after addjob(591): [591]\njob list at the end: []", cap: "The parent unblocks. The pending SIGCHLD is received, deletejob finds 591, and the list matches reality: our run ended with []." },
      ];
      const f = frames[step];
      list.u.textContent = f.list;
      child.u.textContent = f.child;
      list.r.setAttribute("class", step >= 2 ? "sv-good" : "sv-panel");
      child.r.setAttribute("class", step === 3 ? "sv-good" : "sv-panel");
      cv.at(f.lines, f.tone === "good" ? "good" : "on");
      cv.out(f.out || null);
      cap("s856-cap", f.cap);
    }
  }
  function setMode(i) {
    safe = i === 1;
    step = 0;
    cv.setFiles([safe ? fileC("race.rs", "", FIX_RS, { name: "race.rs · fixed", cmd: LNX + " · excerpt" }) : fileC("race.rs", "", RACE_RS, { name: "race.rs", cmd: LNX + " · excerpt" })]);
    paint();
  }
  K.$("#s856-seg").appendChild(seg(["Race", "Block SIGCHLD"], 0, setMode, "s856-mode"));
  const ctr = K.$("#s856-controls");
  button(ctr, "Step", "primary", () => { if (step < 3) { step++; paint(); } });
  button(ctr, "Reset", "", () => { step = 0; paint(); });
  setMode(0);
})();

/* ================= 8.5.7 ================= */
(function waitSig() {
  const svg = K.$("#s857-svg");
  const pidBox = box(svg, 36, 40, 160, 70, "sv-panel", "PID", "0", 16);
  const wait = box(svg, 230, 40, 180, 70, "sv-panel", "waiting", "—", 14);
  const gap = box(svg, 440, 40, 180, 70, "sv-panel", "gap", "none", 14);
  pidBox.t.setAttribute("y", 68); wait.t.setAttribute("y", 68); gap.t.setAttribute("y", 68);
  txt(svg, 330, 150, "SIGCHLD blocked until the wait. The handler stores the child’s pid.", { cls: "sv-label" });
  const status = txt(svg, 330, 190, "", { bold: true, size: 14 });
  /* waitsig.rs on Linux; alarm(3) is a watchdog that reports a stuck run */
  const RUSTS = [
    join([
      "unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) }; // unblock",
      "while PID.load(Ordering::Relaxed) == 0 { // load: read the atomic",
      "    spins += 1; // correct, wastes the core",
      "}",
    ]),
    join([
      "unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) }; // unblock",
      "while PID.load(Ordering::Relaxed) == 0 { // test sees 0",
      "    std::thread::sleep(std::time::Duration::from_millis(50)); // widen the gap",
      "    unsafe { pause() }; // signal already received: sleeps forever",
      "}",
    ]),
    join([
      "while PID.load(Ordering::Relaxed) == 0 { // SIGCHLD still blocked",
      "    unsafe { sigsuspend(&prev) }; // unblock + wait, one step",
      "}",
      "unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) };",
    ]),
  ];
  const OUTS = ["spin: pid 8, after 309390 spins", "3 s passed: still asleep in pause, the signal was missed", "suspend: pid 12, after 0 spins"];
  const PIDV = [8, 0, 12];
  const cv = code("#s857-code", { label: "The code", files: [fileC("waitsig.rs", "", RUSTS[0], { name: "waitsig.rs · spin", cmd: LNX + " · excerpt" })] });
  let mode = 0, pid = 0, stuck = false;
  function paint(msg) {
    pidBox.u.textContent = String(pid);
    pidBox.r.setAttribute("class", pid ? "sv-good" : "sv-panel");
    wait.r.setAttribute("class", stuck ? "sv-bad" : pid ? "sv-good" : "sv-data-soft");
    wait.u.textContent = stuck ? "stuck" : pid ? "done" : (mode === 0 ? "spinning" : "asleep");
    gap.r.setAttribute("class", mode === 1 ? "sv-bad" : "sv-good");
    gap.u.textContent = mode === 1 ? "between test and pause" : mode === 2 ? "no gap" : "no sleep";
    status.textContent = stuck ? "sleeping forever" : pid ? "handler ran, PID is set" : "waiting for SIGCHLD";
    cv.calm();
    if (stuck) { cv.at([2, 4], "bad"); cv.notes({ 4: ["missed it", "bad"] }); }
    else if (pid) { cv.at([mode === 2 ? 1 : 2], "good"); cv.notes({ [mode === 2 ? 1 : 2]: ["PID nonzero", "good"] }); }
    cap("s857-cap", msg);
  }
  function deliver() {
    if (stuck) { paint("pause already missed the signal. In our run the 3-second watchdog had to end it; this toy stays stuck to show the race."); return; }
    if (mode === 1) {
      stuck = true; pid = 0;
      paint("The handler ran in the gap and set PID, then pause began <b>after</b> that and slept: the signal was already received. Our run was still asleep when the 3-second watchdog fired.");
      pidBox.u.textContent = "set, too late";
      cv.out(OUTS[1]);
      return;
    }
    pid = PIDV[mode];
    paint(mode === 0
      ? "The spin loop saw PID become nonzero and stopped. Correct, and it burned the CPU the whole time: 309,390 trips round the loop in our run."
      : "sigsuspend atomically unblocked and waited. The pending SIGCHLD ran the handler at once and sigsuspend returned. There is no gap.");
    cv.out(OUTS[mode]);
  }
  function setMode(i) {
    mode = i; pid = 0; stuck = false;
    cv.setFiles([fileC("waitsig.rs", "", RUSTS[i], { name: "waitsig.rs · " + ["spin", "pause", "sigsuspend"][i], cmd: LNX + " · excerpt" })]);
    cv.out(null);
    paint(["The spin loop is correct and wasteful. Press deliver.", "Unblock, test, then pause. We widened the gap with a 50 ms sleep so the race happens every run. Press deliver to hit it.", "The test happens while SIGCHLD is still blocked. sigsuspend opens that window atomically."][i]);
  }
  K.$("#s857-seg").appendChild(seg(["Spin", "pause", "sigsuspend"], 0, setMode, "s857-mode"));
  const ctr = K.$("#s857-controls");
  button(ctr, "Deliver SIGCHLD", "primary", deliver);
  button(ctr, "Reset", "", () => setMode(mode));
  setMode(0);
})();

/* ================= 8.6 ================= */
(function jumps() {
  const svg = K.$("#s86-svg");
  const stage = s("g");
  svg.appendChild(stage);
  /* jumps.rs and restart.rs on Linux. Buf's Drop prints when a frame's buffer is freed. */
  const RESULT_RS = join([
    "fn bar() -> Result<(), Error> {",
    "    let _b = Buf(\"bar\"); // Buf: our type whose Drop (cleanup code) prints \"freed\"",
    "    Err(Error::Error2) // the error, as a value",
    "}",
    "fn foo() -> Result<(), Error> {",
    "    let _b = Buf(\"foo\");",
    "    bar()?; // ?: on Err, return it from foo at once",
    "    println!(\"  never printed\");",
    "    Ok(())",
    "}",
    "match foo() { // in main. match: pick by value",
    "    Ok(()) => println!(\"main: ok\"),",
    "    Err(e) => println!(\"main: {e:?} in foo\"),",
    "}",
  ]);
  const PANIC_RS = join([
    "fn pfoo() { let _b = Buf(\"foo\"); pbar(); }",
    "fn pbar() { let _b = Buf(\"bar\"); panic!(\"error2 in bar\"); }",
    "",
    "let r = std::panic::catch_unwind(pfoo); // in main: stop the unwind here",
    "println!(\"main: caught = {}\", r.is_err());",
  ]);
  const RESTART_RS = join([
    "static RESTART: AtomicBool = AtomicBool::new(false);",
    "extern \"C\" fn handler(_sig: c_int) {",
    "    RESTART.store(true, Ordering::Relaxed); // only raise a flag",
    "}",
    "fn main() {",
    "    unsafe { signal(SIGINT, handler) };",
    "    let mut round = 0;",
    "    loop { // each pass is one fresh start",
    "        if round == 0 { sio_puts(\"starting\\n\"); } else { sio_puts(\"restarting\\n\"); }",
    "        RESTART.store(false, Ordering::Relaxed);",
    "        for step in 1.. { // 1..: 1, 2, 3, ... with no end",
    "            if RESTART.load(Ordering::Relaxed) { break; } // Ctrl+C: start over",
    "            if step == 2 && round == 0 { unsafe { raise(SIGINT) }; } // stand-in for Ctrl+C",
    "            if step == 3 { sio_puts(\"processing done\\n\"); return; }",
    "            sio_puts(\"processing...\\n\");",
    "        }",
    "        round += 1;",
    "    }",
    "}",
  ]);
  const MODES = [
    { file: () => fileC("jumps.rs", "", RESULT_RS, { name: "jumps.rs · Result", cmd: LNX + " · excerpt" }),
      frames: [{ name: "main", sub: "calls foo" }, { name: "foo", sub: "calls bar" }, { name: "bar", sub: "returns Err" }, { name: "main", sub: "got Err(Error2)" }],
      lines: [11, 7, 3, 13],
      outs: [null, null, "  freed bar's buffer", "  freed bar's buffer\n  freed foo's buffer\nmain: Error2 in foo"],
      caps: [
        "main calls <b>foo</b> and will <b>match</b> on what comes back: Ok or Err.",
        "foo made a buffer and called <b>bar</b>. The stack is main, foo, bar.",
        "bar returned <b>Err(Error2)</b>, a plain value. Leaving bar freed its buffer.",
        "In foo, <b>?</b> saw the Err and returned it at once, skipping the rest of foo. foo’s buffer was freed on the way out. main matched Err. Nothing leaked, and every frame was left in order.",
      ] },
    { file: () => fileC("jumps.rs", "", PANIC_RS, { name: "jumps.rs · panic", cmd: LNX + " · excerpt" }),
      frames: [{ name: "main", sub: "catch_unwind" }, { name: "pfoo", sub: "calls pbar" }, { name: "pbar", sub: "panic!" }, { name: "main", sub: "caught = true" }],
      lines: [4, 1, 2, 5],
      outs: [null, null, "thread 'main' (8) panicked at jumps.rs:20:34:\nerror2 in bar", "thread 'main' (8) panicked at jumps.rs:20:34:\nerror2 in bar\nnote: run with `RUST_BACKTRACE=1` environment variable to display a backtrace\n  freed bar's buffer\n  freed foo's buffer\nmain: caught = true"],
      caps: [
        "main calls pfoo through <b>catch_unwind</b>, which marks where an unwinding panic should stop.",
        "pfoo made a buffer and called <b>pbar</b>.",
        "pbar <b>panicked</b>. Rust printed the message, then began to unwind: leave each frame, freeing what it owns.",
        "Unwinding freed bar’s buffer, then foo’s, and stopped in main: <b>catch_unwind</b> returned Err. A nonlocal jump that still cleans up. std says not to use it as a general try/catch.",
      ] },
    { file: () => fileC("restart.rs", "", RESTART_RS, { name: "restart.rs", cmd: LNX }),
      frames: [{ name: "handler", sub: "installed" }, { name: "starting", sub: "round 0" }, { name: "processing", sub: "steps 1, 2" }, { name: "Ctrl+C", sub: "flag → restart" }],
      lines: [6, 9, 15, 12],
      outs: [null, "starting", "starting\nprocessing...", "starting\nprocessing...\nprocessing...\nrestarting\nprocessing...\nprocessing...\nprocessing done"],
      caps: [
        "The handler is installed first. It does one thing: set an atomic flag. No jump from inside the handler.",
        "The loop starts round 0 and prints starting.",
        "Processing runs. Each step first checks the flag.",
        "SIGINT arrived (our run raised it itself as a stand-in for Ctrl+C). The handler set the flag and returned; the next check saw it, broke out, and the loop started again: restarting. The book jumps back with siglongjmp; here main walks back on its own.",
      ] },
  ];
  let mode = 0, step = 0;
  function paint() {
    K.clear(stage);
    const M = MODES[mode];
    M.frames.forEach((f, i) => {
      const on = i === step;
      const done = i < step;
      const b = box(stage, 36 + i * 155, 70, 140, 80, on ? "sv-good" : done ? "sv-data-soft" : "sv-panel", f.name, f.sub, 14);
      b.t.setAttribute("y", b.y + 30);
    });
    cv.calm();
    cv.at([M.lines[step]], step === 3 ? "good" : "on");
    cv.out(M.outs[step]);
    cap("s86-cap", M.caps[step]);
  }
  const cv = code("#s86-code", { label: "The code", files: [MODES[0].file()] });
  function setMode(i) {
    mode = i; step = 0;
    cv.setFiles([MODES[i].file()]);
    paint();
  }
  K.$("#s86-seg").appendChild(seg(["Result and ?", "panic", "Ctrl+C restart"], 0, setMode, "s86-mode"));
  const ctr = K.$("#s86-controls");
  button(ctr, "Step", "primary", () => { if (step < 3) { step++; paint(); } });
  button(ctr, "Reset", "", () => setMode(mode));
  setMode(0);
})();

/* ================= 8.7 ================= */
(function tools() {
  const svg = K.$("#s87-svg");
  /* job.rs on Linux: a parent, a busy child, and a child that exited and was never waited for */
  const rows = [
    { name: "job", pid: "7", st: "S" },
    { name: "job busy", pid: "9", st: "R" },
    { name: "job", pid: "10", st: "Z" },
  ];
  txt(svg, 36, 28, "PROCESS TABLE · OUR LINUX RUN", { anchor: "start", cls: "sv-label" });
  const boxes = rows.map((r, i) => box(svg, 36 + i * 200, 44, 180, 70, r.st === "Z" ? "sv-bad" : "sv-panel", `${r.pid} ${r.name}`, r.st === "Z" ? "zombie" : r.st === "R" ? "running" : "sleeping", 14));
  boxes.forEach((b) => b.t.setAttribute("y", b.y + 28));
  const TOOLS = {
    ps: {
      cmd: "linux> ps -o pid,stat,cmd",
      out: "    PID STAT CMD\n      7 S    n/job\n      9 R    /w/n/job busy\n     10 Z    [job] <defunct>",
      cap: "<b>ps</b> lists processes, zombies included. STAT Z, <defunct>, is the child our job never waited for.",
      hi: 2,
    },
    top: {
      cmd: "linux> top -b -n 1",
      out: "    PID USER   S  %CPU COMMAND\n      9 root   R 100.0 job\n      7 root   S   0.0 job\n     10 root   Z   0.0 job",
      cap: "<b>top</b> shows who is using the machine. The busy child is at 100% of a core; the zombie holds a table slot and no CPU. (Columns trimmed.)",
      hi: 1,
    },
    pmap: {
      cmd: "linux> pmap 9",
      out: "9:   /w/n/job busy\n0000aaaab09e0000    340K r-x-- job\n0000aaaab0a4d000     12K r---- job\n0000aaaab0a50000      4K rw--- job\n0000aaaadd342000    132K rw---   [ anon ]\n0000ffff98d60000   1648K r-x-- libc.so.6",
      cap: "<b>pmap</b> prints the memory map: our code (r-x), its data (rw-), the heap, the C library. That is Figure 8.13 as a tool. This Linux run was on arm64, so the addresses are not x86-64’s.",
      hi: 1,
    },
    strace: {
      cmd: "linux> strace -f -e trace=process n/job",
      out: "clone3({flags=CLONE_VM|CLONE_VFORK|CLONE_CLEAR_SIGHAND, exit_signal=SIGCHLD, …}) = 12\n[pid 12] execve(\"/w/n/job\", [\"/w/n/job\", \"busy\"], …) = 0\nclone3({flags=CLONE_VM|CLONE_VFORK|CLONE_CLEAR_SIGHAND, …}) = 13\n[pid 13] execve(\"/w/n/job\", [\"/w/n/job\", \"quick\"], …) = 0\n[pid 13] exit_group(0) = ?\nkill(12, SIGKILL) = 0\nwait4(12, [{WIFSIGNALED(s) && WTERMSIG(s) == SIGKILL}], 0, NULL) = 12",
      cap: "<b>strace</b> prints each system call (a separate run, so new PIDs). Command::spawn is clone3 plus execve; Child::kill is kill with SIGKILL; Child::wait is wait4. Linking with <span class=\"mono\">-C target-feature=+crt-static</span> shortened forkx’s trace from 80 lines to 49.",
      hi: 1,
    },
    proc: {
      cmd: "linux> cat /proc/loadavg; grep State /proc/10/status",
      out: "1.92 1.10 0.83 2/2369 19\nState:\tZ (zombie)",
      cap: "<b>/proc</b> is kernel state as text. loadavg is the load. <span class=\"mono\">/proc/10/status</span> says State: Z, the zombie.",
      hi: 2,
    },
  };
  const cv = code("#s87-code", { label: "The code", files: [{ name: "tool.sh", lang: "sh", src: "linux> ps -o pid,stat,cmd", rsNote: "run on Linux, against job.rs" }] });
  function run(key) {
    const t = TOOLS[key];
    boxes.forEach((b, i) => b.r.setAttribute("class", i === t.hi ? "sv-good" : rows[i].st === "Z" ? "sv-bad" : "sv-panel"));
    cv.src("tool.sh", t.cmd);
    cv.calm();
    cv.at([1]);
    cv.out(t.out);
    pill("s87-pill", key);
    cap("s87-cap", t.cap);
  }
  const ctr = K.$("#s87-controls");
  Object.keys(TOOLS).forEach((key, i) => button(ctr, key === "proc" ? "/proc" : key, i === 0 ? "primary" : "", () => run(key)));
  run("ps");
})();

/* ================= 8.8 ================= */
(function summary() {
  const svg = K.$("#s88-svg");
  const LAYERS = [
    { name: "Application", sub: "signals, panics, Result", file: "restart.rs", rs: join(["extern \"C\" fn handler(_sig: c_int) {", "    RESTART.store(true, Ordering::Relaxed); // only raise a flag", "}"]), cmd: LNX, cap: "At the top, a program catches a signal, or returns an error up through its frames. The process stays the same; the control flow inside it does not." },
    { name: "Kernel", sub: "processes, switches", file: "sched.rs (sketch)", rs: join(["fn schedule(current: &mut Process) {", "    save(current);", "    *current = pick(); // *current: the value it points at", "    restore(current);", "}"]), cmd: "", cap: "In the middle, the kernel uses exceptions to build processes: save one context, restore another, deliver signals, reap zombies." },
    { name: "Hardware", sub: "exceptions, syscall", file: "hello.s", asm: join(["    mov    $0x1,%eax            # write is system call 1", "    syscall                     # trap into the kernel"]), cap: "At the bottom, the processor indexes the exception table and runs a handler. Interrupts, traps, faults, and aborts are this mechanism; here is the trap in rustc’s hello." },
  ];
  const cards = LAYERS.map((L, i) => box(svg, 36, 24 + i * 70, 420, 58, "sv-panel", L.name, L.sub, 15));
  cards.forEach((b) => b.t.setAttribute("y", b.y + 24));
  const fileOf = (L) => L.asm ? { name: L.file, lang: "asm", src: L.asm, rsNote: "two lines of hello.s · rustc 1.100.0 -C opt-level=1, x86-64 Linux" } : fileC(L.file, "", L.rs, { name: L.file, cmd: L.cmd });
  const cv = code("#s88-code", { label: "The code", files: [fileOf(LAYERS[2])] });
  function pick(i) {
    cards.forEach((b, k) => b.r.setAttribute("class", k === i ? "sv-good" : "sv-panel"));
    const L = LAYERS[i];
    cv.setFiles([fileOf(L)]);
    cv.at([1, 2], "good");
    pill("s88-pill", L.name);
    cap("s88-cap", L.cap);
  }
  cards.forEach((b, i) => {
    const g = s("g");
    svg.appendChild(g);
    g.appendChild(b.r); if (b.t) g.appendChild(b.t); if (b.u) g.appendChild(b.u);
    clickable(g, LAYERS[i].name, () => pick(i));
  });
  const ctr = K.$("#s88-controls");
  LAYERS.forEach((L, i) => button(ctr, L.name, i === 2 ? "primary" : "", () => pick(i)));
  pick(2);
})();

K.quiz(K.$("#quiz-root"), [
  { q: "A timer interrupt handler finishes. Where does it return?", options: ["Always to the next instruction (Inext)", "Always to the faulting instruction (Icurr)", "It never returns", "Wherever rustc left the return address in %rbx"], answer: 0, why: "An interrupt is asynchronous and the handler returns to the next instruction, as if the program had not been interrupted." },
  { q: "A Rust program divides an i32 by a zero it read at run time. What happens?", options: ["The processor faults and Linux sends SIGFPE", "The result is 0", "The division is retried", "Rust checks the divisor first and panics"], answer: 3, why: "Rust checks every integer divisor before dividing, in every build. Our run panicked with “attempt to divide by zero” and exit status 101; the processor never divided, so there was no SIGFPE." },
  { q: "In Figure 8.12, B finishes before C starts. Which statement is true?", options: ["B and C run concurrently", "B and C are parallel", "B and C do not run concurrently", "A does not overlap anyone"], answer: 2, why: "Concurrent means the lifetimes overlap. B is finished when C begins, so that pair does not overlap. A overlaps both." },
  { q: "How does user code enter kernel mode?", options: ["Only through an exception, such as a system call or a fault", "By writing the mode bit", "By calling a function in the kernel’s address range", "By reading /proc without a system call"], answer: 0, why: "The mode bit changes to kernel mode when an exception occurs. Our hlt and our read of a kernel address both faulted; reading /proc/cpuinfo went through a system call." },
  { q: "fork returns. What is true?", options: ["It returns the child’s PID in both processes", "It returns once, in the parent only", "It replaces the program, like execve", "It returns 0 to the child and the child’s PID to the parent"], answer: 3, why: "fork is called once and returns twice. The child receives 0. execve is the call that replaces the program and does not return on success." },
  { q: "A Rust program spawns a child with Command, the child exits, and the program drops the Child without waiting. What is the child?", options: ["A zombie: terminated, still occupying a kernel slot", "Reaped automatically when the Child is dropped", "Still running", "Killed by Rust with SIGKILL"], answer: 0, why: "std never waits on its own, not even when a Child is dropped. A terminated child nobody waited for is a zombie, as ps showed for our job’s quick child." },
  { q: "Two SIGINT signals arrive while the first is still pending. How many will be received?", options: ["Two", "None, SIGINT cannot be pending", "One", "Thirty, one per signal type"], answer: 2, why: "Pending is a bit per signal type. A second signal of the same type is discarded while the first is still pending. Our run raised SIGINT three times while blocked; the handler ran once." },
  { q: "Ctrl+C is typed. Who receives SIGINT?", options: ["Only the shell", "Every process on the machine", "Only PID 1", "Every process in the foreground process group"], answer: 3, why: "The kernel sends SIGINT to the foreground process group, not to background jobs and not to the shell’s own group." },
  { q: "Why should a Rust signal handler not call println!?", options: ["println! is not async-signal-safe: if main was printing, the handler can find stdout in use", "println! is slower than write", "Handlers cannot see stdout", "println! needs unsafe"], answer: 0, why: "println! locks stdout’s shared buffer. In 3 of our 37 runs the signal landed mid-print; the handler’s println! panicked, and the panic aborted the process because it cannot leave an extern \"C\" function." },
  { q: "Why is calling C’s setjmp and longjmp from Rust unsound?", options: ["They are too slow", "rustc cannot be told setjmp returns twice, and longjmp skips the cleanup of the frames it throws away", "Rust has no pointers", "They only work in debug builds"], answer: 1, why: "C compilers treat setjmp specially; rustc has no stable way to do so. The Rust Reference names longjmp as a way to break the rule that frames run their destructors. Result with ?, or a panic, does the job safely." },
], 8);
