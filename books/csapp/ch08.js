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
const CODE_LANG = (() => {
  let v = "c";
  try { if (new URLSearchParams(location.search).get("code") === "rust") v = "rust"; } catch (e) {}
  const subs = [];
  return {
    get v() { return v; },
    get rust() { return v === "rust"; },
    on(fn) { subs.push(fn); },
    set(nv) {
      if (nv === v) return;
      v = nv;
      try {
        const u = new URL(location.href);
        if (v === "rust") u.searchParams.set("code", "rust"); else u.searchParams.delete("code");
        history.replaceState(null, "", u);
      } catch (e) {}
      subs.forEach((fn) => fn(v));
    },
  };
})();
function langToggle() {
  const wrap = h("div", { class: "cp-lang", role: "group", "aria-label": "Show the code in C or Rust" });
  [["c", "C"], ["rust", "Rust"]].forEach(([k, label]) => {
    const b = h("button", { type: "button", "data-lang": k, "aria-pressed": String(CODE_LANG.v === k) }, label);
    b.addEventListener("click", () => CODE_LANG.set(k));
    wrap.appendChild(b);
  });
  CODE_LANG.on((nv) => wrap.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === nv))));
  return wrap;
}
document.querySelector(".first").appendChild(langToggle());
{ const pre = document.getElementById("rust-prelude"); const sync = () => { pre.hidden = !CODE_LANG.rust; }; CODE_LANG.on(sync); sync(); }
function fileC(name, csrc, rsrc, rsName) {
  const rustName = rsName || (/\.c$/.test(name) ? name.replace(/\.c$/, ".rs") : name + ".rs");
  return { name, lang: "c", src: csrc, rs: { name: rustName, src: rsrc, map: "same", cmd: "" } };
}
function code(sel, o) {
  const root = K.$(sel);
  root.className = "codepane";
  const tabs = h("div", { class: "cp-tabs" });
  const cmd = h("span", { class: "cp-cmd" });
  root.appendChild(h("div", { class: "cp-head" }, h("span", { class: "cp-k" }, o.label || "The code"), tabs, langToggle(), cmd));
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
    if (f.lang === "asm") return "x86-64 from the book. The machine steps these instructions";
    if (f.lang === "sh") return "the book's shell command. rustc is not this driver";
    if (f.lang === "text") return "the book's description, not a C or Rust program";
    return "the same in C and Rust";
  }
  function view() {
    if (CODE_LANG.rust && cur.rs) return { lang: "rust", src: cur.rs.src, cmd: cur.rs.cmd || cur.cmd || "" };
    if (CODE_LANG.rust) {
      const note = noteFor(cur);
      const base = cur.cmd || "";
      return { lang: cur.lang, src: cur.src, cmd: base ? base + "  ·  " + note : note };
    }
    return { lang: cur.lang, src: cur.src, cmd: cur.cmd || "" };
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
(function hero() {
  const svg = K.$("#hero-svg");
  const INS = ["mov", "add", "store", "ret"];
  txt(svg, 330, 28, "USER CODE", { cls: "sv-label" });
  const boxes = INS.map((name, i) => box(svg, 36 + i * 150, 48, 120, 52, "sv-panel", name, "0x40000" + i, 14));
  const kernel = box(svg, 210, 150, 240, 48, "sv-server", "kernel handler", "timer interrupt");
  const pc = s("circle", { r: 7, class: "sv-fill-sun" });
  svg.appendChild(pc);
  const cv = code("#hero-code", {
    label: "The code",
    files: [
      { name: "loop.s", lang: "asm", src: join(["mov  $1, %eax", "add  $1, %eax", "mov  %eax, count", "ret"]) },
      { name: "handler.s", lang: "asm", src: join(["timer:", "    # save the interrupted process", "    iret          # back to the next instruction"]) },
    ],
  });
  let i = 0;
  function show(n) {
    i = n;
    boxes.forEach((b, k) => b.r.setAttribute("class", "sv-panel"));
    kernel.r.setAttribute("class", "sv-server");
    cv.calm();
    if (n < 4) {
      boxes[n].r.setAttribute("class", "sv-good");
      pc.setAttribute("cx", boxes[n].cx);
      pc.setAttribute("cy", boxes[n].cy);
      cv.show("loop.s");
      cv.at([n + 1]);
      pill("hero-pill", "smooth");
      cap("hero-cap", n === 0
        ? "The program counter holds the address of <b>mov</b>. The next instruction sits right after it."
        : `Smooth step ${n + 1}. Nothing yanked the walk — the next address is just past this instruction.`);
    } else {
      kernel.r.setAttribute("class", "sv-good");
      pc.setAttribute("cx", kernel.cx);
      pc.setAttribute("cy", kernel.cy);
      cv.show("handler.s");
      cv.at([1, 2]);
      pill("hero-pill", "exception");
      cap("hero-cap", "A timer event yanks the walk into the <b>kernel</b>. That yank is an exception. <b>iret</b> can bring it back to user code.");
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
  const MODES = [
    {
      name: "Smooth",
      ins: [
        { a: "0x400000", t: "mov", n: "+3" },
        { a: "0x400003", t: "add", n: "+4" },
        { a: "0x400007", t: "store", n: "+3" },
        { a: "0x40000a", t: "ret", n: "done" },
      ],
      src: join(["mov  $1, %edi          # 3 bytes", "add  %edi, %eax        # 4 bytes", "mov  %eax, (glob)     # 3 bytes", "ret"]),
      file: "smooth.s",
      rule: "next = this address + this instruction’s length",
    },
    {
      name: "Jump",
      ins: [
        { a: "0x400000", t: "mov", n: "+3" },
        { a: "0x400003", t: "cmp", n: "+4" },
        { a: "0x400007", t: "jmp", n: "→ 0x400020" },
        { a: "0x400020", t: "target", n: "done" },
      ],
      src: join(["mov  $1, %edi", "cmp  $0, %edi", "jmp  target           # the program asked for this", "target:", "ret"]),
      file: "jump.s",
      lines: [1, 2, 3, 5],
      rule: "the instruction itself names a new address",
    },
    {
      name: "Exception",
      ins: [
        { a: "0x400000", t: "mov", n: "+3" },
        { a: "0x400003", t: "add", n: "event!" },
        { a: "kernel", t: "handler", n: "not in the program" },
        { a: "0x400007", t: "store", n: "maybe later" },
      ],
      src: join(["mov  $1, %edi", "add  %edi, %eax        # timer fires here", "mov  %eax, (glob)     # not next, until the handler says so"]),
      file: "user.s",
      lines: [1, 2, 2, 3],
      rule: "an event chooses an address the program did not write",
    },
  ];
  const pcs = [];
  const layer = s("g");
  svg.appendChild(layer);
  const cv = code("#s81-code", { label: "The code", files: [{ name: "smooth.s", lang: "asm", src: MODES[0].src }] });
  const st = useStats("s81-stats", ["PC", "Rule"]);
  let mode = 0, step = 0;
  function paint() {
    const M = MODES[mode];
    K.clear(layer);
    pcs.length = 0;
    M.ins.forEach((ins, i) => {
      const b = box(layer, 28 + (i % 4) * 158, 36, 142, 64, i === step ? "sv-good" : "sv-panel", ins.t, ins.a, 14);
      txt(layer, b.cx, 124, ins.n, { cls: "sv-label", size: 12 });
      pcs.push(b);
    });
    txt(layer, 330, 168, M.rule, { size: 14, bold: true });
    txt(layer, 330, 210, mode === 2 && step === 2 ? "The handler address comes from the exception table, not from this listing." : "Press Step. The highlighted box is where the program counter is.", { cls: "sv-label" });
    cv.show(M.file);
    const line = (M.lines || [1, 2, 3, 4])[step];
    cv.calm();
    if (line) cv.at([line], mode === 2 && step === 2 ? "bad" : "on");
    cv.notes(line ? { [line]: M.ins[step].n } : {});
    st.PC.set(M.ins[step].a, step === 2 && mode === 2 ? "bad" : "good");
    st.Rule.set(mode === 0 ? "smooth" : mode === 1 ? "program" : "event");
    cap("s81-cap", `<b>${M.name}.</b> PC is <span class="mono">${M.ins[step].a}</span>. ${M.rule}.`);
  }
  function load(i) {
    mode = i; step = 0;
    const M = MODES[i];
    cv.setFiles([{ name: M.file, lang: "asm", src: M.src }]);
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
    files: [fileC("dispatch.c", join([
        "struct gate exception_table[256];",
        "",
        "void on_event(int k) {          /* hardware */",
        "    void (*h)(void) = exception_table[k];",
        "    switch_to_kernel_mode();",
        "    h();                         /* the handler */",
        "    /* return to Icurr, Inext, or not at all */",
        "}",
      ]), join([
      "static EXCEPTION_TABLE: [fn(); 256] = [nop; 256];",
      " ",
      "fn on_event(k: usize) {",
      "    let h = EXCEPTION_TABLE[k];",
      "    switch_to_kernel_mode();",
      "    h();",
      "    // return to Icurr, Inext, or not at all",
      "}",
      "fn nop() {}",
      "fn switch_to_kernel_mode() {}",
    ]))],
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
    files: [fileC("classes.c", join([
        "/* where does the handler return? */",
        "",
        "/* interrupt: timer, disk, network */",
        "resume = Inext;",
        "",
        "/* trap: the program asked, via syscall */",
        "resume = Inext;",
        "",
        "/* fault: page not in memory, maybe */",
        "resume = handler_fixed_it ? Icurr : abort_process();",
        "",
        "/* abort: machine check */",
        "resume = nowhere;",
      ]), join([
        "// where does the handler return?",
        "",
        "// interrupt: timer, disk, network",
        "let mut resume = Resume::Next;",
        "",
        "// trap: the program asked, via syscall",
        "resume = Resume::Next;",
        "",
        "// fault: page not in memory, maybe",
        "resume = if handler_fixed_it { Resume::Curr } else { abort_process() };",
        "",
        "// abort: machine check",
        "resume = Resume::Nowhere;",
      ]))],
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
  const shell = box(svg, 260, 40, 370, 70, "sv-db", "shell", "waiting");
  shell.t.setAttribute("y", 66);
  const table = txt(svg, 445, 140, "", { mono: true, size: 13, bold: true });
  txt(svg, 445, 168, "exception number → class → what Linux does", { cls: "sv-label" });
  const CASES = {
    div: { n: "0", cls: "Fault", linux: "fatal · Floating exception", regs: ["—", "—", "—", "—"], file: "fault.c", lines: [3], note: ["SIGFPE later", "bad"], shell: "Floating exception", tone: "bad" },
    gpf: { n: "13", cls: "Fault", linux: "fatal · Segmentation fault", regs: ["—", "—", "—", "—"], file: "fault.c", lines: [7], note: ["SIGSEGV later", "bad"], shell: "Segmentation fault", tone: "bad" },
    pf: { n: "14", cls: "Fault", linux: "map page, retry Icurr", regs: ["—", "—", "—", "—"], file: "fault.c", lines: [11, 12], note: ["retry Icurr", "good"], shell: "(no message — it recovers)", tone: "good" },
    mc: { n: "18", cls: "Abort", linux: "machine check, no return", regs: ["—", "—", "—", "—"], file: "fault.c", lines: [15], note: ["does not return", "bad"], shell: "machine check", tone: "bad" },
    write: { n: "syscall 1", cls: "Trap", linux: "write, then Inext", regs: ["1", "1", "&msg", "13"], file: "hello.s", lines: [1, 2, 3, 4, 5], note: ["%rax = 1", "good"], shell: "hello, world", tone: "good" },
  };
  const cv = code("#s813-code", {
    label: "The code",
    tabs: true,
    files: [
      fileC("fault.c", join([
        "int divide(void) {",
        "    int x = 1;",
        "    return x / 0;              /* exception 0 */",
        "}",
        "int protect(void) {",
        "    int *p = (int *)0x1;",
        "    return *p;                 /* exception 13 */",
        "}",
        "int page(char fresh_page[]) {",
        "    /* missing page: exception 14 */",
        "    return fresh_page[0];      /* handler retries this */",
        "}",
        "void machine_check(void) {",
        "    /* exception 18, hardware abort */",
        "}",
      ]), join([
        "fn divide() -> i32 {",
        "    let x = 1i32;",
        "    return x / std::hint::black_box(0); // Rust panics before the CPU can fault (C: exception 0)",
        "}",
        "fn protect() -> i32 {",
        "    let p = 0x1 as *const i32;",
        "    return unsafe { *p }; // exception 14: address 1 is unmapped (a debug build panics on alignment first)",
        "}",
        "fn page(fresh_page: &[u8]) -> u8 {",
        "    // missing page: exception 14",
        "    return fresh_page[0]; // handler retries this",
        "}",
        "fn machine_check() {",
        "    // exception 18, hardware abort",
        "}",
      ])),
      { name: "hello.s", lang: "asm", src: join([
        "mov  $1, %rax        # write",
        "mov  $1, %rdi        # stdout",
        "mov  $msg, %rsi",
        "mov  $13, %rdx       # 13 bytes",
        "syscall              # trap",
        "mov  $60, %rax       # _exit",
        "mov  $0, %rdi",
        "syscall",
      ]) },
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
    cv.at(c.lines, c.tone === "bad" ? "bad" : "good");
    cv.notes({ [c.lines[0]]: c.note });
    if (key === "write") cv.out("hello, world");
    else cv.out(c.shell);
    cap("s813-cap", `<b>Exception ${c.n}</b> is a ${c.cls}. Linux: ${c.linux}.` + (key === "write" ? " A return in %rax from −4095 to −1 would be −errno." : ""));
  }
  const ctr = K.$("#s813-controls");
  button(ctr, "Divide by 0", "", () => run("div"));
  button(ctr, "Bad address", "", () => run("gpf"));
  button(ctr, "Page fault", "primary", () => run("pf"));
  button(ctr, "Machine check", "", () => run("mc"));
  button(ctr, "syscall write", "", () => run("write"));
  cap("s813-cap", "Numbers 0–31 are the processor’s. 32–255 belong to the operating system. Press an example.");
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
    files: names.map((name) => fileC(name + ".c",
      join([`/* process ${name} — believes it is alone */`, "int main(void) {", "    for (;;) work();   /* my logical flow */", "}"]),
      join([`// process ${name} — believes it is alone`, "fn main() {", "    loop { work(); } // my logical flow", "}", "fn work() {}"]))),
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
    fileC("A.c", join(["puts(\"A1\");", "puts(\"A2\");   /* A's whole logical flow */"]), join(["println!(\"A1\");", "println!(\"A2\"); // A's whole logical flow"])),
    fileC("B.c", join(["puts(\"B1\");", "puts(\"B2\");   /* B runs to completion */"]), join(["println!(\"B1\");", "println!(\"B2\"); // B runs to completion"])),
    fileC("C.c", join(["puts(\"C1\");", "puts(\"C2\");"]), join(["println!(\"C1\");", "println!(\"C2\");"])),
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
    files: [fileC("overlap.c", "", "")],
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
    const src = join([
      "int overlaps(int s1, int e1, int s2, int e2) {",
      "    return s1 < e2 && s2 < e1;",
      "}",
      "int is_parallel(int overlap, int cores) {",
      "    return overlap && cores > 1;",
      "}",
      `/* A[${span.A[0]},${span.A[1]}) B[${span.B[0]},${span.B[1]}) C[${span.C[0]},${span.C[1]}) */`,
    ]);
    const rsrc = join([
      "fn overlaps(s1: i32, e1: i32, s2: i32, e2: i32) -> bool {",
      "    s1 < e2 && s2 < e1",
      "}",
      "fn is_parallel(overlap: bool, cores: i32) -> bool {",
      "    overlap && cores > 1",
      "}",
      `// A[${span.A[0]},${span.A[1]}) B[${span.B[0]},${span.B[1]}) C[${span.C[0]},${span.C[1]})`,
    ]);
    cv.src("overlap.c", src, { rs: { src: rsrc } });
    cv.calm();
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
  const REG = [
    { k: "kernel", d: "Invisible to user code. A direct touch is a protection fault.", line: 12, cls: "sv-bad" },
    { k: "stack", d: "Grows down. Local variables and return addresses.", line: 8, cls: "sv-data-soft" },
    { k: "libs", d: "Shared libraries, mapped into the space.", line: 9, cls: "sv-panel" },
    { k: "heap", d: "Grows up when malloc asks for memory.", line: 7, cls: "sv-data-soft" },
    { k: "data", d: "Globals: .data and .bss, loaded from the executable.", line: 3, cls: "sv-panel" },
    { k: "code", d: "Read-only code. On x86-64 Linux it begins at 0x400000.", line: 5, cls: "sv-server" },
  ];
  const SRC = join([
    "int global = 1;                 /* data */",
    "",
    "int main(void) {                /* code, from 0x400000 */",
    "    int local = 2;              /* stack */",
    "    char *p = malloc(100);      /* heap */",
    "    printf(\"%d\", global);      /* shared library */",
    "    free(p);",
    "    return 0;",
    "}",
    "/* kernel virtual memory is not a variable you can name */",
  ]);
  /* line map: data 1, code 3, stack 4, heap 5, libs 6, kernel 10 */
  const LINE = { data: 1, code: 3, stack: 4, heap: 5, libs: 6, kernel: 10 };
  const MAP_RS = join([
    "static mut GLOBAL: i32 = 1; // data",
    " ",
    "fn main() { // code, from 0x400000",
    "    let local = 2; // stack",
    "    let p = vec![0u8; 100]; // heap",
    "    println!(\"{}\", unsafe { GLOBAL }); // std's formatting code",
    "    drop(p);",
    "    std::process::exit(0);",
    "}",
    "// kernel virtual memory is not a variable you can name",
  ]);
  const cv = code("#s823-code", { label: "The code", files: [fileC("map.c", SRC, MAP_RS)] });
  let mode = 0;
  function mapMode() {
    K.clear(stage);
    txt(stage, 200, 22, "ONE PROCESS · VIRTUAL ADDRESSES", { cls: "sv-label" });
    const order = ["kernel", "stack", "libs", "heap", "data", "code"];
    order.forEach((key, i) => {
      const meta = REG.find((r) => r.k === key);
      const b = box(stage, 70, 36 + i * 40, 260, 34, "sv-panel", key, key === "code" ? "0x400000" : key === "kernel" ? "top of 2^48−1" : "", 13);
      b.r.style.cursor = "pointer";
      b.r.addEventListener("click", () => select(key, b));
      b.r.setAttribute("tabindex", "0");
      b.r.setAttribute("role", "button");
      b.r.setAttribute("aria-label", key);
    });
    txt(stage, 480, 80, "Tap a region.", { cls: "sv-label" });
    const note = txt(stage, 480, 110, "Same layout for every process.", { size: 13 });
    note.id = "s823-note";
    function select(key, b) {
      stage.querySelectorAll("rect").forEach((r) => { if (r.getAttribute("data-region")) r.setAttribute("class", "sv-panel"); });
      b.r.setAttribute("data-region", key);
      b.r.setAttribute("class", key === "kernel" ? "sv-bad" : "sv-good");
      const meta = REG.find((r) => r.k === key);
      cv.calm();
      cv.at([LINE[key]], key === "kernel" ? "bad" : "on");
      cv.notes({ [LINE[key]]: key === "kernel" ? ["no user access", "bad"] : meta.k });
      cap("s823-cap", `<b>${key}.</b> ${meta.d}`);
    }
    cap("s823-cap", "This is the private map every process sees. Tap a band. The matching line is what lives there.");
  }
  function twoMode() {
    K.clear(stage);
    txt(stage, 330, 24, "VIRTUAL ADDRESS 0x400000", { cls: "sv-label" });
    const a = box(stage, 40, 50, 250, 120, "sv-panel", "process A", "byte 0x48  ‘H’", 15);
    const b = box(stage, 370, 50, 250, 120, "sv-panel", "process B", "byte 0x90  nop", 15);
    a.t.setAttribute("y", 78);
    b.t.setAttribute("y", 78);
    txt(stage, 330, 210, "One number. Two bytes. The hardware translates each process’s addresses on its own.", { cls: "sv-label" });
    cv.calm();
    cv.at([3], "on2", false);
    cv.notes({ 3: ["A and B both start here", "warn"] });
    cap("s823-cap", "Both processes place code at <b>0x400000</b>. The bytes are not the same physical memory. That privacy is the address-space illusion.");
  }
  K.$("#s823-seg").appendChild(seg(["The map", "Same address"], 0, (i) => { mode = i; (i ? twoMode : mapMode)(); }, "s823-mode"));
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
  const cv = code("#s824-code", {
    label: "The code",
    files: [fileC("mode.c", join([
        "int x = 1 + 2;                 /* ordinary, stays in user mode */",
        "halt();                        /* privileged: fault */",
        "peek(KERNEL_ADDR);             /* kernel address: fault */",
        "read_file(\"/proc/cpuinfo\");   /* legal: a system call */",
      ]), join([
      "let _x = 1 + 2; // ordinary, stays in user mode",
      "unsafe { std::arch::asm!(\"hlt\"); } // privileged: fault in user mode",
      "unsafe { std::ptr::read_volatile(0xffff_ffff_ffff_0000usize as *const u8) }; // kernel address: fault",
      "let _ = std::fs::read(\"/proc/cpuinfo\"); // legal: a system call",
    ]))],
  });
  const OPS = [
    { label: "add", line: 1, ok: true, say: "An ordinary add never leaves user mode. The mode bit stays clear." },
    { label: "halt", line: 2, ok: false, say: "halt is privileged. User mode faults. The handler runs in kernel mode; the process does not get the instruction." },
    { label: "peek kernel", line: 3, ok: false, say: "That address is in the kernel region. User mode cannot touch it. The fault handler runs in kernel mode." },
    { label: "read /proc", line: 4, ok: true, say: "Reading /proc/cpuinfo is a system call. The exception is the legal door into kernel mode, and it returns with the text." },
  ];
  function run(op) {
    bit.textContent = op.ok && op.line === 4 ? "mode bit = kernel, then user" : "mode bit = user";
    user.r.setAttribute("class", op.ok ? "sv-good" : "sv-panel");
    kern.r.setAttribute("class", op.ok && op.line !== 4 ? "sv-server" : op.line === 4 || !op.ok ? "sv-good" : "sv-server");
    if (!op.ok) kern.r.setAttribute("class", "sv-bad");
    if (op.line === 4) kern.r.setAttribute("class", "sv-good");
    pill("s824-pill", op.ok ? (op.line === 4 ? "syscall" : "user") : "fault");
    cv.calm();
    cv.at([op.line], op.ok ? "good" : "bad");
    cv.notes({ [op.line]: [op.ok ? "allowed" : "protection fault", op.ok ? "good" : "bad"] });
    cv.out(op.ok ? (op.line === 4 ? "model name : toy cpu" : null) : "Segmentation fault");
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
    { box: a, cap: "The kernel restores A. <b>read returns</b>, and A continues at the next line — not back at the start of read.", file: "A.c", lines: [4], note: ["n = 13", "good"], shelf: "B’s context saved", disk: "idle" },
  ];
  const cv = code("#s825-code", {
    label: "The code",
    tabs: true,
    files: [
      fileC("A.c", join(["int main(void) {", "    char buf[16];", "    ssize_t n = read(0, buf, 16);", "    write(1, buf, n);", "}"]), join([
        "fn main() {",
        "    let mut buf = [0u8; 16];",
        "    let n = std::io::Read::read(&mut std::io::stdin(), &mut buf).unwrap();",
        "    let _ = std::io::Write::write(&mut std::io::stdout(), &buf[..n]);",
        "}",
      ])),
      fileC("B.c", join(["void b(void) {", "    compute();   /* runs during A's disk wait */", "}"]), join([
        "fn b() {",
        "    compute(); // runs during A's disk wait",
        "}",
        "fn compute() {}",
      ])),
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
  const RAW = join([
    "pid_t pid = fork();",
    "if (pid < 0) {",
    "    fprintf(stderr, \"%s\\n\", strerror(errno));",
    "    exit(0);",
    "}",
    "/* pid is 0 in the child, or the child PID here */",
  ]);
  const WRAP = join([
    "void unix_error(char *msg) {",
    "    fprintf(stderr, \"%s: %s\\n\", msg, strerror(errno));",
    "    exit(0);",
    "}",
    "pid_t Fork(void) {",
    "    pid_t pid;",
    "    if ((pid = fork()) < 0)",
    "        unix_error(\"Fork error\");",
    "    return pid;",
    "}",
  ]);
  const RAW_RS = join([
    "let pid = unsafe { fork() };",
    "if pid < 0 {",
    "    eprintln!(\"{}\", std::io::Error::last_os_error());",
    "    std::process::exit(0);",
    "}",
    "// pid is 0 in the child, or the child PID here",
  ]);
  const WRAP_RS = join([
    "fn unix_error(msg: &str) -> ! {",
    "    eprintln!(\"{msg}: {}\", std::io::Error::last_os_error());",
    "    std::process::exit(0);",
    "}",
    "fn fork_checked() -> i32 {",
    "    let pid: i32;",
    "    if { pid = unsafe { fork() }; pid < 0 }",
    "    { unix_error(\"Fork error\"); }",
    "    pid",
    "}",
  ]);
  const cv = code("#s83-code", { label: "The code", files: [fileC("check.c", RAW, RAW_RS)] });
  const st = useStats("s83-stats", ["return", "errno"]);
  function run(ok) {
    call.u.textContent = ok ? "process table has room" : "process table full";
    ret.u.textContent = ok ? "57" : "−1";
    ret.r.setAttribute("class", ok ? "sv-good" : "sv-bad");
    err.u.textContent = ok ? "0" : "EAGAIN";
    err.r.setAttribute("class", ok ? "sv-panel" : "sv-bad");
    st.return.set(ok ? "57" : "−1", ok ? "good" : "bad");
    st.errno.set(ok ? "0" : "EAGAIN", ok ? "" : "bad");
    cv.calm();
    if (!wrap) {
      cv.at(ok ? [1, 6] : [1, 2, 3], ok ? "good" : "bad");
      cv.notes(ok ? { 1: ["pid = 57", "good"] } : { 1: ["pid = -1", "bad"], 3: ["strerror(errno)", "bad"] });
      cv.out(ok ? null : "fork: Resource temporarily unavailable");
    } else {
      cv.at(ok ? [7, 9] : [7, 8, 2], ok ? "good" : "bad");
      cv.notes(ok ? { 9: ["return 57", "good"] } : { 8: ["unix_error", "bad"] });
      cv.out(ok ? null : "Fork error: Resource temporarily unavailable");
    }
    cap("s83-cap", ok
      ? "fork worked. The return value is a PID, and errno is irrelevant."
      : (wrap
        ? "fork failed. The <b>Fork</b> wrapper turns −1 into a message and does not return a fake PID to the caller."
        : "fork failed. If the next line treats −1 as a PID, the bug is quiet. The check uses errno."));
  }
  function setWrap(i) {
    wrap = i === 1;
    cv.setFiles([wrap ? fileC("wrapper.c", WRAP, WRAP_RS) : fileC("check.c", RAW, RAW_RS)]);
    ret.u.textContent = "—"; ret.r.setAttribute("class", "sv-panel");
    err.u.textContent = "0"; err.r.setAttribute("class", "sv-panel");
    call.u.textContent = "—";
    cv.out(null);
    cap("s83-cap", wrap ? "The wrapper hides the check. Press either outcome." : "Every call checks −1. Press either outcome.");
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
  txt(svg, 330, 190, "Terminated never runs another instruction. Reaping comes in 8.4.3.", { cls: "sv-label" });
  const cv = code("#s84-code", {
    label: "The code",
    files: [fileC("states.c", join([
        "/* running: executing, or waiting for the CPU */",
        "/* SIGTSTP, SIGSTOP, SIGTTIN, SIGTTOU → stopped */",
        "/* SIGCONT → running again */",
        "/* fatal signal, return from main, or exit → terminated */",
        "/* a terminated process is not runnable */",
      ]), join([
        "// running: executing, or waiting for the CPU",
        "// SIGTSTP, SIGSTOP, SIGTTIN, SIGTTOU → stopped",
        "// SIGCONT → running again",
        "// fatal signal, return from main, or exit → terminated",
        "// a terminated process is not runnable",
      ]))],
  });
  let state = "running";
  const LINE = { running: 1, stopped: 2, cont: 3, dead: 4, refuse: 5 };
  function paint(why, line, tone) {
    Object.entries(nodes).forEach(([k, b]) => b.r.setAttribute("class", k === state ? (state === "dead" ? "sv-bad" : "sv-good") : "sv-panel"));
    pill("s84-pill", state);
    cv.calm();
    cv.at([line], tone === "bad" ? "bad" : tone === "good" ? "good" : "on");
    cv.notes({ [line]: why });
    cap("s84-cap", why);
  }
  function go(next, why, line) {
    if (state === "dead") { paint("Terminated stays terminated. Nothing runs it again.", LINE.refuse, "bad"); return; }
    state = next;
    paint(why, line, next === "dead" ? "bad" : "good");
  }
  paint("The process is running: on a CPU, or waiting for a turn.", 1, "good");
  const ctr = K.$("#s84-controls");
  button(ctr, "SIGTSTP", "", () => go("stopped", "SIGTSTP (Ctrl+Z) stops the process. SIGSTOP, SIGTTIN, and SIGTTOU do the same kind of stop.", 2));
  button(ctr, "SIGCONT", "primary", () => {
    if (state !== "stopped") { paint(state === "dead" ? "Terminated stays terminated." : "SIGCONT has nothing to continue — it is already running.", state === "dead" ? 5 : 1, state === "dead" ? "bad" : "warn"); return; }
    go("running", "SIGCONT makes a stopped process running again.", 3);
  });
  button(ctr, "exit", "", () => go("dead", "exit, or returning from main, terminates the process. It will not run again, but it still exists until reaped.", 4));
  button(ctr, "SIGKILL", "", () => go("dead", "SIGKILL terminates and cannot be caught. The process is gone from the scheduler, not yet reaped.", 4));
})();

/* ================= 8.4.1 ================= */
(function pids() {
  const svg = K.$("#s841-svg");
  const parent = box(svg, 40, 50, 250, 120, "sv-server", "parent", "pid —", 16);
  const child = box(svg, 370, 50, 250, 120, "sv-panel", "child", "not created", 16);
  parent.t.setAttribute("y", 78);
  child.t.setAttribute("y", 78);
  const cv = code("#s841-code", {
    label: "The code",
    files: [fileC("ids.c", join([
        "pid_t me = getpid();",
        "pid_t parent = getppid();",
        "pid_t pid = fork();          /* child starts here too */",
        "if (pid == 0) {",
        "    printf(\"%d %d\\n\", getpid(), getppid());",
        "} else {",
        "    printf(\"%d %d\\n\", getpid(), getppid());",
        "    exit(0);                 /* parent can die first */",
        "}",
      ]), join([
        "let me = unsafe { getpid() };",
        "let parent = unsafe { getppid() };",
        "let pid = unsafe { fork() }; // child starts here too",
        "if pid == 0 {",
        "    println!(\"{} {}\", unsafe { getpid() }, unsafe { getppid() });",
        "} else {",
        "    println!(\"{} {}\", unsafe { getpid() }, unsafe { getppid() });",
        "    std::process::exit(0); // parent can die first",
        "}",
      ]))],
  });
  let step = 0;
  function paint() {
    cv.calm();
    if (step === 0) {
      parent.u.textContent = "getpid 42 · getppid 7";
      child.u.textContent = "not created";
      child.r.setAttribute("class", "sv-panel");
      cv.at([1, 2]);
      cv.notes({ 1: "42", 2: "7" });
      pill("s841-pill", "before fork");
      cap("s841-cap", "Before fork there is one process. <b>getpid</b> is 42. <b>getppid</b> is its parent, 7.");
    } else if (step === 1) {
      parent.u.textContent = "getpid 42 · getppid 7";
      child.u.textContent = "getpid 57 · getppid 42";
      child.r.setAttribute("class", "sv-good");
      cv.at([5], "on", false);
      cv.at([7], "on2", false);
      cv.notes({ 5: ["child 57, parent 42", "good"], 7: ["still 42 and 7", "warn"] });
      cv.out("57 42\n42 7");
      pill("s841-pill", "after fork");
      cap("s841-cap", "fork returned twice. The child prints <span class=\"mono\">57 42</span>. The parent’s own ids did not change.");
    } else {
      parent.u.textContent = "terminated";
      parent.r.setAttribute("class", "sv-bad");
      child.u.textContent = "getpid 57 · getppid 1";
      child.r.setAttribute("class", "sv-good");
      cv.at([8, 5], "bad");
      cv.notes({ 5: ["getppid is now 1", "warn"], 8: "parent exited" });
      cv.out("57 1");
      pill("s841-pill", "adopted");
      cap("s841-cap", "The parent exited. The child is adopted by <b>init</b>, PID 1, so getppid changes. getpid does not.");
    }
  }
  const ctr = K.$("#s841-controls");
  button(ctr, "Step", "primary", () => { if (step < 2) { step++; paint(); } });
  button(ctr, "Reset", "", () => { step = 0; parent.r.setAttribute("class", "sv-server"); cv.out(null); paint(); });
  paint();
})();

/* ================= 8.4.2 ================= */
(function forks() {
  const svg = K.$("#s842-svg");
  const stage = s("g");
  svg.appendChild(stage);
  const XSRC = join([
    "int x = 1;",
    "pid_t pid = fork();",
    "if (pid == 0)",
    "    printf(\"child : x=%d\\n\", ++x);",
    "else",
    "    printf(\"parent: x=%d\\n\", --x);",
    "exit(0);",
  ]);
  const NSRC = join([
    "int main(void) {",
    "    Fork();                 /* now 2 processes */",
    "    Fork();                 /* now 4 */",
    "    printf(\"hello\\n\");",
    "    exit(0);",
    "}",
  ]);
  const XRS = join([
    "let mut x = 1i32;",
    "let pid = unsafe { fork() };",
    "if pid == 0",
    "{ println!(\"child : x={}\", { x += 1; x }); }",
    "else",
    "{ println!(\"parent: x={}\", { x -= 1; x }); }",
    "std::process::exit(0);",
  ]);
  const NRS = join([
    "fn main() {",
    "    unsafe { fork() }; // now 2 processes",
    "    unsafe { fork() }; // now 4",
    "    println!(\"hello\");",
    "    std::process::exit(0);",
    "}",
  ]);
  const cv = code("#s842-code", { label: "The code", files: [fileC("fork.c", XSRC, XRS)] });
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
    const px = xStep >= 3 ? 0 : 1;
    txt(stage, parent.cx, 100, `x = ${px}`, { mono: true, size: 18, bold: true });
    txt(stage, parent.cx, 128, xStep >= 1 ? "fork returned 57" : "about to fork", { cls: "sv-label" });
    txt(stage, parent.cx, 150, xStep >= 3 ? "printed parent: x=0" : "", { cls: "sv-label" });
    if (showChild) {
      const child = box(stage, 370, 40, 250, 150, "sv-good", "child", "", 16);
      child.t.setAttribute("y", 68);
      const cx = xStep >= 2 ? 2 : 1;
      txt(stage, child.cx, 100, `x = ${cx}`, { mono: true, size: 18, bold: true });
      txt(stage, child.cx, 128, "fork returned 0", { cls: "sv-label" });
      txt(stage, child.cx, 150, xStep >= 2 ? "printed child : x=2" : "", { cls: "sv-label" });
    } else {
      txt(stage, 490, 120, "no child yet", { cls: "sv-label" });
    }
    cv.calm();
    if (xStep === 0) { cv.at([1, 2]); cv.notes({ 1: "x = 1" }); cv.out(null); }
    if (xStep === 1) { cv.at([2, 3]); cv.notes({ 2: ["0 and 57", "warn"], 1: ["two copies of x", "good"] }); }
    if (xStep === 2) { cv.at([4], "on"); cv.at([3], "good", false); cv.notes({ 4: ["child x = 2", "good"] }); cv.out("child : x=2"); }
    if (xStep === 3) { cv.at([6], "on2"); cv.notes({ 6: ["parent x = 0", "good"], 4: "child already printed" }); cv.out("child : x=2\nparent: x=0"); }
    const caps = [
      "One process, <b>x = 1</b>, about to call fork.",
      "Called once, returned twice. Both copies of x are still 1. They are not the same variable.",
      "The child increments <b>its</b> x and prints 2. The parent’s x is still 1.",
      "The parent decrements <b>its</b> x and prints 0. Both lines show up, because they share the open screen, not the variable.",
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
      const b = box(stage, 24 + col * 160, 30 + row * 100, 146, 80, done ? "sv-good" : "sv-panel", `P${p.id}`, p.pc === 0 ? "at first Fork" : p.pc === 1 ? "at second Fork" : p.pc === 2 ? "at printf" : "exited", 14);
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
      ? `There ${procs.length === 1 ? "is" : "are"} <b>${procs.length}</b> process${procs.length === 1 ? "" : "es"}. Press a Run button — any runnable process may go next. Hello count: ${lines.length}.`
      : `All ${procs.length} processes printed hello. The lines are a valid order. Reset and run them in another order; the count stays 4.`);
  }
  function runProc(p) {
    if (p.pc === 0 || p.pc === 1) {
      const child = { id: nextId++, pc: p.pc + 1 };
      p.pc++;
      procs.push(child);
    } else if (p.pc === 2) {
      p.pc = 3;
      lines.push(`hello  (P${p.id})`);
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
    if (i === 0) { cv.setFiles([fileC("fork.c", XSRC, XRS)]); xStep = 0; paintX(); }
    else { cv.setFiles([fileC("nested.c", NSRC, NRS)]); resetNest(); }
    controlsFor();
  }
  K.$("#s842-seg").appendChild(seg(["Private x", "Four hellos"], 0, setMode, "s842-mode"));
  setMode(0);
})();

/* ================= 8.4.3 ================= */
(function reap() {
  const svg = K.$("#s843-svg");
  const parent = box(svg, 230, 24, 200, 56, "sv-server", "parent 42", "running", 14);
  const kids = [0, 1].map((i) => box(svg, 80 + i * 280, 120, 200, 80, "sv-panel", `child ${22966 + i}`, "running", 14));
  const init = box(svg, 460, 24, 160, 56, "sv-panel", "init 1", "adopt?", 14);
  const ANY = join([
    "for (i = 0; i < N; i++)",
    "    if (Fork() == 0) exit(100 + i);",
    "while ((pid = waitpid(-1, &status, 0)) > 0)",
    "    printf(\"child %d status=%d\\n\", pid,",
    "           WEXITSTATUS(status));",
  ]);
  const ORD = join([
    "for (i = 0; i < N; i++)",
    "    if ((pid[i] = Fork()) == 0) exit(100 + i);",
    "i = 0;",
    "while ((pid = waitpid(pid[i++], &status, 0)) > 0)",
    "    printf(\"child %d status=%d\\n\", pid,",
    "           WEXITSTATUS(status));",
  ]);
  const ANY_RS = join([
    "for i in 0..N",
    "{ if unsafe { fork() } == 0 { std::process::exit(100 + i); } }",
    "while { pid = unsafe { waitpid(-1, &raw mut status, 0) }; pid > 0 }",
    "{ println!(\"child {pid} status={}\",",
    "    (status >> 8) & 0xff); }",
  ]);
  const ORD_RS = join([
    "for i in 0..N",
    "{ if { pids[i as usize] = unsafe { fork() }; pids[i as usize] == 0 } { std::process::exit(100 + i); } }",
    "let mut i = 0i32;",
    "while { let j = i; i += 1; pid = unsafe { waitpid(pids[j as usize], &raw mut status, 0) }; pid > 0 }",
    "{ println!(\"child {pid} status={}\",",
    "    (status >> 8) & 0xff); }",
  ]);
  const WNO_RS = join([
    "pid = unsafe { waitpid(-1, &raw mut status, WNOHANG) };",
    "if pid == 0 { /* nobody exited yet */ }",
    "if pid > 0 { reap(pid, status); }",
  ]);
  const cv = code("#s843-code", { label: "The code", tabs: true, files: [fileC("waitpid1.c", ANY, ANY_RS)] });
  let mode = 0; /* 0 any, 1 order, 2 wnohang */
  let parentAlive = true;
  let child = [
    { pid: 22966, status: 100, st: "running" },
    { pid: 22967, status: 101, st: "running" },
  ];
  let out = [];
  function fileFor() {
    if (mode === 2) {
      return fileC("wnohang.c", join([
        "pid = waitpid(-1, &status, WNOHANG);",
        "if (pid == 0) { /* nobody exited yet */ }",
        "if (pid > 0) reap(pid, status);",
      ]), WNO_RS);
    }
    return fileC(mode === 0 ? "waitpid1.c" : "waitpid2.c", mode === 0 ? ANY : ORD, mode === 0 ? ANY_RS : ORD_RS);
  }
  function zombies() { return child.filter((c) => c.st === "zombie" || c.st === "orphan"); }
  function paint() {
    parent.r.setAttribute("class", parentAlive ? "sv-server" : "sv-bad");
    parent.u.textContent = parentAlive ? "running" : "gone";
    init.r.setAttribute("class", parentAlive ? "sv-panel" : "sv-good");
    init.u.textContent = parentAlive ? "idle" : "adopted leftovers";
    kids.forEach((b, i) => {
      const c = child[i];
      const adopted = !parentAlive && c.st === "running";
      b.u.textContent = adopted ? "running · ppid 1" : c.st + (c.st === "running" ? "" : ` · status ${c.status}`);
      b.r.setAttribute("class", c.st === "running" ? "sv-panel" : c.st === "reaped" ? "sv-good" : "sv-bad");
    });
    cv.setFiles([fileFor()]);
    cv.calm();
    const z = zombies();
    const reaped = child.filter((c) => c.st === "reaped");
    const running = child.filter((c) => c.st === "running");
    if (!parentAlive) {
      cv.at([2], "dim");
      cv.notes({ 2: ["parent is gone", "bad"] });
    } else if (mode === 2 && z.length) {
      cv.at([1]);
      cv.notes({ 1: ["would return a pid", "good"] });
    } else if (mode === 2 && reaped.length) {
      cv.at([3], "good");
      cv.notes({ 3: [`reaped ${reaped.length}`, "good"] });
    } else if (mode === 2) {
      cv.at([1]);
      cv.notes({ 1: ["returns 0", "warn"] });
    } else if (z.length) {
      cv.at(mode === 0 ? [3] : [4]);
      cv.notes({ [mode === 0 ? 3 : 4]: [`${z.length} zombie${z.length > 1 ? "s" : ""}`, "warn"] });
    } else if (reaped.length) {
      const line = mode === 0 ? 4 : 5;
      cv.at([line], "good");
      cv.notes({ [line]: [`reaped ${reaped.map((c) => c.pid).join(", ")}`, "good"] });
    }
    cv.out(out.length ? out.join("\n") : null);
    const waiting = z.map((c) => c.pid);
    const reapedIds = reaped.map((c) => c.pid).join(" and ");
    const runningIds = running.map((c) => c.pid).join(" and ");
    cap("s843-cap", !parentAlive
      ? "The parent exited first. Init reaped any zombies at once. A child that was still running is adopted (ppid 1) and keeps going until it exits."
      : waiting.length
        ? (waiting.length > 1
          ? `Zombies ${waiting.join(" and ")} still occupy kernel slots. Press <b>waitpid</b>.`
          : `Zombie ${waiting[0]} still occupies a kernel slot. Press <b>waitpid</b>.`)
        : reaped.length && running.length
          ? `Reaped ${reapedIds}. ${runningIds} ${running.length > 1 ? "are" : "is"} still running, so the next waitpid ${mode === 2 ? "returns 0" : "would block"}.`
          : reaped.length === child.length
            ? "Every child has been reaped. Another waitpid returns −1 and sets errno to ECHILD."
            : "Children that are still running are not zombies. Exit them, or call waitpid and see what happens.");
  }
  function reapOne() {
    if (!parentAlive) { paint(); return; }
    if (mode === 2) {
      const z = child.find((c) => c.st === "zombie");
      if (!z) { out.push("waitpid → 0  (WNOHANG, no zombie)"); paint(); return; }
      z.st = "reaped";
      out.push(`reaped ${z.pid} status=${z.status}`);
      paint();
      return;
    }
    if (mode === 1) {
      const target = child.find((c) => c.st !== "reaped");
      if (!target) { out.push("waitpid → -1  errno = ECHILD"); paint(); return; }
      if (target.st === "running") { out.push(`waitpid(${target.pid}) would block — that child is still running`); paint(); return; }
      target.st = "reaped";
      out.push(`child ${target.pid} terminated normally with exit status=${target.status}`);
      paint();
      return;
    }
    let z;
    {
      const zs = child.filter((c) => c.st === "zombie");
      z = zs.length ? zs[Math.floor(Math.random() * zs.length)] : null;
    }
    if (!z) {
      out.push(child.some((c) => c.st === "running") ? "waitpid would block — a child is still running" : "waitpid → -1  errno = ECHILD");
      paint();
      return;
    }
    z.st = "reaped";
    out.push(`child ${z.pid} terminated normally with exit status=${z.status}`);
    paint();
  }
  function exitChild(i) {
    if (child[i].st !== "running") return;
    child[i].st = parentAlive ? "zombie" : "orphan";
    if (!parentAlive) child[i].st = "reaped";
    paint();
  }
  function parentExit() {
    if (!parentAlive) return;
    parentAlive = false;
    child.forEach((c) => { if (c.st === "zombie") c.st = "reaped"; });
    out.push("init reaped terminated orphans; running children now have ppid 1");
    paint();
  }
  function reset() {
    parentAlive = true;
    child = [{ pid: 22966, status: 100, st: "running" }, { pid: 22967, status: 101, st: "running" }];
    out = [];
    paint();
  }
  K.$("#s843-seg").appendChild(seg(["any child", "creation order", "WNOHANG"], 0, (i) => { mode = i; out = []; paint(); }, "s843-mode"));
  const ctr = K.$("#s843-controls");
  button(ctr, "Child 22966 exits", "", () => exitChild(0));
  button(ctr, "Child 22967 exits", "", () => exitChild(1));
  button(ctr, "waitpid", "primary", reapOne);
  button(ctr, "Parent exits", "", parentExit);
  button(ctr, "Reset", "", reset);
  reset();
})();

/* ================= 8.4.4 ================= */
(function snooze() {
  const svg = K.$("#s844-svg");
  txt(svg, 40, 36, "sleep(3)", { anchor: "start", bold: true });
  const track = s("rect", { x: 40, y: 48, width: 420, height: 28, rx: 8, class: "sv-panel" });
  const fill = s("rect", { x: 40, y: 48, width: 0, height: 28, rx: 8, class: "sv-good" });
  svg.append(track, fill);
  const clock = txt(svg, 490, 68, "0.0 s", { mono: true, bold: true, anchor: "start" });
  const pauseBox = box(svg, 40, 110, 420, 52, "sv-panel", "pause()", "awake", 14);
  const cv = code("#s844-code", {
    label: "The code",
    files: [fileC("sleep.c", join([
        "unsigned int left = sleep(3);",
        "/* left == 0 if the whole interval elapsed */",
        "/* left == seconds still remaining if a signal woke us */",
        "",
        "pause();   /* always returns -1, after a signal */",
      ]), join([
        "let left = unsafe { sleep(3) };",
        "// left == 0 if the whole interval elapsed",
        "// left == seconds still remaining if a signal woke us",
        "",
        "unsafe { pause() }; // always returns -1, after a signal",
      ]))],
  });
  function slept(sec, left) {
    fill.setAttribute("width", String(Math.min(420, (sec / 3) * 420)));
    fill.setAttribute("class", left ? "sv-data-soft" : "sv-good");
    clock.textContent = sec.toFixed(1) + " s";
    pauseBox.u.textContent = "awake";
    pauseBox.r.setAttribute("class", "sv-panel");
    cv.calm();
    cv.at([1], left ? "bad" : "good");
    cv.notes({ 1: [`returns ${left}`, left ? "warn" : "good"] });
    cv.out(left ? `woke early, ${left}s left` : "returns 0");
    pill("s844-pill", left ? "interrupted" : "slept 3");
    cap("s844-cap", left
      ? `A signal arrived after ${sec} second. sleep returns <b>${left}</b>, the seconds still left — not an error code.`
      : "The whole interval elapsed. sleep returns <b>0</b>.");
  }
  function paused(woke) {
    fill.setAttribute("width", "0");
    clock.textContent = "—";
    pauseBox.r.setAttribute("class", woke ? "sv-good" : "sv-data-soft");
    pauseBox.u.textContent = woke ? "returned −1" : "sleeping until a signal";
    cv.calm();
    cv.at([5], woke ? "good" : "on");
    cv.notes({ 5: woke ? ["returns -1", "good"] : "no timeout" });
    cv.out(woke ? "pause returned -1" : null);
    pill("s844-pill", woke ? "signaled" : "paused");
    cap("s844-cap", woke
      ? "SIGALRM arrived. pause returns −1. It does not say which signal, and it does not return a leftover time."
      : "pause has no duration. It sits here until some signal is received.");
  }
  const ctr = K.$("#s844-controls");
  button(ctr, "sleep(3) finishes", "primary", () => slept(3, 0));
  button(ctr, "Signal at 1s", "", () => slept(1, 2));
  button(ctr, "pause", "", () => paused(false));
  button(ctr, "Deliver SIGALRM", "", () => paused(true));
  cap("s844-cap", "sleep takes a duration and may return early. pause waits only for a signal.");
})();

/* ================= 8.4.5 ================= */
(function exec() {
  const svg = K.$("#s845-svg");
  const proc = box(svg, 24, 28, 200, 150, "sv-server", "PID 42", "program: hello", 15);
  proc.t.setAttribute("y", 56);
  const fds = txt(svg, 124, 150, "fds 0, 1, 2 open", { cls: "sv-label" });
  txt(svg, 450, 24, "ARGV", { cls: "sv-label" });
  const slots = ["hello", "NULL", "", ""].map((label, i) => box(svg, 360, 36 + i * 40, 260, 34, "sv-panel", label || "—", null, 13));
  const cv = code("#s845-code", {
    label: "The code",
    files: [fileC("run.c", join([
        "char *argv[] = { \"ls\", \"-lt\", \"/usr/include\", NULL };",
        "char *envp[] = { \"USER=ada\", \"PWD=/home/ada\", NULL };",
        "int rc = execve(\"/bin/ls\", argv, envp);",
        "/* only reached on error */",
        "unix_error(\"execve\");",
      ]), join([
        "let argv = [c\"ls\".as_ptr(), c\"-lt\".as_ptr(), c\"/usr/include\".as_ptr(), std::ptr::null()];",
        "let envp = [c\"USER=ada\".as_ptr(), c\"PWD=/home/ada\".as_ptr(), std::ptr::null()];",
        "let _rc = unsafe { execve(c\"/bin/ls\".as_ptr(), argv.as_ptr(), envp.as_ptr()) };",
        "// only reached on error",
        "unix_error(\"execve\");",
      ]))],
  });
  function show(kind) {
    const ok = kind === "ok";
    proc.u.textContent = ok ? "program: ls" : kind === "bad" ? "program: hello" : "program: hello";
    proc.r.setAttribute("class", ok ? "sv-good" : kind === "bad" ? "sv-bad" : "sv-server");
    fds.textContent = "fds 0, 1, 2 open";
    const args = ok ? ["ls", "-lt", "/usr/include", "NULL"] : ["hello", "NULL", "—", "—"];
    slots.forEach((b, i) => { b.t.textContent = args[i]; b.r.setAttribute("class", ok ? "sv-data-soft" : "sv-panel"); });
    cv.calm();
    if (kind === "ok") {
      cv.at([3], "good");
      cv.notes({ 3: ["does not return", "good"], 1: "argv[0] is the name" });
      cv.out(null);
      pill("s845-pill", "PID 42 · ls");
      cap("s845-cap", "Success. The PID is still <b>42</b>. Code, data, heap, and stack were replaced. Open files stayed. main of ls receives this argv. execve does not return.");
    } else if (kind === "bad") {
      cv.at([3, 5], "bad");
      cv.notes({ 3: ["returns -1", "bad"], 5: "errno set" });
      cv.out("execve: No such file");
      pill("s845-pill", "PID 42 · hello");
      cap("s845-cap", "The file was missing. execve returns −1, errno is set, and <b>hello is still the program</b>. The PID never changed.");
    } else {
      pill("s845-pill", "hello");
      cap("s845-cap", "This process is hello, PID 42. Press execve to load another program into it.");
    }
  }
  const ctr = K.$("#s845-controls");
  button(ctr, "execve /bin/ls", "primary", () => show("ok"));
  button(ctr, "execve missing", "", () => show("bad"));
  button(ctr, "Reset", "", () => show("reset"));
  show("reset");
})();

/* ================= 8.4.6 ================= */
(function shell() {
  const svg = K.$("#s846-svg");
  const sh = box(svg, 24, 30, 200, 80, "sv-server", "shell", "pid 10", 15);
  const job = box(svg, 250, 30, 180, 80, "sv-panel", "child", "none", 15);
  const prompt = box(svg, 456, 30, 180, 80, "sv-panel", "prompt", "waiting", 14);
  sh.t.setAttribute("y", 58); job.t.setAttribute("y", 58); prompt.t.setAttribute("y", 58);
  txt(svg, 330, 150, "foreground waits · background does not · quit is not a program", { cls: "sv-label" });
  const term = txt(svg, 330, 190, ">", { mono: true, size: 14, bold: true });
  const SRC = join([
    "void eval(char *cmdline) {",
    "    char *argv[128]; char buf[128]; int bg; pid_t pid;",
    "    strcpy(buf, cmdline);",
    "    bg = parseline(buf, argv);",
    "    if (argv[0] == NULL) return;",
    "    if (builtin_command(argv)) return;   /* quit */",
    "    if ((pid = Fork()) == 0)",
    "        Execve(argv[0], argv, environ);",
    "    if (!bg) Waitpid(pid, NULL, 0);",
    "    else printf(\"%d %s\", pid, cmdline);",
    "}",
  ]);
  const SRC_RS = join([
    "fn eval(cmdline: &str) {",
    "    let mut argv = Vec::<std::ffi::CString>::new(); let mut bg = false; let mut pid = 0i32;",
    "    let _buf = cmdline.to_string();",
    "    bg = parseline(&mut argv);",
    "    if argv.first().is_none() { return; }",
    "    if builtin_command(&argv) { return; } // quit",
    "    if { pid = unsafe { fork() }; pid == 0 }",
    "    { let mut p: Vec<*const c_char> = argv.iter().map(|s| s.as_ptr()).collect(); p.push(std::ptr::null()); unsafe { execve(p[0], p.as_ptr(), environ) }; unix_error(\"Execve error\"); }",
    "    if !bg { let mut st = 0i32; unsafe { waitpid(pid, &raw mut st, 0) }; }",
    "    else { println!(\"{pid} {cmdline}\"); }",
    "}",
  ]);
  const cv = code("#s846-code", { label: "The code", files: [fileC("shellex.c", SRC, SRC_RS)] });
  const JOBS = {
    quit: [
      { lines: [4, 6], note: { 6: ["builtin quit", "good"] }, shell: "exits", job: "none", prompt: "gone", term: "> quit", cap: "<b>quit</b> is a builtin. The shell does not fork. eval returns out of main and the shell process terminates." },
    ],
    ls: [
      { lines: [4], note: { 4: "bg = 0" }, shell: "parsing", job: "none", prompt: "blocked", term: "> ls -lt /usr/include", cap: "parseline built argv and reported a <b>foreground</b> job." },
      { lines: [7, 8], note: { 8: ["child loads ls", "good"] }, shell: "waiting", job: "pid 57 · ls", prompt: "blocked", term: "> ls -lt /usr/include", cap: "The child <b>execve</b>s ls. The parent is in <b>waitpid</b> and will not print another prompt yet." },
      { lines: [9], note: { 9: ["reaped 57", "good"] }, shell: "ready", job: "reaped", prompt: "ready", term: "> ls -lt /usr/include\n(listing)\n>", cap: "ls exited. The parent reaped it. This shell is ready for another line. No zombie." },
    ],
    bg: [
      { lines: [4], note: { 4: "bg = 1" }, shell: "parsing", job: "none", prompt: "ready", term: "> ls &", cap: "The trailing <b>&</b> marks a background job." },
      { lines: [7, 8, 10], note: { 10: ["prints 57", "warn"] }, shell: "ready", job: "pid 57 · running", prompt: "ready", term: "> ls &\n57 ls &\n>", cap: "The parent does <b>not</b> wait. The prompt comes back while the child runs." },
      { lines: [10], note: { 10: ["no waitpid", "bad"] }, shell: "ready", job: "pid 57 · zombie", prompt: "ready", term: "> ls &\n57 ls &\n>", cap: "The child finished. This simple shell never reaps background children, so 57 is a <b>zombie</b>. Signals, next, are how a real shell notices." },
    ],
  };
  let story = null, step = -1;
  function paint() {
    if (!story) {
      sh.u.textContent = "pid 10"; job.u.textContent = "none"; prompt.u.textContent = "waiting";
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
    term.textContent = st.term;
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
  button(ctr, "ls &", "", () => choose("bg"));
  button(ctr, "Step", "", () => { if (story && step < story.length - 1) { step++; paint(); } });
  button(ctr, "Reset", "", () => { story = null; step = -1; paint(); });
  paint();
})();

/* ================= 8.5 ================= */
(function signalsIntro() {
  const svg = K.$("#s85-svg");
  const kernel = box(svg, 24, 70, 180, 80, "sv-server", "kernel", "notices an event", 14);
  const proc = box(svg, 430, 70, 200, 80, "sv-panel", "process 42", "no signal", 14);
  kernel.t.setAttribute("y", 98);
  proc.t.setAttribute("y", 98);
  const EV = [
    { label: "divide by 0", sig: "SIGFPE", n: 8, line: 2 },
    { label: "bad instruction", sig: "SIGILL", n: 4, line: 3 },
    { label: "bad address", sig: "SIGSEGV", n: 11, line: 4 },
    { label: "Ctrl+C", sig: "SIGINT", n: 2, line: 5 },
    { label: "child exits", sig: "SIGCHLD", n: 17, line: 6 },
  ];
  const cv = code("#s85-code", {
    label: "The code",
    files: [fileC("kernel.c", join([
        "/* kernel turns an event into a signal */",
        "if (divide_by_zero) send(p, SIGFPE);    /* 8 */",
        "if (illegal_inst)   send(p, SIGILL);    /* 4 */",
        "if (bad_address)    send(p, SIGSEGV);   /* 11 */",
        "if (ctrl_c)         send(fg, SIGINT);   /* 2 */",
        "if (child_done)     send(parent, SIGCHLD); /* 17 */",
      ]), join([
        "// kernel turns an event into a signal",
        "if divide_by_zero { send(p, SIGFPE); } // 8",
        "if illegal_inst { send(p, SIGILL); } // 4",
        "if bad_address { send(p, SIGSEGV); } // 11",
        "if ctrl_c { send(fg, SIGINT); } // 2",
        "if child_done { send(parent, SIGCHLD); } // 17",
      ]))],
  });
  function send(ev) {
    proc.u.textContent = `${ev.sig} (${ev.n})`;
    proc.r.setAttribute("class", "sv-good");
    pill("s85-pill", ev.sig);
    cv.calm();
    cv.at([ev.line], "good");
    cv.notes({ [ev.line]: [`${ev.sig} = ${ev.n}`, "good"] });
    cap("s85-cap", `The kernel recorded <b>${ev.sig}</b>, number ${ev.n}, in process 42’s context. The process has not reacted yet — sending and receiving are different steps.`);
  }
  const ctr = K.$("#s85-controls");
  EV.forEach((ev) => button(ctr, ev.label, "", () => send(ev)));
  cap("s85-cap", "Linux defines 30 signal types. Press an event to see which number the kernel sends.");
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
  const cv = code("#s851-code", {
    label: "The code",
    files: [fileC("bits.c", join([
        "/* one bit per signal type, not a counter */",
        "sigset_t pending, blocked;",
        "void send(int sig) {",
        "    if (bit(pending, sig)) return;  /* discard */",
        "    set(pending, sig);",
        "}",
        "void receive(int sig) {           /* only if not blocked */",
        "    if (bit(blocked, sig)) return;",
        "    clear(pending, sig);",
        "}",
      ]), join([
      "// one bit per signal type, not a counter",
      "static mut PENDING: u64 = 0; static mut BLOCKED: u64 = 0;",
      "unsafe fn send(sig: i32) {",
      "    if bit(unsafe { PENDING }, sig) { return; } // discard",
      "    unsafe { set(&raw mut PENDING, sig) };",
      "}",
      "unsafe fn receive(sig: i32) { // only if not blocked",
      "    if bit(unsafe { BLOCKED }, sig) { return; }",
      "    unsafe { clear(&raw mut PENDING, sig) };",
      "}",
      "fn bit(bits: u64, sig: i32) -> bool { bits & (1u64 << sig) != 0 }",
      "unsafe fn set(slot: *mut u64, sig: i32) { unsafe { *slot |= 1u64 << sig; } }",
      "unsafe fn clear(slot: *mut u64, sig: i32) { unsafe { *slot &= !(1u64 << sig); } }",
    ]))],
  });
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
    paint(`Received <b>${names[focus]}</b> once. The pending bit is clear, including any duplicates that were thrown away.`);
    cv.at([9], "good");
  }
  const ctr = K.$("#s851-controls");
  ctr.appendChild(seg(names, 0, (i) => { focus = i; lost = 0; paint(`Watching <b>${names[i]}</b>. Send it, block it, send it again.`); }, "s851-sig"));
  button(ctr, "Send", "primary", send);
  button(ctr, "Block", "", () => { B[focus] = 1; paint(`<b>${names[focus]}</b> is blocked. Sending it can set pending, and receiving waits.`); cv.at([8]); });
  button(ctr, "Unblock", "", () => { B[focus] = 0; paint(`<b>${names[focus]}</b> is unblocked.` + (P[focus] ? " It can be received now — still only once." : "")); });
  button(ctr, "Receive", "", receive);
  button(ctr, "Reset", "", () => { P = [0, 0, 0]; B = [0, 0, 0]; lost = 0; paint("Both vectors are clear."); });
  paint("Pending means “at least one arrived.” Blocked means “do not receive it yet.”");
})();

/* ================= 8.5.2 ================= */
(function sendSig() {
  const svg = K.$("#s852-svg");
  const GROUPS = [
    { title: "shell · group 10", pids: [{ id: 10, name: "shell" }] },
    { title: "foreground · group 20", pids: [{ id: 20, name: "job" }, { id: 21, name: "child" }, { id: 22, name: "child" }] },
    { title: "background", pids: [{ id: 32, name: "group 32" }, { id: 40, name: "group 40" }] },
  ];
  const nodes = {};
  GROUPS.forEach((g, gi) => {
    txt(svg, 36, 28 + gi * 82, g.title, { anchor: "start", cls: "sv-label" });
    g.pids.forEach((p, i) => {
      nodes[p.id] = box(svg, 40 + i * 150, 36 + gi * 82, 136, 48, "sv-panel", String(p.id), p.name, 14);
    });
  });
  const cv = code("#s852-code", {
    label: "The code",
    files: [fileC("kill.c", join([
        "kill(21, SIGKILL);     /* one process */",
        "kill(-20, SIGINT);    /* every member of group 20 */",
        "kill(-20, SIGTSTP);   /* Ctrl+Z is this idea */",
        "alarm(3);             /* SIGALRM to myself later */",
        "/* SIGKILL and SIGSTOP cannot be caught or ignored */",
      ]), join([
        "unsafe { kill(21, SIGKILL) }; // one process",
        "unsafe { kill(-20, SIGINT) }; // every member of group 20",
        "unsafe { kill(-20, SIGTSTP) }; // Ctrl+Z is this idea",
        "unsafe { alarm(3) }; // SIGALRM to myself later",
        "// SIGKILL and SIGSTOP cannot be caught or ignored",
      ]))],
  });
  function hit(ids, label, line, tone) {
    Object.values(nodes).forEach((b) => b.r.setAttribute("class", "sv-panel"));
    ids.forEach((id) => nodes[id].r.setAttribute("class", tone === "bad" ? "sv-bad" : "sv-good"));
    cv.calm();
    cv.at([line], tone === "bad" ? "bad" : "good");
    cv.notes({ [line]: [label, tone || "good"] });
    pill("s852-pill", label);
    cap("s852-cap", `Delivered to <b>${ids.join(", ")}</b>. ${label}. The shell and the other jobs are different groups, so they are not in this set.`);
  }
  const ctr = K.$("#s852-controls");
  button(ctr, "Ctrl+C", "primary", () => { hit([20, 21, 22], "SIGINT to group 20", 2); cap("s852-cap", "Ctrl+C sends <b>SIGINT</b> to every process in the foreground group: 20, 21, and 22. The shell (group 10) and the background jobs stay up."); });
  button(ctr, "Ctrl+Z", "", () => { hit([20, 21, 22], "SIGTSTP to group 20", 3, "warn"); cap("s852-cap", "Ctrl+Z sends <b>SIGTSTP</b> to that same foreground group. They stop until SIGCONT. Background jobs keep running."); });
  button(ctr, "kill -9 21", "", () => { hit([21], "SIGKILL 21", 1, "bad"); cap("s852-cap", "A positive PID is one process. <b>SIGKILL</b> cannot be caught or ignored, so 21 terminates. 20 and 22 do not."); });
  button(ctr, "kill -9 -20", "", () => { hit([20, 21, 22], "SIGKILL group 20", 2, "bad"); cap("s852-cap", "A negative PID is a group. <b>kill -9 -20</b> terminates 20, 21, and 22. SIGKILL still cannot be caught."); });
  button(ctr, "alarm(3)", "", () => { hit([10], "SIGALRM to self", 4); cap("s852-cap", "<b>alarm(3)</b> asks the kernel to send SIGALRM to the calling process in 3 seconds. It cancels any previous alarm and returns how many seconds that one had left."); });
})();

/* ================= 8.5.3 ================= */
(function recv() {
  const svg = K.$("#s853-svg");
  const stage = s("g");
  svg.appendChild(stage);
  const CATCH = join([
    "void handler(int sig) {",
    "    /* catch: run this, then resume */",
    "}",
    "int main(void) {",
    "    signal(SIGINT, handler);   /* or SIG_IGN, or SIG_DFL */",
    "    pause();",
    "}",
  ]);
  const NEST = join([
    "/* main catches s, then t arrives (Figure 8.31) */",
    "void handler_s(int sig) {",
    "    /* t can interrupt this handler */",
    "}",
    "void handler_t(int sig) {",
    "    /* returns to handler_s, not to main */",
    "}",
  ]);
  const CATCH_RS = join([
    "extern \"C\" fn handler(_sig: i32) {",
    "    // catch: run this, then resume",
    "}",
    "fn main() {",
    "    unsafe { signal(SIGINT, handler) }; // or SIG_IGN, or SIG_DFL",
    "    unsafe { pause() };",
    "}",
  ]);
  const NEST_RS = join([
    "// main catches s, then t arrives (Figure 8.31)",
    "extern \"C\" fn handler_s(_sig: i32) {",
    "    // t can interrupt this handler",
    "}",
    "extern \"C\" fn handler_t(_sig: i32) {",
    "    // returns to handler_s, not to main",
    "}",
  ]);
  const cv = code("#s853-code", { label: "The code", files: [fileC("catch.c", CATCH, CATCH_RS)] });
  let mode = 0, disp = "catch", nest = 0;
  function paintDisp() {
    K.clear(stage);
    const main = box(stage, 30, 40, 180, 70, "sv-panel", "main", "pause", 14);
    const hand = box(stage, 240, 40, 180, 70, "sv-panel", "handler", disp, 14);
    const end = box(stage, 450, 40, 180, 70, "sv-panel", "after", "—", 14);
    main.t.setAttribute("y", 68); hand.t.setAttribute("y", 68); end.t.setAttribute("y", 68);
    cv.show("catch.c");
    cv.calm();
    if (disp === "default") {
      end.t.textContent = "terminated"; end.r.setAttribute("class", "sv-bad");
      cv.at([5], "bad"); cv.notes({ 5: ["SIG_DFL", "bad"] });
      cap("s853-cap", "Default for SIGINT is to <b>terminate</b>. No handler runs. SIGKILL and SIGSTOP have defaults you cannot replace.");
    } else if (disp === "ignore") {
      main.r.setAttribute("class", "sv-good"); end.t.textContent = "still in pause";
      cv.at([5], "dim"); cv.notes({ 5: ["SIG_IGN", "warn"] });
      cap("s853-cap", "The process <b>ignores</b> SIGINT. pause is still waiting for some other signal.");
    } else {
      hand.r.setAttribute("class", "sv-good"); end.t.textContent = "back to main"; end.r.setAttribute("class", "sv-good");
      cv.at([1, 5], "good"); cv.notes({ 1: ["caught", "good"] });
      cap("s853-cap", "The process <b>catches</b> SIGINT. The handler runs, then the main program resumes — here, after pause returns.");
    }
    pillLike(disp);
  }
  function pillLike(text) { const el = K.$("#s853-seg"); /* seg lives here; pill is not separate */ void text; }
  function paintNest() {
    K.clear(stage);
    const frames = [
      { t: "main", s: "running" },
      { t: "handler S", s: "caught s" },
      { t: "handler T", s: "t interrupted S" },
      { t: "handler S", s: "T returned" },
      { t: "main", s: "S returned" },
    ];
    frames.forEach((f, i) => {
      const on = i === nest;
      const b = box(stage, 24 + i * 126, 70, 116, 70, on ? "sv-good" : "sv-panel", f.t, on ? f.s : "", 12);
      b.t.setAttribute("y", b.y + 28);
    });
    cv.show("nest.c");
    cv.calm();
    const line = [1, 2, 5, 3, 1][nest];
    cv.at([line]);
    cv.notes({ [line]: frames[nest].s });
    cap("s853-cap", `<b>Step ${nest + 1}.</b> ${frames[nest].t}: ${frames[nest].s}. A different signal can interrupt a handler. The same signal usually cannot, because it is blocked while its handler runs.`);
  }
  function setMode(i) {
    mode = i;
    if (i === 0) { cv.setFiles([fileC("catch.c", CATCH, CATCH_RS)]); paintDisp(); }
    else { nest = 0; cv.setFiles([fileC("nest.c", NEST, NEST_RS)]); paintNest(); }
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
  let pending = 0, blocked = 0, inHandler = false, sentDuring = 0;
  const cv = code("#s854-code", {
    label: "The code",
    files: [fileC("mask.c", join([
        "sigset_t mask, prev;",
        "sigemptyset(&mask);",
        "sigaddset(&mask, SIGINT);",
        "sigprocmask(SIG_BLOCK, &mask, &prev);",
        "/* SIGINT can arrive here and stay pending */",
        "sigprocmask(SIG_SETMASK, &prev, NULL);",
        "",
        "void handler(int sig) {",
        "    /* SIGINT is implicitly blocked in here */",
        "}",
      ]), join([
      "let mut mask = SigSet([0; 16]); let mut prev = SigSet([0; 16]);",
      "unsafe { sigemptyset(&raw mut mask) };",
      "unsafe { sigaddset(&raw mut mask, SIGINT) };",
      "unsafe { sigprocmask(SIG_BLOCK, &mask, &raw mut prev) };",
      "// SIGINT can arrive here and stay pending",
      "unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) };",
      " ",
      "extern \"C\" fn handler(_sig: i32) {",
      "    // SIGINT is implicitly blocked in here",
      "}",
    ]))],
  });
  function paint(msg, lines, tone) {
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
      5: pending ? ["pending = 1", "warn"] : "pending = 0",
      9: inHandler ? ["implicit block", "warn"] : "",
    });
    cap("s854-cap", msg);
  }
  const ctr = K.$("#s854-controls");
  button(ctr, "Block", "", () => { blocked = 1; paint("SIGINT is explicitly blocked. The handler will not run.", [4]); });
  button(ctr, "Send", "primary", () => {
    if (inHandler) {
      if (pending) sentDuring++;
      pending = 1;
      paint("The handler is running, so SIGINT is implicitly blocked. This send sets pending and does <b>not</b> nest another handler.", [9], "warn");
      return;
    }
    if (pending) { paint("Already pending. The extra SIGINT is discarded.", [5], "bad"); return; }
    pending = 1;
    if (blocked) paint("Pending is set. Because the signal is blocked, nothing runs yet.", [5], "warn");
    else { pending = 0; inHandler = true; paint("It was not blocked, so it is received immediately and the handler starts. SIGINT is now implicitly blocked.", [8, 9], "good"); }
  });
  button(ctr, "Unblock", "", () => {
    if (inHandler) { paint("You cannot drop the implicit block by hand in this toy. Return from the handler.", [9], "warn"); return; }
    blocked = 0;
    if (pending) { pending = 0; inHandler = true; paint("Unblocking a pending SIGINT receives it <b>once</b>. The handler starts.", [6, 8], "good"); }
    else paint("Unblocked, and nothing was pending.", [6]);
  });
  button(ctr, "Handler returns", "", () => {
    if (!inHandler) { paint("The handler is not running.", [8]); return; }
    inHandler = false;
    if (pending && !blocked) {
      pending = 0; inHandler = true;
      paint("The pending SIGINT from during the handler is received now, as a new call — still only one bit’s worth.", [8], "warn");
    } else paint("The handler returned. The implicit block is gone.", [10], "good");
  });
  button(ctr, "Reset", "", () => { pending = 0; blocked = 0; inHandler = false; sentDuring = 0; paint("Nothing pending, nothing blocked.", [1]); });
  paint("Block SIGINT, send it twice, then unblock. Or start the handler and send again before it returns.", [1]);
})();

/* ================= 8.5.5 ================= */
(function handlers() {
  const svg = K.$("#s855-svg");
  const stage = s("g");
  svg.appendChild(stage);
  const UNSAFE = join([
    "void handler(int sig) {",
    "    printf(\"Caught SIGINT!\\n\");  /* not async-signal-safe */",
    "    exit(0);                      /* not safe either */",
    "}",
  ]);
  const SAFE = join([
    "void handler(int sig) {",
    "    Sio_puts(\"Caught SIGINT!\\n\"); /* write is safe */",
    "    _exit(0);                      /* not exit() */",
    "}",
  ]);
  const ONE = join([
    "void handler(int sig) {",
    "    pid = waitpid(-1, NULL, 0);  /* one child */",
    "}",
    "/* three children can exit before this runs */",
  ]);
  const LOOP = join([
    "void handler(int sig) {",
    "    int old = errno;",
    "    while (waitpid(-1, NULL, 0) > 0)",
    "        ;                        /* reap every zombie */",
    "    errno = old;",
    "}",
  ]);
  const UNSAFE_RS = join([
    "extern \"C\" fn handler(_sig: i32) {",
    "    println!(\"Caught SIGINT!\"); // not async-signal-safe",
    "    std::process::exit(0); // not safe either",
    "}",
  ]);
  const SAFE_RS = join([
    "extern \"C\" fn handler(_sig: i32) {",
    "    unsafe { write(1, c\"Caught SIGINT!\\n\".as_ptr().cast(), 15) }; // write is safe",
    "    unsafe { _exit(0) }; // not std::process::exit",
    "}",
  ]);
  const ONE_RS = join([
    "extern \"C\" fn handler(_sig: i32) {",
    "    PID.store(unsafe { waitpid(-1, std::ptr::null_mut(), 0) }, Ordering::Relaxed); // one child",
    "}",
    "// three children can exit before this runs",
    "static PID: AtomicI32 = AtomicI32::new(0);",
  ]);
  const LOOP_RS = join([
    "extern \"C\" fn handler(_sig: i32) {",
    "    let old = unsafe { *__errno_location() };",
    "    while unsafe { waitpid(-1, std::ptr::null_mut(), 0) } > 0",
    "    { /* reap every zombie */ }",
    "    unsafe { *__errno_location() = old }; // errno is per thread; macOS spells it __error",
    "}",
  ]);
  const cv = code("#s855-code", { label: "The code", files: [fileC("unsafe.c", UNSAFE, UNSAFE_RS)] });
  let mode = 0;
  let kids = [];
  function drawKids() {
    K.clear(stage);
    if (mode === 0) {
      const b = box(stage, 180, 60, 300, 90, "sv-panel", "SIGINT handler", "shares the process", 15);
      b.t.setAttribute("y", 92);
      txt(stage, 330, 190, "printf and exit are not on the safe list. write and _exit are.", { cls: "sv-label" });
      return;
    }
    txt(stage, 36, 28, "children", { anchor: "start", cls: "sv-label" });
    kids.forEach((k, i) => {
      const b = box(stage, 36 + i * 200, 48, 180, 70, k === "zombie" ? "sv-bad" : k === "reaped" ? "sv-good" : "sv-panel", `pid ${14073 + i}`, k, 14);
      b.t.setAttribute("y", b.y + 28);
    });
    const pend = kids.some((k) => k === "zombie") || kids.some((k) => k === "exited-unseen");
    txt(stage, 330, 160, `SIGCHLD pending bit: ${kids.filter((k) => k === "zombie").length ? "1" : "0"}`, { bold: true });
    txt(stage, 330, 190, "One bit no matter how many children exited.", { cls: "sv-label" });
    void pend;
  }
  function setMode(i) {
    mode = i;
    kids = ["running", "running", "running"];
    const files = [
      [fileC("unsafe.c", UNSAFE, UNSAFE_RS)],
      [fileC("signal1.c", ONE, ONE_RS)],
      [fileC("signal2.c", LOOP, LOOP_RS)],
    ][i];
    cv.setFiles(files);
    drawKids();
    cv.calm();
    build();
    if (i === 0) cap("s855-cap", "This handler calls printf. Press the safe version to see the calls the book allows.");
    else cap("s855-cap", "Three children are running. Exit them all, then reap. Watch the pending bit stay a single 1.");
  }
  function build() {
    const ctr = K.$("#s855-controls");
    K.clear(ctr);
    if (mode === 0) {
      button(ctr, "Show the unsafe call", "", () => {
        cv.setFiles([fileC("unsafe.c", UNSAFE, UNSAFE_RS)]);
        cv.calm(); cv.at([2, 3], "bad");
        cv.notes({ 2: ["not safe", "bad"], 3: ["not safe", "bad"] });
        cap("s855-cap", "<b>printf</b> and <b>exit</b> are not async-signal-safe. They can tangle with the main program if it was inside printf or malloc when the signal arrived.");
      });
      button(ctr, "Safe handler", "primary", () => {
        cv.setFiles([fileC("safe.c", SAFE, SAFE_RS)]);
        cv.calm(); cv.at([2, 3], "good");
        cv.notes({ 2: ["Sio_puts → write", "good"], 3: ["_exit", "good"] });
        cv.out("Caught SIGINT!");
        cap("s855-cap", "<b>Sio_puts</b> only uses write. <b>_exit</b> terminates without flushing stdio. Save errno if the handler still returns. Keep the handler tiny.");
      });
    } else {
      button(ctr, "All three exit", "primary", () => {
        kids = ["zombie", "zombie", "zombie"];
        drawKids();
        cv.calm();
        cv.notes({ 1: ["pending bit = 1", "warn"] });
        cap("s855-cap", "Three children exited. The kernel still has <b>one</b> pending SIGCHLD. The bit does not count.");
      });
      button(ctr, "Receive SIGCHLD", "", () => {
        if (mode === 1) {
          const i = kids.indexOf("zombie");
          if (i >= 0) kids[i] = "reaped";
          drawKids();
          cv.calm(); cv.at([2], kids.includes("zombie") ? "bad" : "good");
          cv.notes({ 2: [kids.includes("zombie") ? "one reap, zombies remain" : "the only zombie", kids.includes("zombie") ? "bad" : "good"] });
          cap("s855-cap", kids.includes("zombie")
            ? "The handler reaped <b>one</b> child and returned. The others are still zombies, and the pending bit is clear — no second signal is coming for them."
            : "Nothing left to reap.");
        } else {
          kids = kids.map((k) => (k === "zombie" ? "reaped" : k));
          drawKids();
          cv.calm(); cv.at([3, 4], "good");
          cv.notes({ 3: ["loop until -1", "good"], 5: "errno restored" });
          cap("s855-cap", "The loop calls waitpid until it fails. Every zombie is reaped in this one delivery. errno is saved and restored so the handler does not clobber the main program.");
        }
      });
      button(ctr, "Reset", "", () => setMode(mode));
    }
  }
  K.$("#s855-seg").appendChild(seg(["SIGINT", "Reap one", "Reap loop"], 0, setMode, "s855-mode"));
  setMode(0);
})();

/* ================= 8.5.6 ================= */
(function race() {
  const svg = K.$("#s856-svg");
  const list = box(svg, 40, 50, 250, 140, "sv-panel", "job list", "empty", 16);
  const child = box(svg, 370, 50, 250, 140, "sv-panel", "child", "not forked", 16);
  list.t.setAttribute("y", 90);
  child.t.setAttribute("y", 90);
  const RACE = join([
    "pid = Fork();",
    "if (pid == 0) Execve(\"/bin/date\", argv, envp);",
    "addjob(pid);                 /* race window above */",
    "/* handler may already have called deletejob */",
  ]);
  const FIX = join([
    "sigprocmask(SIG_BLOCK, &mask_one, &prev);",
    "pid = Fork();",
    "if (pid == 0) {",
    "    sigprocmask(SIG_SETMASK, &prev, NULL);",
    "    Execve(\"/bin/date\", argv, envp);",
    "}",
    "addjob(pid);",
    "sigprocmask(SIG_SETMASK, &prev, NULL);",
  ]);
  const RACE_RS = join([
    "pid = unsafe { fork() };",
    "if pid == 0 { execve_checked(); }",
    "addjob(pid); // race window above",
    "// handler may already have called deletejob",
  ]);
  const FIX_RS = join([
    "unsafe { sigprocmask(SIG_BLOCK, &mask_one, &raw mut prev) };",
    "pid = unsafe { fork() };",
    "if pid == 0 {",
    "    unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) };",
    "    execve_checked();",
    "}",
    "addjob(pid);",
    "unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) };",
  ]);
  const cv = code("#s856-code", { label: "The code", files: [fileC("race.c", RACE, RACE_RS)] });
  let safe = false, step = 0;
  function paint() {
    cv.calm();
    if (!safe) {
      const frames = [
        { list: "empty", child: "not forked", lines: [1], cap: "The parent is about to fork. The job list does not know a child yet." },
        { list: "empty", child: "running pid 99", lines: [1, 2], tone: "warn", cap: "fork returned. The child is alive and the list still does not contain 99. This is the window." },
        { list: "empty", child: "exited · handler ran", lines: [4], tone: "bad", cap: "The child exited. SIGCHLD ran <b>deletejob</b> on an empty list. Nothing was removed." },
        { list: "[99] stuck", child: "zombie, not in a matched job", lines: [3], tone: "bad", cap: "<b>addjob(99)</b> records a job whose delete already happened. The entry will never be removed." },
      ];
      const f = frames[step];
      list.u.textContent = f.list;
      child.u.textContent = f.child;
      list.r.setAttribute("class", step === 3 ? "sv-bad" : "sv-panel");
      child.r.setAttribute("class", step >= 2 ? "sv-bad" : step === 1 ? "sv-data-soft" : "sv-panel");
      cv.at(f.lines, f.tone === "bad" ? "bad" : "on");
      cv.notes({ [f.lines[0]]: step === 3 ? ["never deleted", "bad"] : step === 2 ? ["deletejob missed", "bad"] : "window" });
      cap("s856-cap", f.cap);
    } else {
      const frames = [
        { list: "empty", child: "not forked", lines: [1], cap: "SIGCHLD is blocked before fork. A fast child cannot run the handler yet." },
        { list: "empty", child: "pid 99, signal pending", lines: [2, 3, 4], cap: "The child inherits the blocked set, so it <b>unblocks</b> before execve. In the parent, SIGCHLD stays blocked. If the child exits, the bit stays pending." },
        { list: "[99]", child: "may already have exited", lines: [7], tone: "good", cap: "<b>addjob</b> runs while the handler is still blocked. The job is on the list before anyone can delete it." },
        { list: "[]  deleted", child: "reaped", lines: [8], tone: "good", cap: "The parent unblocks. The pending SIGCHLD is received, deletejob finds 99, and the list matches reality." },
      ];
      const f = frames[step];
      list.u.textContent = f.list;
      child.u.textContent = f.child;
      list.r.setAttribute("class", step >= 2 ? "sv-good" : "sv-panel");
      child.r.setAttribute("class", step === 3 ? "sv-good" : "sv-panel");
      cv.at(f.lines, f.tone === "good" ? "good" : "on");
      cap("s856-cap", f.cap);
    }
  }
  function setMode(i) {
    safe = i === 1;
    step = 0;
    cv.setFiles([safe ? fileC("fixed.c", FIX, FIX_RS) : fileC("race.c", RACE, RACE_RS)]);
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
  const pidBox = box(svg, 36, 40, 160, 70, "sv-panel", "pid", "0", 16);
  const wait = box(svg, 230, 40, 180, 70, "sv-panel", "waiting", "—", 14);
  const gap = box(svg, 440, 40, 180, 70, "sv-panel", "gap", "none", 14);
  pidBox.t.setAttribute("y", 68); wait.t.setAttribute("y", 68); gap.t.setAttribute("y", 68);
  txt(svg, 330, 150, "SIGCHLD blocked until the wait. The handler sets pid.", { cls: "sv-label" });
  const status = txt(svg, 330, 190, "", { bold: true, size: 14 });
  const SOURCES = [
    join([
      "sigprocmask(SIG_SETMASK, &prev, NULL); /* unblock */",
      "while (!pid)",
      "    ;                 /* correct, wastes the core */",
    ]),
    join([
      "sigprocmask(SIG_SETMASK, &prev, NULL); /* unblock */",
      "while (!pid)          /* test sees 0 */",
      "    pause();          /* signal already received: sleep forever */",
    ]),
    join([
      "while (!pid)          /* SIGCHLD still blocked here */",
      "    sigsuspend(&prev); /* unblock + wait, one step */",
      "sigprocmask(SIG_SETMASK, &prev, NULL);",
    ]),
  ];
  const RUSTS = [
    join([
      "unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) }; // unblock",
      "while PID.load(Ordering::Relaxed) == 0",
      "{ /* correct, wastes the core */ }",
    ]),
    join([
      "unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) }; // unblock",
      "while PID.load(Ordering::Relaxed) == 0 // test sees 0",
      "{ unsafe { pause() }; } // signal already received: sleep forever",
    ]),
    join([
      "while PID.load(Ordering::Relaxed) == 0 // SIGCHLD still blocked here",
      "{ unsafe { sigsuspend(&prev) }; } // unblock + wait, one step",
      "unsafe { sigprocmask(SIG_SETMASK, &prev, std::ptr::null_mut()) };",
    ]),
  ];
  const cv = code("#s857-code", { label: "The code", files: [fileC("spin.c", SOURCES[0], RUSTS[0])] });
  let mode = 0, pid = 0, stuck = false;
  function paint(msg) {
    pidBox.u.textContent = String(pid);
    pidBox.r.setAttribute("class", pid ? "sv-good" : "sv-panel");
    wait.r.setAttribute("class", stuck ? "sv-bad" : pid ? "sv-good" : "sv-data-soft");
    wait.u.textContent = stuck ? "stuck" : pid ? "done" : (mode === 0 ? "spinning" : "asleep");
    gap.r.setAttribute("class", mode === 1 ? "sv-bad" : "sv-good");
    gap.u.textContent = mode === 1 ? "between test and pause" : mode === 2 ? "no gap" : "no sleep";
    status.textContent = stuck ? "sleeping forever" : pid ? "handler ran, pid is set" : "waiting for SIGCHLD";
    cv.calm();
    if (stuck) { cv.at([2, 3], "bad"); cv.notes({ 3: ["missed it", "bad"] }); }
    else if (pid) { cv.at([mode === 2 ? 2 : 2], "good"); cv.notes({ 2: ["pid nonzero", "good"] }); }
    cap("s857-cap", msg);
  }
  function deliver() {
    if (stuck) { paint("pause already missed the signal. Delivering another SIGCHLD is a new event; this toy stays stuck to show the race."); return; }
    if (mode === 1) {
      stuck = true; pid = 0;
      paint("The handler ran in the gap: it set pid, then pause began <b>after</b> that and sleeps forever, because the signal was already received.");
      pid = 99;
      pidBox.u.textContent = "99 (too late)";
      return;
    }
    pid = 99;
    paint(mode === 0
      ? "The spin loop sees pid become nonzero and stops. Correct, and it burned the CPU the whole time."
      : "sigsuspend atomically unblocks and waits. A signal that was already pending, or one that arrives now, runs the handler and sigsuspend returns. There is no gap.");
  }
  function setMode(i) {
    mode = i; pid = 0; stuck = false;
    cv.setFiles([fileC(["spin.c", "pause.c", "sigsuspend.c"][i], SOURCES[i], RUSTS[i])]);
    paint(["The spin loop is correct and wasteful. Press deliver.", "Unblock, test, then pause. Press deliver to hit the gap.", "The test happens while SIGCHLD is still blocked. sigsuspend opens that window atomically."][i]);
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
  const SETJMP = join([
    "jmp_buf buf;",
    "int main(void) {",
    "    switch (setjmp(buf)) {",
    "    case 0: foo(); break;",
    "    case 2: printf(\"error2 in foo\\n\"); break;",
    "    }",
    "}",
    "void foo(void) { bar(); }",
    "void bar(void) { if (error2) longjmp(buf, 2); }",
  ]);
  const RESTART = join([
    "sigjmp_buf buf;",
    "void handler(int sig) { siglongjmp(buf, 1); }",
    "int main(void) {",
    "    if (!sigsetjmp(buf, 1)) {",
    "        Signal(SIGINT, handler);   /* install after the bookmark */",
    "        Sio_puts(\"starting\\n\");",
    "    } else Sio_puts(\"restarting\\n\");",
    "    Sio_puts(\"processing...\\n\");",
    "}",
  ]);
  const SETJMP_RS = join([
    "static mut BUF: JmpBuf = JmpBuf([0; 25]); // setjmp returns twice: undefined behaviour in Rust",
    "fn main() {",
    "    match unsafe { setjmp(&raw mut BUF) } {",
    "        0 => foo(),",
    "        2 => { println!(\"error2 in foo\"); }",
    "        _ => {}",
    "    } }",
    "fn foo() { bar(); }",
    "fn bar() { if ERROR2 { unsafe { longjmp(&raw mut BUF, 2) }; } }",
    "const ERROR2: bool = true;",
  ]);
  const RESTART_RS = join([
    "static mut BUF: JmpBuf = JmpBuf([0; 25]); // sigsetjmp returns twice: undefined behaviour too",
    "extern \"C\" fn handler(_sig: i32) { unsafe { siglongjmp(&raw mut BUF, 1) }; }",
    "fn main() {",
    "    if unsafe { sigsetjmp(&raw mut BUF, 1) } == 0 {",
    "        unsafe { signal(SIGINT, handler) }; // install after the bookmark",
    "        println!(\"starting\");",
    "    } else { println!(\"restarting\"); }",
    "    println!(\"processing...\");",
    "}",
  ]);
  const cv = code("#s86-code", { label: "The code", files: [fileC("setjmp.c", SETJMP, SETJMP_RS)] });
  let mode = 0, step = 0;
  function paintJmp() {
    K.clear(stage);
    const frames = [
      { name: "main", sub: "setjmp → 0" },
      { name: "foo", sub: "called" },
      { name: "bar", sub: "longjmp(buf, 2)" },
      { name: "main", sub: "setjmp → 2" },
    ];
    frames.forEach((f, i) => {
      const on = i === step;
      const skipped = step === 3 && (i === 1 || i === 2);
      const b = box(stage, 36 + i * 155, 70, 140, 80, skipped ? "sv-bad" : on ? "sv-good" : "sv-panel", f.name, f.sub, 14);
      b.t.setAttribute("y", b.y + 30);
    });
    const lines = [3, 8, 9, 5];
    cv.show("setjmp.c");
    cv.calm();
    cv.at([lines[step]], step === 3 ? "good" : "on");
    cv.notes({ [lines[step]]: step === 0 ? ["returns 0", "warn"] : step === 3 ? ["returns 2", "good"] : "deeper frame" });
    cv.out(step === 3 ? "error2 in foo" : null);
    cap("s86-cap", [
      "setjmp saves main’s registers and stack pointer, then returns <b>0</b>. case 0 is about to call foo.",
      "case 0 called <b>foo</b>. The stack is main, then foo. foo has not returned.",
      "foo called <b>bar</b>. bar is about to <span class=\"mono\">longjmp(buf, 2)</span>. That 2 is what setjmp will appear to return.",
      "longjmp restored main. foo and bar are skipped — anything they meant to free is leaked. setjmp returns <b>2</b>, and case 2 runs. It was called once and returned twice.",
    ][step]);
  }
  function paintRestart() {
    K.clear(stage);
    const phases = ["bookmark", "handler installed", "processing", "Ctrl+C restart"];
    phases.forEach((name, i) => {
      box(stage, 30 + (i % 4) * 155, 80, 145, 64, i === step ? "sv-good" : i < step ? "sv-data-soft" : "sv-panel", name, null, 12);
    });
    const lines = [4, 5, 8, 7];
    cv.show("restart.c");
    cv.calm();
    cv.at([lines[step]], step === 3 ? "good" : "on");
    cv.out(step === 0 ? null : step === 1 ? null : step === 2 ? "starting\nprocessing..." : "starting\nprocessing...\nrestarting\nprocessing...");
    cap("s86-cap", [
      "sigsetjmp saves the environment first and returns 0. The handler is not installed yet, so Ctrl+C cannot jump to a bookmark that does not exist.",
      "The handler is installed only after the bookmark exists. Ctrl+C can now siglongjmp back to this sigsetjmp.",
      "Processing is running. The bookmark is still the sigsetjmp call, which returned 0 the first time.",
      "The handler calls siglongjmp. sigsetjmp returns nonzero, the else branch prints restarting, and processing starts again.",
    ][step]);
  }
  function setMode(i) {
    mode = i; step = 0;
    cv.setFiles([i ? fileC("restart.c", RESTART, RESTART_RS) : fileC("setjmp.c", SETJMP, SETJMP_RS)]);
    (i ? paintRestart : paintJmp)();
  }
  K.$("#s86-seg").appendChild(seg(["longjmp", "Ctrl+C restart"], 0, setMode, "s86-mode"));
  const ctr = K.$("#s86-controls");
  button(ctr, "Step", "primary", () => { if (step < 3) { step++; (mode ? paintRestart : paintJmp)(); } });
  button(ctr, "Reset", "", () => setMode(mode));
  setMode(0);
})();

/* ================= 8.7 ================= */
(function tools() {
  const svg = K.$("#s87-svg");
  const rows = [
    { name: "shell", pid: "10", st: "S" },
    { name: "job", pid: "20", st: "R" },
    { name: "job", pid: "21", st: "Z" },
  ];
  txt(svg, 36, 28, "PROCESS TABLE", { anchor: "start", cls: "sv-label" });
  const boxes = rows.map((r, i) => box(svg, 36 + i * 200, 44, 180, 70, r.st === "Z" ? "sv-bad" : "sv-panel", `${r.pid} ${r.name}`, r.st === "Z" ? "zombie" : r.st === "R" ? "running" : "sleeping", 14));
  boxes.forEach((b) => b.t.setAttribute("y", b.y + 28));
  const TOOLS = {
    ps: {
      cmd: "linux> ps",
      out: "  PID TTY STAT CMD\n   10 pts/0 S    bash\n   20 pts/0 R    job\n   21 pts/0 Z    job <defunct>",
      cap: "<b>ps</b> lists processes, zombies included. STAT Z is the unreaped child from earlier in the chapter.",
      hi: 2,
    },
    top: {
      cmd: "linux> top",
      out: "PID  %CPU  COMMAND\n 20   96.0  job\n 10    0.1  bash\n 21    0.0  job",
      cap: "<b>top</b> shows who is using the machine. The zombie uses a table slot and essentially no CPU.",
      hi: 1,
    },
    pmap: {
      cmd: "linux> pmap 20",
      out: "20: job\n0000000000400000  8K r-x-- code\n0000000000600000  4K rw--- data\n00007ffffffde000  8K rw--- stack",
      cap: "<b>pmap</b> prints the memory map: code near 0x400000, data, stack. That is Figure 8.13 as a tool.",
      hi: 1,
    },
    strace: {
      cmd: "linux> strace -static ./job",
      out: "execve(\"./job\", ..., ...)\nwrite(1, \"hi\\n\", 3) = 3\nexit_group(0)",
      cap: "<b>strace</b> prints each system call. <span class=\"mono\">-static</span> keeps shared-library calls out of the trace.",
      hi: 1,
    },
    proc: {
      cmd: "linux> cat /proc/loadavg",
      out: "0.15 0.10 0.05 1/121 20",
      cap: "<b>/proc</b> is kernel state as text. loadavg is the load. <span class=\"mono\">/proc/21/status</span> would say State: Z.",
      hi: 2,
    },
  };
  const cv = code("#s87-code", { label: "The code", files: [{ name: "tool.sh", lang: "sh", src: "linux> ps" }] });
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
    { name: "Application", sub: "signals, setjmp", file: "app.c", src: join(["void handler(int s) {", "    siglongjmp(buf, 1);", "}"]), rs: join(["extern \"C\" fn handler(_s: i32) {", "    unsafe { siglongjmp(std::ptr::addr_of_mut!(BUF).cast(), 1) };", "}", "static mut BUF: [i32; 49] = [0; 49];"]), cap: "At the top, a program catches a signal or jumps back to a bookmark. The process stays the same; the control flow inside it does not." },
    { name: "Kernel", sub: "processes, switches", file: "sched.c", src: join(["void schedule(void) {", "    save(current);", "    current = pick();", "    restore(current);", "}"]), rs: join(["fn schedule() {", "    unsafe { save(*std::ptr::addr_of!(CURRENT)) };", "    unsafe { *std::ptr::addr_of_mut!(CURRENT) = pick() };", "    unsafe { restore(*std::ptr::addr_of!(CURRENT)) };", "}", "static mut CURRENT: i32 = 0;", "fn save(_: i32) {}", "fn pick() -> i32 { 0 }", "fn restore(_: i32) {}"]), cap: "In the middle, the kernel uses exceptions to build processes: save one context, restore another, deliver signals, reap zombies." },
    { name: "Hardware", sub: "exception table", file: "cpu.s", src: join(["# event k", "jmp  *exception_table(,%k,8)"]), cap: "At the bottom, the processor indexes the exception table and runs a handler. Interrupts, traps, faults, and aborts are this mechanism." },
  ];
  const cards = LAYERS.map((L, i) => box(svg, 36, 24 + i * 70, 420, 58, "sv-panel", L.name, L.sub, 15));
  cards.forEach((b) => b.t.setAttribute("y", b.y + 24));
  const cv = code("#s88-code", { label: "The code", files: [{ name: "cpu.s", lang: "asm", src: LAYERS[2].src }] });
  function pick(i) {
    cards.forEach((b, k) => b.r.setAttribute("class", k === i ? "sv-good" : "sv-panel"));
    const L = LAYERS[i];
    cv.setFiles([L.rs ? fileC(L.file, L.src, L.rs) : { name: L.file, lang: "asm", src: L.src }]);
    cv.at([1, 2], "good");
    pill("s88-pill", L.name);
    cap("s88-cap", L.cap);
  }
  cards.forEach((b, i) => {
    b.r.style.cursor = "pointer";
    b.r.setAttribute("role", "button");
    b.r.setAttribute("tabindex", "0");
    b.r.setAttribute("aria-label", LAYERS[i].name);
    b.r.addEventListener("click", () => pick(i));
  });
  const ctr = K.$("#s88-controls");
  LAYERS.forEach((L, i) => button(ctr, L.name, i === 2 ? "primary" : "", () => pick(i)));
  pick(2);
})();

K.quiz(K.$("#quiz-root"), [
  { q: "A timer interrupt handler finishes. Where does it return?", options: ["Always to the next instruction (Inext)", "Always to the faulting instruction (Icurr)", "It never returns", "Wherever gcc left the return address in %rbx"], answer: 0, why: "An interrupt is asynchronous and the handler returns to the next instruction, as if the program had not been interrupted." },
  { q: "Linux gets a divide-error fault (exception 0). What does the process see?", options: ["The instruction is retried with a different divisor", "The process is killed; shells often say Floating exception", "It becomes a system call", "The fault is ignored"], answer: 1, why: "A fault may be recoverable — page faults are — but Linux does not repair a divide by zero." },
  { q: "In Figure 8.12, B finishes before C starts. Which statement is true?", options: ["B and C run concurrently", "B and C do not run concurrently", "B and C are parallel", "A does not overlap anyone"], answer: 1, why: "Concurrent means the lifetimes overlap. B is finished when C begins, so that pair does not overlap. A overlaps both." },
  { q: "How does user code enter kernel mode?", options: ["By writing the mode bit", "Only through an exception, such as a system call or a fault", "By calling a function in the kernel’s address range", "By reading /proc"], answer: 1, why: "The mode bit changes to kernel mode when an exception occurs. A direct jump at kernel memory faults. /proc is itself reached by a system call." },
  { q: "fork returns. What is true?", options: ["It returns the child’s PID in both processes", "It returns 0 to the child and the child’s PID to the parent", "It returns once, in the parent only", "It replaces the program, like execve"], answer: 1, why: "fork is called once and returns twice. The child receives 0. execve is the call that replaces the program and does not return on success." },
  { q: "A child has exited and the parent has not waited. What is the child?", options: ["An orphan adopted by init already", "A zombie: terminated, still occupying a kernel slot", "Running, with a stopped parent", "Reaped automatically after one time slice"], answer: 1, why: "A terminated unreaped process is a zombie. init adopts it only if the parent dies first." },
  { q: "Two SIGINT signals arrive while the first is still pending. How many will be received?", options: ["Two", "One", "None, SIGINT cannot be pending", "Thirty, one per signal type"], answer: 1, why: "Pending is a bit per signal type. A second signal of the same type is discarded while the first is still pending." },
  { q: "Ctrl+C is typed. Who receives SIGINT?", options: ["Only the shell", "Every process in the foreground process group", "Every process on the machine", "Only PID 1"], answer: 1, why: "The kernel sends SIGINT to the foreground process group, not to background jobs and not to the shell’s own group." },
  { q: "Three children exit before the parent handles SIGCHLD, and the handler waits for one child. What remains?", options: ["Nothing; one signal means three children", "Two zombies, and no second signal for them", "The parent is killed", "The pending bit stays at 3"], answer: 1, why: "One pending bit means at least one event, not a count. A correct handler loops on waitpid until no child remains." },
  { q: "Why can while (!pid) pause(); sleep forever?", options: ["pause ignores SIGCHLD", "The signal can be received after the test and before pause", "pause only wakes up for SIGKILL", "pid cannot change in a handler"], answer: 1, why: "If the handler runs in that gap, pid is already set and the signal is used up. pause then waits for a signal that is not coming. sigsuspend closes the gap." },
], 8);
