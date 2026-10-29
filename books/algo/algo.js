/* Algorithm Alley — helpers every chapter of this book shares. Load after assets/kit.js:
     <script src="book.js"></script><script src="../../assets/kit.js"></script><script src="algo.js"></script>
   then  const { cap, esc, box, txt, clickable, button, session, code, mem, cells, src, fmt, CODE_LANG } = AL;

   code()  the panel under a machine: the book's pseudocode, or a runnable Rust twin (one toggle for the page)
   mem()   a small stack-and-heap strip that shows where the Rust program keeps its data
   cells() a row of array cells inside a machine's SVG, indexed from 1 (the book) or 0 (Rust)
   box / txt / clickable / button / session — the SVG and run helpers the other books copy into each page. */
(function () {
  const { h, s } = K;
  const cap = (id, html) => { K.$(id).innerHTML = html; };
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fmt = (n) => Number(n).toLocaleString("en-US");

  /** Box + title (+ optional subtitle) fully inside the rectangle. Returns geometry. */
  function box(parent, x, y, w, hgt, cls, title, sub, size = 13) {
    const r = s("rect", { x, y, width: w, height: hgt, rx: 10, class: cls });
    parent.appendChild(r);
    let t = null, u = null;
    if (title != null) {
      t = s("text", { x: x + w / 2, y: sub != null ? y + hgt / 2 - 3 : y + hgt / 2 + 4.5, class: "sv-text", "text-anchor": "middle", style: { fontWeight: 700, fontSize: size + "px" } }, title);
      parent.appendChild(t);
    }
    if (sub != null) {
      u = s("text", { x: x + w / 2, y: y + hgt / 2 + 13, class: "sv-label", "text-anchor": "middle" }, sub);
      parent.appendChild(u);
    }
    return { r, t, u, x, y, w, h: hgt, cx: x + w / 2, cy: y + hgt / 2 };
  }
  const txt = (parent, x, y, str, o = {}) => {
    const t = s("text", { x, y, class: o.cls || "sv-text", "text-anchor": o.anchor || "middle", style: Object.assign({}, o.mono ? { fontFamily: "var(--f-mono)" } : {}, o.size ? { fontSize: o.size + "px" } : {}, o.bold ? { fontWeight: 700 } : {}, o.fill ? { fill: o.fill } : {}) }, str);
    parent.appendChild(t); return t;
  };
  /** Make an SVG group behave like a button (click, Enter, Space). */
  function clickable(g, label, fn) {
    g.setAttribute("class", ((g.getAttribute("class") || "") + " clickable").trim());
    g.setAttribute("tabindex", "0"); g.setAttribute("role", "button"); g.setAttribute("aria-label", label);
    g.addEventListener("click", fn);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
    return g;
  }
  function button(ctr, label, cls, fn) {
    const b = h("button", { class: "btn" + (cls ? " " + cls : ""), type: "button" }, label);
    b.addEventListener("click", fn); ctr.appendChild(b); return b;
  }
  /** A cancellable animation run. S.run(async (w) => { await w(fly(...)); }) — w() throws once S.cancel() is called,
      so an old animation stops touching state the moment the viewer resets or switches mode. */
  function session(onBusy) {
    let gen = 0, busy = false;
    const STOP = { stop: true };
    const set = (v) => { busy = v; onBusy && onBusy(v); };
    return {
      get busy() { return busy; },
      cancel() { gen++; if (busy) set(false); },
      async run(fn) {
        if (busy) return false;
        const my = ++gen; set(true);
        const w = async (p) => { const v = await p; if (my !== gen) throw STOP; return v; };
        try { await fn(w); } catch (e) { if (e !== STOP) throw e; return false; }
        if (my === gen) set(false);
        return true;
      },
    };
  }

  /** Text of a <script type="text/x-…" id="…"> block: pseudocode, Rust, or a program's real output. */
  function src(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error("no source block #" + id);
    return el.textContent.replace(/^\n/, "").replace(/\s+$/, "");
  }

  /* ---------- Pseudocode or Rust: one choice for every code panel on the page ----------
     Starts as the book's pseudocode; ?code=rust in the address picks Rust. */
  const CODE_LANG = (() => {
    let v = "pseudo";
    try { if (new URLSearchParams(location.search).get("code") === "rust") v = "rust"; } catch (e) {}
    const subs = [];
    return {
      get v() { return v; },
      get rust() { return v === "rust"; },
      on(fn) { subs.push(fn); },
      set(nv) {
        if (nv === v) return;
        v = nv;
        try { const u = new URL(location.href); if (v === "rust") u.searchParams.set("code", "rust"); else u.searchParams.delete("code"); history.replaceState(null, "", u); } catch (e) {}
        subs.forEach((fn) => fn(v));
      },
    };
  })();
  function langToggle() {
    const wrap = h("div", { class: "cp-lang", role: "group", "aria-label": "Show the book's pseudocode or the Rust version" });
    const bs = [["pseudo", "Pseudocode"], ["rust", "Rust"]].map(([k, label]) => {
      const b = h("button", { type: "button", "data-lang": k, "aria-pressed": String(CODE_LANG.v === k) }, label);
      b.addEventListener("click", () => CODE_LANG.set(k));
      wrap.appendChild(b); return b;
    });
    CODE_LANG.on((v) => bs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === v))));
    return wrap;
  }
  const first = document.querySelector(".first");
  if (first) first.appendChild(langToggle());

  /* ---------- syntax colours ---------- */
  const TOKENS = {
    // the book's pseudocode: bold keywords, PROCEDURE-NAMES, // comments
    clrs: [
      [/\/\/.*/, "cm"],
      [/"(?:[^"\\]|\\.)*"/, "st"],
      [/\b(?:NIL|TRUE|FALSE)\b/, "kw"],
      [/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b|\b[A-Z]{2,}[A-Z0-9]*(?=\()/, "pc"],
      [/\b(?:for|to|downto|by|while|do|if|then|else|elseif|return|and|or|not|repeat|until|each|in|let|new|error|spawn|sync|parallel|print|break)\b/, "kw"],
      [/\b\d+(?:\.\d+)?\b/, "nu"],
    ],
    rust: [
      [/\/\/.*|\/\*.*?\*\//, "cm"],
      [/[bc]?"(?:[^"\\]|\\.)*"|b?'(?:[^'\\]|\\.)'/, "st"],
      [/'[a-z_]\w*\b(?!')/, "lt"],
      [/#!?\[[^\]]*\]/, "pp"],
      [/\b[a-z_]\w*!/, "pp"],
      [/\b(?:i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|char|str|Self)\b/, "ty"],
      [/\b(?:fn|let|mut|for|in|while|loop|if|else|match|return|use|mod|pub|static|const|struct|enum|trait|impl|where|type|ref|self|crate|super|unsafe|extern|move|as|dyn|break|continue|Some|None|Ok|Err|true|false)\b/, "kw"],
      [/\b[A-Z][a-z]\w*\b/, "ty"],
      [/\b(?:0x[0-9a-fA-F_]+(?:u8|u16|u32|u64|usize)?|\d[\d_]*(?:\.\d+)?(?:e-?\d+)?(?:[iuf](?:8|16|32|64|128|size))?)\b/, "nu"],
      [/\b[A-Za-z_]\w*(?=\s*\()/, "fn"],
    ],
    sh: [
      [/^\$/, "pr"],
      [/#.*/, "cm"],
    ],
    text: [],
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

  /* Pseudocode is numbered the way the book numbers it: a procedure's header line (NAME(args) at the left
     margin, first in the listing or after a blank line) has no number and restarts the count, blank lines
     have none, and a call such as MERGE(A, p, q, r) inside a body is an ordinary line. Engines use the book's numbers:
       3          line 3 of the first procedure in the file      "MERGE:4"  line 4 of MERGE
       "MERGE"    MERGE's header line                            "rs:12"    Rust line 12 (Rust view only) */
  const HEADER = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\s*\(.*\)\s*$/;
  function numberLines(lines, lang) {
    const labels = [], heads = new Set(), index = { procs: {}, first: null, plain: {} };
    if (lang !== "clrs") { lines.forEach((_, i) => { labels.push(String(i + 1)); index.plain[i + 1] = i + 1; }); return { labels, heads, index }; }
    let proc = null, n = 0;
    lines.forEach((line, i) => {
      if (HEADER.test(line) && (i === 0 || !lines[i - 1].trim())) {
        heads.add(i);
        proc = line.slice(0, line.indexOf("(")).trim(); n = 0;
        index.procs[proc] = { hdr: i + 1, lines: {} };
        if (!index.first) index.first = proc;
        labels.push("");
      } else if (!line.trim()) labels.push("");
      else {
        n++; labels.push(String(n));
        if (proc) index.procs[proc].lines[n] = i + 1; else index.plain[n] = i + 1;
      }
    });
    return { labels, heads, index };
  }
  function resolve(ref, index) {
    if (typeof ref === "number") return index.first ? index.procs[index.first].lines[ref] : index.plain[ref];
    const str = String(ref), k = str.lastIndexOf(":");
    if (k < 0) {
      if (/^\d+$/.test(str)) return resolve(Number(str), index);
      return index.procs[str] && index.procs[str].hdr;
    }
    const name = str.slice(0, k), n = Number(str.slice(k + 1));
    const p = index.procs[name];
    return p && (n === 0 ? p.hdr : p.lines[n]);
  }

  /* ---------- the code panel under every machine ----------
     const cv = code("#s1-code", { files: [{ name: "INSERTION-SORT", lang: "clrs", src: src("ps-s1"),
       rs: { name: "insertion_sort.rs", src: src("rs-s1"), out: src("rs-s1-out"), map: { 1: 9, 2: 10, … } } }] });
     Engines always speak in the book's line numbers (see above); rs.map turns them into Rust lines
     ({ ref: rustLine | [rustLines] }). In the Rust view the panel shows the program's real output.
     cv.show(name) · cv.setFiles(list) · cv.at(refs, cls) · cv.clear() · cv.notes(map, rustMap?) · cv.out(text, rustText?) */
  function code(sel, o) {
    const root = K.$(sel);
    root.className = "codepane";
    const tabs = h("div", { class: "cp-tabs" });
    const tools = h("span", { class: "cp-tools" });
    const cmd = h("span", { class: "cp-cmd" });
    root.appendChild(h("div", { class: "cp-head" }, h("span", { class: "cp-k" }, o.label || "The algorithm"), tabs, tools, langToggle(), cmd));
    const body = h("div", { class: "cp-body", tabindex: "0", role: "region", "aria-label": (o.label || "The algorithm") + " listing" });
    const ol = h("ol", {});
    body.appendChild(ol);
    const out = h("pre", { class: "cp-out", hidden: true, "aria-live": "polite" });
    root.append(body, out);
    const clone = (f) => Object.assign({}, f, f.rs ? { rs: Object.assign({}, f.rs) } : {});
    let files = o.files.map(clone);
    let cur = null, lis = [], idx = null;
    const fresh = () => ({ marks: {}, notes: [null, null] });
    let req = fresh(), outReq = [null, null];
    const rs = () => CODE_LANG.rust && !!(cur && cur.rs);
    const view = () => (rs() ? Object.assign({ lang: "rust" }, cur.rs) : Object.assign({ lang: "clrs" }, cur));
    // pseudocode refs → listing lines of what is on screen
    const tr = (refs) => {
      const outL = [];
      [].concat(refs).forEach((r) => {
        const str = String(r);
        if (str.startsWith("rs:")) { if (rs()) outL.push(Number(str.slice(3))); return; }
        if (!rs()) { const n = resolve(r, idx.pseudo); if (n) outL.push(n); return; }
        const m = cur.rs.map || {};
        const key = typeof r === "number" ? String(r) : str;
        const v = m[key] != null ? m[key] : (/^\d+$/.test(key) && idx.pseudo.first && m[`${idx.pseudo.first}:${key}`]);
        if (v != null && v !== false) outL.push(...[].concat(v));
      });
      return outL;
    };
    function drawTabs() {
      K.clear(tabs);
      const label = (f) => (CODE_LANG.rust && f.rs ? f.rs.name : f.name);
      if (files.length === 1 && !o.tabs) { tabs.appendChild(h("span", { class: "cp-file" }, label(files[0]))); return; }
      files.forEach((f) => {
        const b = h("button", { type: "button", class: "cp-tab", "aria-pressed": String(f === cur) }, label(f));
        b.addEventListener("click", () => { show(f.name); o.onTab && o.onTab(f.name); });
        tabs.appendChild(b);
      });
    }
    function drawTools() {
      K.clear(tools);
      if (!rs()) return;
      const text = cur.rs.src;
      const copy = h("button", { type: "button", title: "Copy the Rust program" }, "Copy");
      copy.addEventListener("click", () => {
        try {
          const p = navigator.clipboard && navigator.clipboard.writeText(text);
          if (p && p.then) p.then(() => K.toast("Rust program copied"), () => K.toast("Copy is blocked here — select the code instead"));
        } catch (e) { K.toast("Copy is blocked here — select the code instead"); }
      });
      const play = h("a", { href: "https://play.rust-lang.org/?version=stable&mode=debug&edition=2021&code=" + encodeURIComponent(text), target: "_blank", rel: "noopener", title: "Open this program in the Rust Playground and run it" }, "Run ↗");
      tools.append(copy, play);
    }
    function scrollTo(li) {
      const top = li.offsetTop, bottom = top + li.offsetHeight;
      if (top < body.scrollTop + 6) body.scrollTop = Math.max(0, top - 24);
      else if (bottom > body.scrollTop + body.clientHeight - 6) body.scrollTop = bottom - body.clientHeight + 24;
    }
    function paintMarks(cls, scroll) {
      lis.forEach((li) => li.classList.remove(cls));
      const list = tr(req.marks[cls] || []).filter((n) => lis[n - 1]);
      list.forEach((n) => lis[n - 1].classList.add(cls));
      if (scroll && list.length) scrollTo(lis[list[0] - 1]);
    }
    function paintNotes() {
      lis.forEach((li) => { const n = li.querySelector(".cp-note"); if (n) n.remove(); });
      const entries = [];
      if (rs() && req.notes[1]) Object.entries(req.notes[1]).forEach(([k, v]) => entries.push([Number(k), v]));
      else Object.entries(req.notes[0] || {}).forEach(([k, v]) => { const n = tr([/^\d+$/.test(k) ? Number(k) : k])[0]; if (n) entries.push([n, v]); });
      entries.forEach(([n, v]) => {
        const li = lis[n - 1]; if (!li || v == null || v === "") return;
        const [t, tone] = Array.isArray(v) ? v : [v];
        li.appendChild(h("span", { class: "cp-note" + (tone ? " " + tone : "") }, t));
      });
    }
    function paintOut() {
      let t2 = outReq[0];
      if (rs()) t2 = outReq[1] != null ? outReq[1] : (cur.rs.out != null ? cur.rs.out : null);
      out.hidden = t2 == null; out.textContent = t2 || "";
    }
    function render() {
      const v = view();
      K.clear(ol);
      const lines = v.src.split("\n");
      const num = numberLines(lines, v.lang);
      lis = lines.map((line, i) => {
        const li = h("li", { "data-n": num.labels[i] });
        if (num.heads.has(i)) li.classList.add("hd");
        li.innerHTML = highlight(line, v.lang) || " ";
        ol.appendChild(li); return li;
      });
      let cmdText = v.cmd || "";
      if (rs() && !cmdText) { const base = cur.rs.name.replace(/\s*\(.*\)$/, "").replace(/\.rs$/, ""); cmdText = `$ rustc ${base}.rs && ./${base}`; }
      if (CODE_LANG.rust && !cur.rs) cmdText = cur.rsNote || "pseudocode only — no Rust for this listing";
      cmd.textContent = cmdText;
      Object.keys(req.marks).forEach((cls) => paintMarks(cls, false));
      paintNotes(); paintOut(); drawTools();
    }
    function show(name) {
      const f = files.find((x) => x.name === name) || files[0];
      if (f !== cur) {
        cur = f; req = fresh();
        idx = { pseudo: numberLines(cur.src.split("\n"), cur.lang || "clrs").index };
        render(); body.scrollTop = 0;
      }
      drawTabs();
    }
    CODE_LANG.on(() => { render(); drawTabs(); });
    const api = {
      show,
      get file() { return cur.name; },
      get rust() { return rs(); },
      /** swap the whole set of files (a machine changed mode) */
      setFiles(list) { files = list.map(clone); cur = null; outReq = [null, null]; show(files[0].name); },
      /** highlight lines by the book's numbers: on (running), on2 (second flow), dim (paused), good, bad */
      at(refs, cls = "on", scroll = true) { req.marks[cls] = refs == null ? [] : [].concat(refs); paintMarks(cls, scroll); },
      /** drop every highlight and note */
      clear() { Object.keys(req.marks).forEach((c) => { req.marks[c] = []; paintMarks(c, false); }); req.notes = [null, null]; paintNotes(); },
      /** live values at the ends of lines: notes({ 2: "key = 41", "MERGE:4": ["n1 = 3", "good"] }, rustLineMap?) */
      notes(map, rustMap) { req.notes = [map, rustMap || null]; paintNotes(); },
      /** what the pseudocode run produced (and, optionally, a Rust-view override of the program's output) */
      out(text, rustText) { outReq = [text == null ? null : text, rustText == null ? null : rustText]; paintOut(); },
    };
    show(files[0].name);
    return api;
  }

  /* ---------- memory strip: where the Rust program keeps things ----------
     const m = mem("#s1-mem");
     m.set({
       note: "…",
       stack: [{ fn: "main", vars: [{ n: "v", t: "Vec<i32>", v: "len 6 · cap 6", ptr: "buf" }] },
               { fn: "insertion_sort", top: true, vars: [{ n: "a", t: "&mut [i32]", v: "len 6", ptr: "buf" }, { n: "key", t: "i32", v: "41", hot: true }] }],
       heap: [{ id: "buf", label: "Vec buffer · 6 × i32", cells: [31, 41, …], marks: { 1: "on" }, ptrs: [{ from: 2, to: "n2" }], x, y, cw }],
     });
     A ptr may name a block ("buf") or one cell of it ("buf:3"). Frames stack downward: the newest call is last. */
  const ROW = 19, FRAME_HEAD = 21;
  function mem(sel, o = {}) {
    const root = K.$(sel);
    root.className = "memstrip";
    const note = h("span", { class: "mem-note", "aria-live": "polite" });
    root.appendChild(h("div", { class: "mem-head" }, h("span", { class: "mem-k" }, o.label || "Stack and heap · the Rust run"), note));
    const svg = s("svg", { viewBox: "0 0 660 120", role: "img", "aria-label": o.aria || "The Rust program's stack frames on the left and its heap blocks on the right, with arrows for pointers" });
    root.appendChild(h("div", { class: "stage-scroll" }, svg));
    const SX = 14, SW = 300, HX = 352, HW = 294, TOP = 30;
    function arrow(g, x1, y1, x2, y2, weak, toTop) {
      const d = toTop
        ? `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${y1 - 30} ${x2},${y2}`
        : `M${x1},${y1} C${x1 + 36},${y1} ${x2 - 36},${y2} ${x2},${y2}`;
      g.appendChild(s("path", { d, class: "mem-ptr" + (weak ? " weak" : "") }));
      const a = toTop ? [[x2, y2], [x2 - 4, y2 - 7], [x2 + 4, y2 - 7]] : [[x2, y2], [x2 - 7, y2 - 4], [x2 - 7, y2 + 4]];
      g.appendChild(s("path", { d: `M${a[0]} L${a[1]} L${a[2]} Z`, class: "mem-dot" }));
    }
    function set(state) {
      K.clear(svg);
      note.innerHTML = state.note || "";
      const g = s("g"), arrows = s("g");
      svg.append(g, arrows);
      g.appendChild(s("text", { x: SX, y: 16, class: "mem-head2" }, "STACK · newest frame last"));
      g.appendChild(s("text", { x: HX, y: 16, class: "mem-head2" }, "HEAP"));
      g.appendChild(s("line", { x1: 333, y1: 8, x2: 333, y2: 2000, class: "sv-wire", style: { opacity: 0.6 } }));
      // heap first, so pointers know where to land
      const blocks = {};
      let hy = TOP;
      (state.heap || []).forEach((b) => {
        const n = (b.cells || []).length;
        const cw = b.cw || Math.max(16, Math.min(32, Math.floor((HW - 4) / Math.max(1, n))));
        const x = HX + (b.x || 0), y = b.y != null ? TOP + b.y : hy;
        if (b.label) g.appendChild(s("text", { x, y: y + 10, class: "mem-blk" }, b.label));
        const cy = y + 15;
        const cellPos = [];
        (b.cells || []).forEach((v, i) => {
          const cx = x + i * cw;
          const cls = "mem-cell" + (b.free ? " free" : "") + (b.marks && b.marks[i] ? " " + b.marks[i] : "");
          g.appendChild(s("rect", { x: cx, y: cy, width: cw, height: 22, class: cls }));
          const isPtr = (b.ptrs || []).some((p) => p.from === i);
          if (isPtr) g.appendChild(s("circle", { cx: cx + cw / 2, cy: cy + 11, r: 3.2, class: "mem-dot" }));
          else if (v != null && v !== "") g.appendChild(s("text", { x: cx + cw / 2, y: cy + 15, class: "mem-cv", "text-anchor": "middle", style: String(v).length * 6.7 > cw - 2 ? { fontSize: "9.5px" } : {} }, String(v)));
          cellPos.push({ x: cx, y: cy, w: cw, cx: cx + cw / 2, cy: cy + 11 });
        });
        blocks[b.id] = { x, y: cy, w: n * cw, cells: cellPos, b };
        if (b.y == null) hy = cy + 22 + 12;
      });
      // stack frames
      let sy = TOP;
      const ptrs = [];
      (state.stack || []).forEach((f) => {
        const hgt = FRAME_HEAD + f.vars.length * ROW + 4;
        g.appendChild(s("rect", { x: SX, y: sy, width: SW, height: hgt, rx: 7, class: "mem-frame" + (f.top ? " top" : "") + (f.gone ? " gone" : "") }));
        g.appendChild(s("text", { x: SX + 10, y: sy + 15, class: "mem-fn" }, f.fn));
        if (f.sub) g.appendChild(s("text", { x: SX + SW - 10, y: sy + 15, class: "mem-blk", "text-anchor": "end" }, f.sub));
        f.vars.forEach((v, i) => {
          const ry = sy + FRAME_HEAD + i * ROW;
          if (v.hot) g.appendChild(s("rect", { x: SX + 4, y: ry, width: SW - 8, height: ROW - 2, rx: 4, class: "mem-hot" }));
          g.appendChild(s("text", { x: SX + 12, y: ry + 13 },
            s("tspan", { class: "mem-var", style: { fontWeight: 700 } }, v.n),
            v.t ? s("tspan", { class: "mem-ty" }, ": " + v.t) : null));
          const vx = v.ptr ? SX + SW - 20 : SX + SW - 10;
          if (v.v != null && v.v !== "") g.appendChild(s("text", { x: vx, y: ry + 13, class: "mem-val" + (v.hot ? " hot" : ""), "text-anchor": "end" }, String(v.v)));
          if (v.ptr) {
            g.appendChild(s("circle", { cx: SX + SW - 10, cy: ry + 9, r: 3.4, class: "mem-dot" }));
            ptrs.push({ x: SX + SW - 10, y: ry + 9, to: v.ptr, weak: v.weak });
          }
        });
        sy += hgt + 6;
      });
      const target = (to) => {
        const [id, cell] = String(to).split(":");
        const b = blocks[id]; if (!b) return null;
        if (cell != null && b.cells[Number(cell)]) { const c = b.cells[Number(cell)]; return { x: c.cx, y: c.y, top: true }; }
        return { x: b.x - 2, y: b.y + 11, top: false };
      };
      ptrs.forEach((p) => { const t = target(p.to); if (t) arrow(arrows, p.x + 3, p.y, t.x, t.y, p.weak, t.top); });
      // heap → heap pointers (a list node's next, a Box child)
      Object.values(blocks).forEach((blk) => (blk.b.ptrs || []).forEach((p) => {
        const c = blk.cells[p.from], t = target(p.to); if (!c || !t) return;
        if (t.top || t.x < c.cx + 10) {
          const tb = blocks[String(p.to).split(":")[0]];
          const tx = t.top ? t.x : tb.x + Math.min(12, tb.w / 2);
          const ty = t.top ? t.y : tb.y;
          arrow(arrows, c.cx, c.y + 22, tx, ty - (ty < c.y ? -22 : 0), p.weak, true);
        } else arrow(arrows, c.cx + 3, c.cy, t.x, t.y, p.weak, false);
      }));
      const bottom = Math.max(sy, hy, ...Object.values(blocks).map((b) => b.y + 22 + 10), 70);
      svg.setAttribute("viewBox", `0 0 660 ${Math.ceil(bottom + 4)}`);
    }
    return { set, svg };
  }

  /* ---------- array cells inside a machine ----------
     const pos = cells(g, { x, y, vals, cw: 46, ch: 40, gap: 6, marks: { 2: "on" }, base: "auto" });
     base: 1 or 0 prints indices under the cells; "auto" follows the code panel (book: 1, Rust: 0). */
  function cells(g, o) {
    K.clear(g);
    const cw = o.cw || 46, ch = o.ch || 40, gap = o.gap == null ? 6 : o.gap;
    const base = o.base === "auto" ? (CODE_LANG.rust ? 0 : 1) : o.base;
    return o.vals.map((v, i) => {
      const x = o.x + i * (cw + gap), y = o.y;
      const cls = "ac-cell" + (o.marks && o.marks[i] ? " " + o.marks[i] : "");
      g.appendChild(s("rect", { x, y, width: cw, height: ch, rx: 8, class: cls }));
      if (v != null && v !== "") g.appendChild(s("text", { x: x + cw / 2, y: y + ch / 2 + 5.5, class: "ac-v", "text-anchor": "middle", style: o.size ? { fontSize: o.size + "px" } : {} }, String(v)));
      if (base != null) g.appendChild(s("text", { x: x + cw / 2, y: y + ch + 14, class: "ac-i", "text-anchor": "middle" }, String(i + base)));
      return { x, y, w: cw, h: ch, cx: x + cw / 2, cy: y + ch / 2 };
    });
  }

  window.AL = { cap, esc, fmt, box, txt, clickable, button, session, src, code, mem, cells, CODE_LANG, langToggle, highlight };
})();
