/* Algorithm Alley — helpers every chapter of this book shares. Load after assets/kit.js:
     <script src="book.js"></script><script src="../../assets/kit.js"></script><script src="algo.js"></script>
   then  const { cap, esc, box, txt, clickable, button, session, code, mem, cells, src, fmt, CODE_LANG } = AL;

   code()  the panel under a machine: the book's pseudocode, or a runnable Rust twin (one toggle for the page);
           a lens pins its running line to the window's foot, and Full screen puts machine, code and memory on one screen
   mem()   a small stack-and-heap strip that shows where the Rust program keeps its data
   cells() a row of array cells inside a machine's SVG, indexed from 1 (the book) or 0 (Rust)
   box / txt / clickable / button / session — the SVG and run helpers the other books copy into each page.
   walk, plot, bars, legend, matrix, point, note, send, mix, rmap and .term — the step-through toolkit, documented where it is defined. */
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

  /* ---------- full screen: one machine, its code and its memory on one screen ----------
     The Full screen button in a machine's head row lifts that stage over the page (and into the browser's own
     full screen where it is allowed): the picture fills the left, the code and the memory strip share the
     right, and nothing scrolls the page. The picture fits its box at 100%; − and + (or ctrl/⌘ + wheel, a
     trackpad pinch, or the - + 0 keys) zoom it, and a zoomed picture pans by dragging. The memory strip scales
     down, whole, until it fits under the code. Esc or the button leaves. */
  const FULL = (() => {
    const STEPS = [1, 1.25, 1.5, 2, 2.5, 3, 4], narrow = window.matchMedia("(max-width: 899px), (max-height: 560px)");
    let cur = null;
    const ICON_IN = "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5", ICON_OUT = "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5";
    function size() {
      if (!cur) return;
      const { scroller: sc, svg } = cur, vb = svg.viewBox.baseVal;
      if (vb && vb.width && vb.height) {
        const k = Math.max(0.1, Math.min((sc.clientWidth - 16) / vb.width, (sc.clientHeight - 16) / vb.height)) * cur.z;
        svg.style.width = vb.width * k + "px"; svg.style.height = vb.height * k + "px";
      }
      sc.classList.toggle("zoomed", cur.z > 1);
      cur.pct.textContent = Math.round(cur.z * 100) + "%";
      const msvg = cur.mem && cur.mem.querySelector("svg");
      if (msvg) {
        msvg.style.maxHeight = "";
        const used = [...cur.cp.children].reduce((a, c) => a + (c === cur.mem || c.classList.contains("cp-body") ? 0 : c.offsetHeight), 0);
        const room = cur.cp.clientHeight - used - (narrow.matches ? 110 : 200) - (cur.mem.offsetHeight - msvg.getBoundingClientRect().height);
        msvg.style.maxHeight = Math.max(narrow.matches ? 80 : 110, room) + "px";
      }
    }
    /** zoom to z, keeping the point (x, y) of the scroller's box still */
    function zoom(z, x, y) {
      if (!cur) return;
      const sc = cur.scroller;
      z = Math.min(STEPS[STEPS.length - 1], Math.max(1, z));
      if (x == null) { x = sc.clientWidth / 2; y = sc.clientHeight / 2; }
      const fx = (sc.scrollLeft + x) / sc.scrollWidth, fy = (sc.scrollTop + y) / sc.scrollHeight;
      cur.z = z; size();
      sc.scrollLeft = fx * sc.scrollWidth - x; sc.scrollTop = fy * sc.scrollHeight - y;
    }
    const step = (dir) => cur && zoom(dir > 0 ? STEPS.find((v) => v > cur.z + 0.01) || cur.z : [...STEPS].reverse().find((v) => v < cur.z - 0.01) || 1);
    function zoomBar() {
      const bar = h("span", { class: "fs-zoom", role: "group", "aria-label": "Zoom the picture" });
      const b = (label, aria, fn) => { const x = h("button", { type: "button", "aria-label": aria, title: aria }, label); x.addEventListener("click", fn); bar.appendChild(x); return x; };
      b("−", "Zoom out", () => step(-1));
      const pct = b("100%", "Fit the picture to the screen", () => zoom(1));
      b("+", "Zoom in", () => step(1));
      return { bar, pct };
    }
    function paint(st) {
      const on = cur && cur.stage === st.stage;
      st.btn.setAttribute("aria-pressed", String(on));
      st.btn.querySelector("path").setAttribute("d", on ? ICON_OUT : ICON_IN);
      st.btn.lastChild.textContent = on ? "Exit" : "Full screen";
      st.btn.title = on ? "Leave full screen (Esc)" : "Show this machine, its code and its memory on one screen";
    }
    function enter(st) {
      if (cur) exit();
      cur = Object.assign(st, { z: 1, native: false });
      st.stage.classList.add("is-full");
      document.documentElement.classList.add("has-full");
      if (st.mem) st.cp.appendChild(st.mem);
      st.ro = new ResizeObserver(size); st.ro.observe(st.scroller); st.ro.observe(st.cp);
      st.mo = new MutationObserver(size); st.mo.observe(st.svg, { attributes: true, attributeFilter: ["viewBox"] });
      paint(st); size(); st.btn.focus();
      try {
        const p = st.stage.requestFullscreen && st.stage.requestFullscreen({ navigationUI: "hide" });
        if (p && p.then) p.then(() => { if (cur === st) st.native = true; }, () => {});
      } catch (e) {}
      LENS.update();
    }
    function exit() {
      const st = cur; if (!st) return;
      cur = null;
      st.ro.disconnect(); st.mo.disconnect();
      st.stage.classList.remove("is-full");
      document.documentElement.classList.remove("has-full");
      st.scroller.classList.remove("zoomed", "panning");
      st.svg.style.width = st.svg.style.height = "";
      if (st.mem) { st.stage.insertBefore(st.mem, st.cp); const m = st.mem.querySelector("svg"); if (m) m.style.maxHeight = ""; }
      if (document.fullscreenElement === st.stage) document.exitFullscreen().catch(() => {});
      paint(st);
      st.stage.scrollIntoView({ block: "nearest" });
      LENS.update();
    }
    document.addEventListener("fullscreenchange", () => { if (cur && cur.native && document.fullscreenElement !== cur.stage) exit(); });
    document.addEventListener("keydown", (e) => {
      if (!cur || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === "Escape") { e.preventDefault(); exit(); }
      else if ((e.key === "+" || e.key === "=") && !e.ctrlKey && !e.metaKey) step(1);
      else if (e.key === "-" && !e.ctrlKey && !e.metaKey) step(-1);
      else if (e.key === "0" && !e.ctrlKey && !e.metaKey) zoom(1);
    });
    /** ctrl/⌘ + wheel (and a trackpad pinch, which arrives as one) zooms; a zoomed picture drags to pan */
    function wire(st) {
      const sc = st.scroller;
      sc.addEventListener("wheel", (e) => {
        if (cur !== st || !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        const r = sc.getBoundingClientRect();
        zoom(st.z * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
      let drag = null, moved = false;
      sc.addEventListener("pointerdown", (e) => {
        if (cur !== st || st.z <= 1 || e.pointerType !== "mouse" || e.button !== 0) return;
        drag = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop }; moved = false;
      });
      window.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true; sc.classList.add("panning");
        sc.scrollLeft = drag.l - dx; sc.scrollTop = drag.t - dy;
      });
      window.addEventListener("pointerup", () => { drag = null; sc.classList.remove("panning"); });
      // a drag that panned is not a click on whatever it started over
      sc.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    }
    const stages = [];
    return {
      get on() { return !!cur; },
      enter(stage) { const st = stages.find((x) => x.stage === stage); if (st) enter(st); },
      add(stage, cp) {
        const scroller = stage.querySelector(":scope > .stage-scroll"), svg = scroller && scroller.querySelector(":scope > svg");
        const head = stage.querySelector(":scope > .stage-head");
        if (!svg || !head || stages.some((x) => x.stage === stage)) return;
        const btn = h("button", { type: "button", class: "fs-btn" },
          s("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, s("path", { d: ICON_IN })), h("span", {}, ""));
        const { bar, pct } = zoomBar();
        const st = { stage, cp, scroller, svg, btn, pct, mem: stage.querySelector(':scope > [id$="-mem"]') };
        btn.addEventListener("click", () => (cur === st ? exit() : enter(st)));
        head.append(bar, btn);
        stages.push(st); wire(st); paint(st);
      },
    };
  })();

  /* ---------- the code lens ----------
     While a machine is on screen but the line it is running is not (its panel is below the fold, or scrolled
     away), a strip pinned to the bottom of the window shows that line with one line either side, live values
     included. Tapping it brings the full listing into view. Panels register themselves in code(). */
  const LENS = (() => {
    const panels = [], LIT = ["on", "on2", "good", "bad", "dim"];
    let el = null, ol, go, cur = null, sig = "", off = false, raf = 0, zone = 110;
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function build() {
      ol = h("ol", {});
      go = h("button", { type: "button", class: "cp-lens-go", title: "Scroll to the full listing" }, "");
      go.addEventListener("click", () => { if (cur) cur.root.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" }); });
      const full = h("button", { type: "button", class: "cp-lens-full", title: "Show this machine, its code and its memory on one screen" }, "Full screen");
      full.addEventListener("click", () => { if (cur) FULL.enter(cur.stage); });
      const x = h("button", { type: "button", class: "cp-lens-x", "aria-label": "Hide the code lens" }, "×");
      x.addEventListener("click", () => { off = true; hide(); K.toast("Code lens hidden until you reload"); });
      const body = h("div", { class: "cp-body" }, ol);
      body.addEventListener("click", () => go.click());
      el = h("div", { class: "cp-lens", role: "region", "aria-label": "The line the machine is running" },
        h("div", { class: "cp-lens-head" }, go, h("span", { class: "grow" }), full, x), body);
      document.body.appendChild(el);
    }
    function hide() { if (el) el.classList.remove("show"); cur = null; sig = ""; }
    function litLine(p) {
      const lis = p.lis();
      const i = lis.findIndex((li) => li.classList.contains("on"));
      return i >= 0 ? i : lis.findIndex((li) => LIT.some((c) => li.classList.contains(c)));
    }
    function run() {
      raf = 0;
      if (off || FULL.on) { hide(); return; }
      const vh = window.innerHeight, bar = document.querySelector(".topbar");
      const top = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
      // the machine most on screen is the one the reader is watching
      let p = null, most = 0;
      panels.forEach((q) => {
        const r = q.scroller.getBoundingClientRect();
        const v = Math.min(r.bottom, vh) - Math.max(r.top, top);
        if (v >= Math.min(120, r.height / 2) && v > most) { p = q; most = v; }
      });
      const i = p ? litLine(p) : -1;
      if (i < 0) { hide(); return; }
      const lis = p.lis();
      const lr = lis[i].getBoundingClientRect(), br = p.body.getBoundingClientRect();
      if (lr.top >= Math.max(br.top, top) - 1 && lr.bottom <= Math.min(br.bottom, vh - zone) + 1) { hide(); return; }
      if (!el) build();
      const key = p.ver + ":" + i;
      if (p !== cur || key !== sig) {
        K.clear(ol);
        const from = Math.max(0, Math.min(i - 1, lis.length - 3));
        lis.slice(from, from + 3).forEach((li) => ol.appendChild(li.cloneNode(true)));
        const n = lis[i].dataset.n;
        go.textContent = p.label() + (n ? " · line " + n : "") + " ↓";
        cur = p; sig = key;
      }
      const sr = p.stage.getBoundingClientRect();
      el.style.left = Math.max(0, sr.left) + "px";
      el.style.width = Math.min(sr.width, document.documentElement.clientWidth) + "px";
      el.classList.add("show");
      zone = el.offsetHeight + 16;
    }
    const update = () => { if (!raf) raf = requestAnimationFrame(run); };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return {
      update,
      add(p) { panels.push(p); p.body.addEventListener("scroll", update, { passive: true }); },
      touch(p) { p.ver++; update(); },
    };
  })();

  /* ---------- syntax colours ---------- */
  const TOKENS = {
    // the book's pseudocode: bold keywords, PROCEDURE-NAMES, // comments
    clrs: [
      [/\/\/.*/, "cm"],
      [/"(?:[^"\\]|\\.)*"/, "st"],
      [/\b(?:NIL|TRUE|FALSE)\b/, "kw"],
      [/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+′*|\b[A-Z]{2,}[A-Z0-9]*′*(?=\()/, "pc"],
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
  const HEADER = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*′*\s*\(.*\)\s*$/; // primes too: PARTITION′(A, p, r)
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
    const stage = root.closest(".stage");
    let lens = null;
    if (stage) {
      stage.classList.add("has-code");
      lens = { root, body, stage, scroller: stage.querySelector(".stage-scroll") || stage, ver: 0, lis: () => lis, label: () => (rs() ? cur.rs.name : cur.name) };
      LENS.add(lens);
      FULL.add(stage, root);
    }
    const touched = () => { if (lens) LENS.touch(lens); };
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
        // 3 and "FIRST-PROC:3" mean the same line, whichever way the map spells it
        const first = idx.pseudo.first, short = first && key.startsWith(first + ":") ? key.slice(first.length + 1) : null;
        const v = m[key] != null ? m[key] : (/^\d+$/.test(key) && first && m[`${first}:${key}`]) || (short != null && m[short]);
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
      touched();
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
      touched();
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
      paintNotes(); paintOut(); drawTools(); touched();
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

  /* ---------- binary trees inside a machine ----------
     nodes: { id: { key, l, r } } with l / r an id or null.
     const L = tree.layout(nodes, root, { x: 30, w: 600, y: 36, dy: 58 });   x by in-order rank (a BST reads
       left to right in key order), y by depth → { pos: Map(id → {x, y}), order: [ids], depth: Map, height }
     tree.draw(g, nodes, L.pos, { r: 17, cls: (id) => "on", edge: (child) => "on", label: (id) => …, sub: (id) => … })
       cls: "on" | "on2" | "good" | "bad" | "dim" | "red" | "black" | "ghost" (red-black colours keep their text white)
       → Map(id → node <g>) so a machine can pulse or fly one.
     tree.lerp(posA, posB, t) → a Map between two layouts (a rotation, an insertion) to draw every frame. */
  const tree = {
    layout(nodes, root, o = {}) {
      const x = o.x == null ? 30 : o.x, w = o.w || 600, y = o.y == null ? 36 : o.y, dy = o.dy || 58;
      const order = [], depth = new Map();
      const walk = (id, d) => { const n = id == null ? null : nodes[id]; if (!n) return; walk(n.l, d + 1); order.push(id); depth.set(id, d); walk(n.r, d + 1); };
      walk(root, 0);
      const step = w / Math.max(1, order.length), pos = new Map();
      order.forEach((id, i) => pos.set(id, { x: x + step * (i + 0.5), y: y + depth.get(id) * dy }));
      return { pos, order, depth, height: order.length ? Math.max(...depth.values()) : -1, step };
    },
    draw(g, nodes, pos, o = {}) {
      K.clear(g);
      const r = o.r || 17, out = new Map();
      const edges = s("g"), dots = s("g");
      g.appendChild(edges); g.appendChild(dots);
      for (const [id, p] of pos) {
        const n = nodes[id]; if (!n) continue;
        for (const c of [n.l, n.r]) {
          if (c == null || !pos.has(c)) continue;
          const q = pos.get(c), ec = o.edge && o.edge(c);
          edges.appendChild(s("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: "tr-edge" + (ec ? " " + ec : "") }));
        }
      }
      for (const [id, p] of pos) {
        const n = nodes[id]; if (!n) continue;
        const c = o.cls && o.cls(id);
        const ng = s("g", { class: "tr-node" + (c ? " " + c : ""), transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})` });
        ng.appendChild(s("circle", { r }));
        ng.appendChild(s("text", { y: 5, "text-anchor": "middle", class: "tr-k" }, String(o.label ? o.label(id) : n.key)));
        const sub = o.sub && o.sub(id);
        if (sub != null && sub !== "") ng.appendChild(s("text", { y: r + 13, "text-anchor": "middle", class: "tr-sub" }, String(sub)));
        dots.appendChild(ng); out.set(id, ng);
      }
      return out;
    },
    lerp(a, b, t) {
      const m = new Map();
      for (const [id, q] of b) { const p = a.get(id) || q; m.set(id, { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
      return m;
    },
  };

  /* ---------- 2-D tables inside a machine (dynamic-programming tables, matrices) ----------
     const pos = grid(g, { x, y, rows, cols, cw: 40, ch: 34, gap: 4, val: (r, c) => 12 | "∞" | null,
       mark: (r, c) => "on" | "on2" | "good" | "bad" | "dim" | "sorted" | "", rowLabels: ["", "a", "b"] | (r) => …,
       colLabels: [...] | (c) => …, size: 13 });          → pos(r, c) = { x, y, w, h, cx, cy }  (0-based r, c)
     Labels print above the columns / left of the rows; leave room: x ≥ 40 when rowLabels is set, y ≥ 22 for colLabels. */
  function grid(g, o) {
    K.clear(g);
    const cw = o.cw || 40, ch = o.ch || 34, gap = o.gap == null ? 4 : o.gap;
    const pos = (r, c) => { const x = o.x + c * (cw + gap), y = o.y + r * (ch + gap); return { x, y, w: cw, h: ch, cx: x + cw / 2, cy: y + ch / 2 }; };
    const lab = (src, i) => (typeof src === "function" ? src(i) : src && src[i]);
    for (let c = 0; c < o.cols; c++) { const l = lab(o.colLabels, c); if (l != null && l !== "") g.appendChild(s("text", { x: pos(0, c).cx, y: o.y - 7, class: "ac-i", "text-anchor": "middle" }, String(l))); }
    for (let r = 0; r < o.rows; r++) {
      const l = lab(o.rowLabels, r);
      if (l != null && l !== "") g.appendChild(s("text", { x: o.x - 8, y: pos(r, 0).cy + 4, class: "ac-i", "text-anchor": "end" }, String(l)));
      for (let c = 0; c < o.cols; c++) {
        const p = pos(r, c), v = o.val ? o.val(r, c) : null, m = o.mark && o.mark(r, c);
        g.appendChild(s("rect", { x: p.x, y: p.y, width: cw, height: ch, rx: 7, class: "ac-cell" + (m ? " " + m : "") }));
        if (v != null && v !== "") g.appendChild(s("text", { x: p.cx, y: p.cy + 4.5, class: "ac-v", "text-anchor": "middle", style: { fontSize: (o.size || 13) + "px" } }, String(v)));
      }
    }
    return pos;
  }

  /* ---------- graphs inside a machine (chapters 20–25) ----------
     const G = { directed: true, nodes: { s: { x: 60, y: 120 }, a: { x: 200, y: 60, label: "a" } },
                 edges: [{ u: "s", v: "a", w: 3, id: "sa", bend: 0 }] };        (ids are your own strings; w and id optional)
     const R = graph.draw(g, G, { r: 17, node: (id) => "on", edge: (e, key) => "good", sub: (id) => "d=3",
                                  wlabel: (e) => e.w, label: (id) => …, showW: true });
       node cls: "on" | "on2" | "good" | "bad" | "dim" | "ghost" | "red" | "black" | "src" (any mix, space separated)
       edge cls: "on" | "on2" | "good" | "bad" | "dim" | "cut"   (class sits on the edge's <g class="gr-edge …">)
     → { nodes: Map(id → <g>), edges: Map(key → <g>), pos: (id) → {x, y} }.  key = e.id, else "u>v" (directed) or "u-v".
     Antiparallel edges (u→v and v→u) are drawn as two curves automatically; e.bend (px) curves any other edge.
     graph.ring(n, cx, cy, rx, ry, start) → [{x, y}, …] points around an ellipse (start angle in radians, default top). */
  const graph = {
    draw(g, G, o = {}) {
      K.clear(g);
      const R = o.r || 17, dir = !!G.directed, nodes = G.nodes;
      const out = { nodes: new Map(), edges: new Map(), pos: (id) => nodes[id] };
      const has = new Set(G.edges.map((e) => e.u + ">" + e.v));
      const eg = s("g"), ng = s("g"); g.appendChild(eg); g.appendChild(ng);
      const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
      G.edges.forEach((e) => {
        const a = nodes[e.u], b = nodes[e.v]; if (!a || !b) return;
        const key = e.id != null ? e.id : e.u + (dir ? ">" : "-") + e.v;
        const cls = o.edge && o.edge(e, key);
        const [ux, uy] = unit(b.x - a.x, b.y - a.y), nx = -uy, ny = ux;
        const bend = dir && has.has(e.v + ">" + e.u) ? 16 : (e.bend || 0);
        const cx = (a.x + b.x) / 2 + nx * bend * 2, cy = (a.y + b.y) / 2 + ny * bend * 2;
        const [sx, sy] = unit(cx - a.x, cy - a.y), [tx, ty] = unit(cx - b.x, cy - b.y);
        const x1 = a.x + sx * R, y1 = a.y + sy * R, x2 = b.x + tx * (R + (dir ? 2 : 0)), y2 = b.y + ty * (R + (dir ? 2 : 0));
        const eg1 = s("g", { class: "gr-edge" + (cls ? " " + cls : "") });
        eg1.appendChild(s("path", { d: bend ? `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}` : `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`, class: "gr-line" }));
        if (dir) {
          const [hx, hy] = unit(x2 - (bend ? cx : x1), y2 - (bend ? cy : y1)), px = -hy, py = hx, L = 10, W = 5;
          eg1.appendChild(s("path", { d: `M${x2.toFixed(1)},${y2.toFixed(1)} L${(x2 - hx * L + px * W).toFixed(1)},${(y2 - hy * L + py * W).toFixed(1)} L${(x2 - hx * L - px * W).toFixed(1)},${(y2 - hy * L - py * W).toFixed(1)} Z`, class: "gr-head" }));
        }
        const wl = o.wlabel ? o.wlabel(e) : e.w;
        if (wl != null && wl !== "") {
          const lx = bend ? 0.25 * x1 + 0.5 * cx + 0.25 * x2 : (x1 + x2) / 2, ly = bend ? 0.25 * y1 + 0.5 * cy + 0.25 * y2 : (y1 + y2) / 2, off = bend ? (bend > 0 ? 1 : -1) * 8 : 0;
          eg1.appendChild(s("text", { x: lx + nx * off, y: ly + ny * off + 4, class: "gr-w", "text-anchor": "middle" }, String(wl)));
        }
        eg.appendChild(eg1); out.edges.set(key, eg1);
      });
      Object.keys(nodes).forEach((id) => {
        const n = nodes[id], c = o.node && o.node(id);
        const gn = s("g", { class: "gr-node" + (c ? " " + c : ""), transform: `translate(${n.x},${n.y})` });
        gn.appendChild(s("circle", { r: R }));
        gn.appendChild(s("text", { y: 5, "text-anchor": "middle", class: "gr-k" }, String(o.label ? o.label(id) : n.label != null ? n.label : id)));
        const sub = o.sub && o.sub(id);
        if (sub != null && sub !== "") gn.appendChild(s("text", { y: R + 13, "text-anchor": "middle", class: "gr-sub" }, String(sub)));
        ng.appendChild(gn); out.nodes.set(id, gn);
      });
      return out;
    },
    ring(n, cx, cy, rx, ry, start = -Math.PI / 2) {
      return Array.from({ length: n }, (_, i) => ({ x: cx + rx * Math.cos(start + (2 * Math.PI * i) / n), y: cy + (ry == null ? rx : ry) * Math.sin(start + (2 * Math.PI * i) / n) }));
    },
  };

  /* ==================================================================================================
     Step-through toolkit: for harder ideas, machines that explain more and move less.
     walk()   step forwards AND backwards through a precomputed run, with a plain-words narration per step
     plot()   axes and marks for anything drawn on a number line or a plane
     bars()   horizontal bars for "this much against that much"
     legend() the colour key, always in the same style
     matrix() a table with square brackets
     point()  a curved arrow from one thing to another, with an optional label
     note()   an SVG label with a halo, safe to place over lines
     send()   a value that travels from one place to another, then disappears
     mix()    in-between of two frames, for smooth movement
     Terms:   <span class="term">pivot</span> in the copy shows that word's "Words to know" entry on hover or tap.
     ================================================================================================== */

  /** In-between of two frames: numbers interpolate, everything else takes b's value. Round in paint() what must
      read as a whole number: mix(a, b, .5) of 3 and 4 is 3.5. */
  function mix(a, b, t) {
    if (typeof a === "number" && typeof b === "number") return a + (b - a) * t;
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.map((v, i) => mix(v, b[i], t));
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
      const o = {}; for (const k in b) o[k] = k in a ? mix(a[k], b[k], t) : b[k]; return o;
    }
    return b;
  }

  /* ---------- walk: step through a run, forwards and backwards ----------
     const W = walk({
       id: "s1",                       // fills #s1-controls and narrates in #s1-cap
       frames() { return [ { say, why, phase, tone, lines, notes, notesRust, out, ...yourState }, … ]; },
       paint(f, i, all) { … },         // draw the WHOLE picture from one frame; never look at what was drawn before
       morph: 520,                     // optional: glide from step to step, painting mix(prev, f, t) each frame
       enter: async (w, f, prev, fx) => { … },  // optional instead: your own movement from prev to f (forward steps only)
       svg: "#s1-svg",                 // needed with enter: the moving things go on an overlay group inside it
       code: cv,                       // optional: lines, notes and out drive the code panel
       before: [button, …],            // optional: your own buttons, placed left of Back
     });
     W.rebuild()   the viewer changed an input: run frames() again and go to step 1
     W.go(i)       jump to a step · W.i, W.frame, W.frames · W.stop() stop playing

     A frame:  say    what just happened, in plain words (html). Always set.
               why    why that is allowed, or why it matters (html). Optional; one sentence.
               phase  the current stage of the algorithm, shown before the step count. Optional.
               tone   "good" | "bad": a finished result or a failure. Optional.
               lines  book line numbers to highlight ("MERGE:4", 3, …). notes / notesRust: live values at line ends.
               mark   { good: [lines], bad: [lines], on2: [lines] }: extra highlight classes. out: the run's output.
               hold   extra milliseconds Play stays on this step.
     All of the frames are computed up front from the inputs, so Back, the slider and Next all land on the same
     picture. paint() redraws from the frame; enter() only adds movement on top, on the fx layer, and the final
     picture always comes from paint(). So a cancelled animation can never leave the machine in a broken state.

     Inside enter, animate only through w: a plain K.tween keeps calling its function after Back or Next, and would
     paint over the new step. await w.morph(ms) · await w.tween(ms, (t) => …, ease) · await w.send("7", [x, y], [x2, y2])
     · await w(K.sleep(200)) · await w(K.fly(tagOnFx, a, b, ms)) (only for things on fx, which is cleared afterwards). */
  function walk(o) {
    const ctr = K.$(`#${o.id}-controls`), capEl = K.$(`#${o.id}-cap`);
    const svg = o.svg ? K.$(o.svg) : null;
    let fx = null;
    const fxLayer = () => { if (svg && (!fx || !fx.isConnected)) { fx = s("g", { class: "wk-fx", "aria-hidden": "true" }); } if (svg && fx) svg.appendChild(fx); return fx; };
    const S = session();
    let frames = [], i = 0, playing = false, playGen = 0, animGen = 0;
    const enter = o.enter || (o.morph ? (w) => w.morph(o.morph) : null);
    if (capEl) capEl.classList.add("wk-cap");
    (o.before || []).forEach((b) => ctr.appendChild(b));
    const bStart = button(ctr, "Start over", "", () => { stop(); go(0); });
    const bBack = button(ctr, "Back", "", () => { stop(); go(i - 1); });
    const bNext = button(ctr, "Next", "", () => { stop(); go(i + 1, true); });
    const bPlay = button(ctr, "Play", "primary", () => (playing ? stop() : play()));
    const label = `${o.id}-scrub`;
    const range = h("input", { type: "range", id: label, min: 0, max: 0, step: 1, value: 0, "aria-label": "Jump to a step" });
    range.addEventListener("input", () => { const v = Number(range.value); stop(); go(v); }); // read first: stop() redraws the slider
    const count = h("span", { class: "wk-count" }, "");
    ctr.appendChild(h("span", { class: "wk-scrub" }, range, count));

    function chrome() {
      bStart.disabled = bBack.disabled = i === 0;
      bNext.disabled = i >= frames.length - 1;
      bPlay.textContent = playing ? "Pause" : i >= frames.length - 1 && frames.length > 1 ? "Play again" : "Play";
      range.max = String(Math.max(0, frames.length - 1)); range.value = String(i);
      count.textContent = `${i + 1} / ${frames.length}`;
    }
    function narrate(f) {
      if (!capEl) return;
      const head = (f.phase ? `<span class="wk-ph">${f.phase}</span>` : "") + `<span class="wk-n">Step ${i + 1} of ${frames.length}</span>`;
      capEl.className = "caption wk-cap" + (f.tone ? " " + f.tone : "");
      capEl.innerHTML = `<div class="wk-head">${head}</div><div class="wk-say">${f.say || ""}</div>` + (f.why ? `<div class="wk-why">${f.why}</div>` : "");
    }
    function codeFor(f) {
      if (!o.code) return;
      o.code.clear();
      if (f.lines != null) o.code.at(f.lines, "on");
      if (f.mark) Object.entries(f.mark).forEach(([c, l]) => o.code.at(l, c, false));
      if (f.notes || f.notesRust) o.code.notes(f.notes || {}, f.notesRust);
      o.code.out(f.out === undefined ? null : f.out);
    }
    function settle(f) { if (fx) K.clear(fx); o.paint(f, i, frames); }
    function go(n, animate) {
      if (!frames.length) return;
      const wasBusy = S.busy;
      S.cancel();
      const my = ++animGen; // any tween still running from the last step stops touching the picture now
      const prevI = i;
      n = Math.max(0, Math.min(frames.length - 1, n));
      if (wasBusy) settle(frames[prevI]);
      i = n;
      const f = frames[i];
      narrate(f); codeFor(f); chrome();
      if (animate && enter && !K.reduced && i === prevI + 1) {
        if (fx) K.clear(fx);
        const prev = frames[prevI], layer = fxLayer();
        return S.run(async (w) => {
          const tw = (ms, fn, e) => w(K.tween(ms, (t) => { if (my === animGen) fn(t); }, e));
          const W2 = Object.assign((p) => w(p), { tween: tw,
            morph: (ms = 520) => tw(ms, (t) => o.paint(mix(prev, f, t), i, frames)),
            send: (text, a, b, ms, cls) => send(w, layer || svg, text, a, b, ms, cls) });
          await enter(W2, f, prev, layer);
          settle(f);
        });
      }
      settle(f);
      return Promise.resolve(true);
    }
    /** reading time: longer narration stays up longer, and the page's speed control scales it (K.sleep) */
    const readMs = (f) => {
      const n = ((f.say || "") + (f.why || "")).replace(/<[^>]+>/g, "").length;
      return Math.min(5200, 800 + n * 34) + (f.hold || 0);
    };
    async function play() {
      const my = ++playGen;
      playing = true;
      if (i >= frames.length - 1) await go(0);
      chrome();
      await K.sleep(i === 0 ? readMs(frames[0]) : 300);
      while (playing && my === playGen && i < frames.length - 1) {
        const ok = await go(i + 1, true);
        if (my !== playGen || !playing || ok === false) break;
        if (i < frames.length - 1) await K.sleep(readMs(frames[i]));
      }
      if (my === playGen) { playing = false; chrome(); }
    }
    function stop() { playGen++; playing = false; chrome(); }
    function rebuild() {
      stop(); S.cancel();
      frames = o.frames();
      if (!frames.length) throw new Error(`walk ${o.id}: frames() returned nothing`);
      i = 0;
      const f = frames[0];
      narrate(f); codeFor(f); chrome(); settle(f);
    }
    const stageEl = ctr.closest(".stage");
    if (stageEl) stageEl.addEventListener("keydown", (e) => {
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); stop(); go(i + 1, true); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stop(); go(i - 1); }
    });
    rebuild();
    return { rebuild, go, stop, get i() { return i; }, get frame() { return frames[i]; }, get frames() { return frames; }, controls: ctr };
  }

  /** The rs.map of a code panel, found by searching the Rust text, so it can't drift when the program changes:
      rmap(src("rs-s1"), { 1: "let mut worst", "MERGE:4": ["for m in", "worst = worst"] }) → { 1: 28, "MERGE:4": [29, 30] }.
      Each snippet must appear in the listing; the first matching line wins. A missing one is a console error. */
  function rmap(rust, spec) {
    const lines = rust.split("\n"), out = {};
    const find = (snip) => { const i = lines.findIndex((l) => l.includes(snip)); if (i < 0) console.error(`rmap: no Rust line contains "${snip}"`); return i + 1; };
    Object.entries(spec).forEach(([k, v]) => { const hits = [].concat(v).map(find).filter(Boolean); if (hits.length) out[k] = hits.length === 1 ? hits[0] : hits; });
    return out;
  }

  /** A value travels from a to b and vanishes: await send(w, fx, "7", [x, y], [x2, y2]). */
  async function send(w, layer, text, a, b, ms = 520, cls = "sv-data-soft") {
    const t = K.draw.tag(text, cls);
    layer.appendChild(t);
    t.setAttribute("transform", `translate(${a[0]},${a[1]})`);
    await w(K.fly(t, a, b, ms));
    t.remove();
  }

  /** An SVG label with a halo, so it stays readable over lines and cells. tone: on | on2 | good | bad | mute. */
  function note(g, x, y, str, o = {}) {
    const t = s("text", { x, y, class: "pt-note" + (o.tone ? " " + o.tone : "") + (o.mono === false ? "" : " mono"), "text-anchor": o.anchor || "middle", style: Object.assign({}, o.size ? { fontSize: o.size + "px" } : {}, o.bold === false ? { fontWeight: 400 } : {}) }, str);
    g.appendChild(t); return t;
  }

  /** A curved arrow "this comes from there": point(g, [x1, y1], [x2, y2], { bend: 20, tone: "on", label: "+3" }). */
  function point(g, a, b, o = {}) {
    const bend = o.bend == null ? 0 : o.bend, tone = o.tone ? " " + o.tone : "";
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const cx = (a[0] + b[0]) / 2 + nx * bend, cy = (a[1] + b[1]) / 2 + ny * bend;
    const gg = s("g", { class: "pt-arrow" + tone });
    gg.appendChild(s("path", { d: `M${a[0]},${a[1]} Q${cx},${cy} ${b[0]},${b[1]}`, class: "pt-line" }));
    const ang = Math.atan2(b[1] - cy, b[0] - cx), L = 9;
    gg.appendChild(s("path", { d: `M${b[0]},${b[1]} L${b[0] - L * Math.cos(ang - 0.42)},${b[1] - L * Math.sin(ang - 0.42)} L${b[0] - L * Math.cos(ang + 0.42)},${b[1] - L * Math.sin(ang + 0.42)} Z`, class: "pt-head" }));
    if (o.label != null) note(gg, 0.25 * a[0] + 0.5 * cx + 0.25 * b[0] + nx * 10, 0.25 * a[1] + 0.5 * cy + 0.25 * b[1] + ny * 10 + 4, o.label, { tone: o.tone });
    g.appendChild(gg); return gg;
  }

  /** The colour key: legend(g, x, y, [["on", "being read"], ["good", "finished"]], { dir: "row" | "col", gap }).
      A tone is on | on2 | good | bad | dim | sorted. In a row, width is estimated at 6.4 px a character. */
  function legend(g, x, y, items, o = {}) {
    let cx = x, cy = y;
    items.forEach(([tone, text]) => {
      g.appendChild(s("rect", { x: cx, y: cy - 10, width: 13, height: 13, rx: 4, class: "ac-cell " + tone, style: { strokeWidth: 1.5 } }));
      g.appendChild(s("text", { x: cx + 19, y: cy + 1, class: "sv-label" }, text));
      if (o.dir === "col") cy += o.gap || 19; else cx += 19 + String(text).length * 6.4 + (o.gap || 16);
    });
    return { x: cx, y: cy };
  }

  /** Horizontal bars: bars(g, { x, y, w, labelW: 110, h: 24, gap: 10, max, items: [{ label, v, tone, text }] }).
      v draws the bar (tone: on | on2 | good | bad | dim | sorted); text prints after it (defaults to v). */
  function bars(g, o) {
    const hgt = o.h || 24, gap = o.gap == null ? 10 : o.gap, lw = o.labelW == null ? 110 : o.labelW, W = o.w - lw - (o.valueW == null ? 52 : o.valueW);
    const max = o.max || Math.max(1e-9, ...o.items.map((b) => b.v));
    return o.items.map((b, i) => {
      const y = o.y + i * (hgt + gap), w = Math.max(b.v > 0 ? 2 : 0, (b.v / max) * W);
      g.appendChild(s("text", { x: o.x + lw - 8, y: y + hgt / 2 + 4, class: "sv-label", "text-anchor": "end" }, b.label));
      g.appendChild(s("rect", { x: o.x + lw, y, width: W, height: hgt, rx: 6, class: "pl-track" }));
      g.appendChild(s("rect", { x: o.x + lw, y, width: w, height: hgt, rx: 6, class: "ac-cell " + (b.tone || "on2") }));
      const tx = b.text != null ? b.text : b.v;
      if (tx !== "") g.appendChild(s("text", { x: o.x + lw + W + 8, y: y + hgt / 2 + 4.5, class: "pl-val" }, String(tx)));
      return { x: o.x + lw, y, w, h: hgt, cy: y + hgt / 2, end: o.x + lw + w };
    });
  }

  /** A table in square brackets. Same options as grid(), plus label: a name printed above it. Returns pos(r, c). */
  function matrix(g, o) {
    const pos = grid(g, o);
    const a = pos(0, 0), b = pos(o.rows - 1, o.cols - 1), T = 7, P = 6;
    const x0 = a.x - P, x1 = b.x + b.w + P, y0 = a.y - P, y1 = b.y + b.h + P;
    g.appendChild(s("path", { d: `M${x0 + T},${y0} H${x0} V${y1} H${x0 + T}`, class: "mx-br" }));
    g.appendChild(s("path", { d: `M${x1 - T},${y0} H${x1} V${y1} H${x1 - T}`, class: "mx-br" }));
    if (o.label) g.appendChild(s("text", { x: (x0 + x1) / 2, y: y0 - (o.colLabels ? 20 : 8), class: "mx-name", "text-anchor": "middle" }, o.label));
    return pos;
  }

  /* ---------- plot: a number plane inside a machine ----------
     const P = plot(g, { x: 60, y: 16, w: 560, h: 240, xr: [0, 10], yr: [0, 8], xt: [0, 5, 10], yt: [0, 4, 8],
                         xlabel: "minutes", ylabel: "cost", grid: true });
     P.X(v), P.Y(v), P.xy(a, b) → [x, y] in SVG units
     P.line([[a, b], …], tone, { dash: true, width: 3 })   tone: on | on2 | good | bad | dim | lilac
     P.area([[a, b], …], tone)                             a filled polygon
     P.dot(a, b, { r: 6, tone, label: "A", dx: 10, dy: -8, anchor: "start" })
     P.vline(a, tone, "label") · P.hline(b, tone, "label") · P.text(a, b, "label", { tone, dx, dy, anchor })
     Marks go on top of the axes, in the order they are called. Keep points inside xr and yr, or pass clip: true
     to P.line / P.area to clip to the plot's rectangle. */
  let plotClip = 0;
  function plot(g, o) {
    const xa = o.xr[0], xb = o.xr[1], ya = o.yr[0], yb = o.yr[1];
    const X = (v) => o.x + ((v - xa) / (xb - xa)) * o.w, Y = (v) => o.y + o.h - ((v - ya) / (yb - ya)) * o.h;
    const fmtT = o.fmt || ((v) => String(v));
    const clipId = `pl-clip-${++plotClip}`;
    g.appendChild(s("clipPath", { id: clipId }, s("rect", { x: o.x, y: o.y, width: o.w, height: o.h })));
    const zx = Math.max(xa, Math.min(xb, 0)), zy = Math.max(ya, Math.min(yb, 0));
    (o.xt || []).forEach((v) => {
      if (o.grid) g.appendChild(s("line", { x1: X(v), y1: o.y, x2: X(v), y2: o.y + o.h, class: "pl-grid" }));
      g.appendChild(s("text", { x: X(v), y: o.y + o.h + 15, class: "pl-tick", "text-anchor": "middle" }, fmtT(v)));
    });
    (o.yt || []).forEach((v) => {
      if (o.grid) g.appendChild(s("line", { x1: o.x, y1: Y(v), x2: o.x + o.w, y2: Y(v), class: "pl-grid" }));
      g.appendChild(s("text", { x: o.x - 7, y: Y(v) + 4, class: "pl-tick", "text-anchor": "end" }, fmtT(v)));
    });
    g.appendChild(s("line", { x1: o.x, y1: Y(zy), x2: o.x + o.w, y2: Y(zy), class: "pl-axis" }));
    g.appendChild(s("line", { x1: X(zx), y1: o.y, x2: X(zx), y2: o.y + o.h, class: "pl-axis" }));
    if (o.xlabel) g.appendChild(s("text", { x: o.x + o.w, y: o.y + o.h + 31, class: "pl-name", "text-anchor": "end" }, o.xlabel));
    if (o.ylabel) g.appendChild(s("text", { x: o.x, y: o.y - 7, class: "pl-name", "text-anchor": "start" }, o.ylabel));
    const P = {
      X, Y, xy: (a, b) => [X(a), Y(b)],
      line(pts, tone, op = {}) {
        const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ");
        const el = s("path", { d, class: "pl-line" + (tone ? " " + tone : "") + (op.dash ? " dash" : ""), style: op.width ? { strokeWidth: op.width } : {}, "clip-path": op.clip ? `url(#${clipId})` : null });
        g.appendChild(el); return el;
      },
      area(pts, tone, op = {}) {
        const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ") + " Z";
        const el = s("path", { d, class: "pl-area" + (tone ? " " + tone : ""), "clip-path": op.clip ? `url(#${clipId})` : null });
        g.appendChild(el); return el;
      },
      dot(a, b, op = {}) {
        const el = s("circle", { cx: X(a), cy: Y(b), r: op.r || 6, class: "pl-dot" + (op.tone ? " " + op.tone : "") });
        g.appendChild(el);
        if (op.label != null) note(g, X(a) + (op.dx == null ? 11 : op.dx), Y(b) + (op.dy == null ? -9 : op.dy), op.label, { tone: op.tone, anchor: op.anchor || "start" });
        return el;
      },
      vline(a, tone, label) {
        g.appendChild(s("line", { x1: X(a), y1: o.y, x2: X(a), y2: o.y + o.h, class: "pl-line thin dash" + (tone ? " " + tone : "") }));
        if (label != null) note(g, X(a), o.y - 6, label, { tone });
      },
      hline(b, tone, label) {
        g.appendChild(s("line", { x1: o.x, y1: Y(b), x2: o.x + o.w, y2: Y(b), class: "pl-line thin dash" + (tone ? " " + tone : "") }));
        if (label != null) note(g, o.x + o.w - 4, Y(b) - 6, label, { tone, anchor: "end" });
      },
      text(a, b, str, op = {}) { return note(g, X(a) + (op.dx || 0), Y(b) + (op.dy || 0), str, op); },
    };
    return P;
  }

  /* ---------- terms: tap a word to see what it means ----------
     <span class="term">pivot</span> shows the matching entry from the page's "Words to know" list. Use
     data-w="pivot" when the running text says it differently ("pivots"). An entry "a / b" answers to a or b.
     A term with no entry is reported as a console error, which smoke.js catches. */
  function initTerms() {
    const terms = K.$$(".term");
    if (!terms.length) return;
    const norm = (t) => t.toLowerCase().replace(/\s+/g, " ").trim();
    const defs = new Map();
    K.$$(".word").forEach((w) => {
      const dt = w.querySelector("dt"), dd = w.querySelector("dd");
      if (!dt || !dd) return;
      defs.set(norm(dt.textContent), { name: dt.innerHTML, text: dd.innerHTML });
      dt.textContent.split(/\s*[\/,]\s*/).forEach((p) => { if (p.trim()) defs.set(norm(p), { name: dt.innerHTML, text: dd.innerHTML }); });
    });
    const tip = h("div", { class: "term-tip", role: "tooltip", id: "term-tip" });
    document.body.appendChild(tip);
    let holder = null;
    const hide = () => { tip.classList.remove("show"); holder = null; };
    const show = (el) => {
      const d = defs.get(norm(el.dataset.w || el.textContent));
      if (!d) return;
      holder = el;
      tip.innerHTML = `<b>${d.name}</b>${d.text}`;
      tip.classList.add("show");
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, innerWidth - tw - 8)) + "px";
      tip.style.top = (r.top - th - 8 > 66 ? r.top - th - 8 : r.bottom + 8) + "px";
    };
    terms.forEach((el) => {
      const key = norm(el.dataset.w || el.textContent);
      if (!defs.has(key)) { console.error(`term with no "Words to know" entry: ${key}`); return; }
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-describedby", "term-tip");
      el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") show(el); });
      el.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
      el.addEventListener("focus", () => show(el));
      el.addEventListener("blur", hide);
      // a tap focuses first, which opens the meaning: only a word already open before this press may close
      let wasOpen = false;
      el.addEventListener("pointerdown", () => { wasOpen = holder === el; });
      el.addEventListener("click", (e) => { e.preventDefault(); wasOpen ? hide() : show(el); wasOpen = false; });
    });
    // tabbing to a word scrolls it into view, so a focused word keeps its meaning and it moves along
    addEventListener("scroll", () => { if (!holder) return; if (holder === document.activeElement) show(holder); else hide(); }, { passive: true });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  }
  initTerms();

  window.AL = { cap, esc, fmt, box, txt, clickable, button, session, src, code, mem, cells, grid, tree, graph, CODE_LANG, langToggle, highlight,
    walk, mix, send, note, point, legend, bars, matrix, plot, rmap };
})();
