/* Interactive Reading kit — tiny helpers shared by every chapter page of every book.
   Usage: <script src="book.js"></script><script src="../../assets/kit.js"></script> then K.page(3) and build sims with K.h / K.s / K.tween. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const THEME_KEY = "datatown-theme";
  function activeTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    document.querySelectorAll("[data-theme-switch] button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-theme") === theme));
    });
  }
  try {
    const saved = localStorage.getItem(THEME_KEY);
    document.documentElement.setAttribute("data-theme", saved === "dark" ? "dark" : "light");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
  const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The book manifest (books/<slug>/book.js) sets window.BOOK before this file loads. */
  const BOOK = window.BOOK || { slug: "book", short: "Library", chapters: [], built: 0 };
  const CHAPTERS = BOOK.chapters || [];
  /** Chapters 1..BUILT have pages; the rest are shown as "coming soon". */
  const BUILT = BOOK.built == null ? CHAPTERS.length : BOOK.built;

  /* ---- DOM helpers ---- */
  function apply(el, attrs, isSvg) {
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.setAttribute("class", v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    return el;
  }
  function add(el, kids) {
    for (const c of kids.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    }
    return el;
  }
  /** HTML element: h('button', {class:'btn', onclick}, 'Go') */
  const h = (tag, attrs, ...kids) => add(apply(document.createElement(tag), attrs), kids);
  /** SVG element: s('rect', {x, y, width, height, class:'sv-box'}) */
  const s = (tag, attrs, ...kids) => add(apply(document.createElementNS(NS, tag), attrs, true), kids);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---- motion ---- */
  const ease = {
    linear: (t) => t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };
  /* One speed for every animation on every page: sleep, tween, fly and loop divide their time by it,
     and CSS animations inside a sim get it as their playbackRate. The choice is remembered. */
  const SPEED_KEY = "datatown-speed";
  const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3];
  const speed = { value: 1 };
  try {
    const saved = Number(localStorage.getItem(SPEED_KEY));
    if (SPEEDS.includes(saved)) speed.value = saved;
  } catch (e) {}
  const inSim = (el) => el && el.closest && el.closest(".stage, svg");
  function rateAnims(anims) {
    anims.forEach((a) => { const t = a.effect && a.effect.target; if (inSim(t)) a.playbackRate = speed.value; });
  }
  ["animationstart", "transitionrun"].forEach((type) =>
    document.addEventListener(type, (e) => { if (e.target.getAnimations) rateAnims(e.target.getAnimations()); }, true));
  function setSpeed(v) {
    speed.value = v;
    try { localStorage.setItem(SPEED_KEY, String(v)); } catch (e) {}
    if (document.getAnimations) rateAnims(document.getAnimations());
    document.querySelectorAll("[data-speed-switch]").forEach((sel) => { sel.value = String(v); });
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 40) : ms / speed.value));
  /** tween(ms, t => {...}, ease.inOut) → Promise, resolves when done */
  function tween(ms, fn, e = ease.inOut) {
    return new Promise((resolve) => {
      const dur = reduced ? 1 : ms / speed.value;
      const t0 = performance.now();
      function frame(now) {
        const t = Math.max(0, Math.min(1, (now - t0) / dur)); // a frame stamped before t0 must not run backwards
        fn(e(t));
        if (t < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  /** Move an SVG element (use a <g>) from point a to b: fly(g, [x,y], [x,y], ms) */
  function fly(el, a, b, ms = 700, e = ease.inOut) {
    return tween(ms, (t) => el.setAttribute("transform", `translate(${lerp(a[0], b[0], t)},${lerp(a[1], b[1], t)})`), e);
  }
  /** Move along several points: path(g, [[x,y],[x,y],...], ms per leg) */
  async function path(el, pts, ms = 600) {
    for (let i = 1; i < pts.length; i++) await fly(el, pts[i - 1], pts[i], ms, i === 1 ? ease.inOut : ease.inOut);
  }
  /** A pausable animation loop: const L = loop((dt, t) => {...}); L.start(); L.stop(); */
  function loop(fn) {
    let raf = 0, last = 0, running = false, elapsed = 0;
    function frame(now) {
      const dt = Math.min(64, now - last) * speed.value; last = now; elapsed += dt;
      fn(dt, elapsed);
      if (running) raf = requestAnimationFrame(frame);
    }
    return {
      start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      get running() { return running; },
    };
  }
  /** Run start() while el is on screen and stop() when it scrolls away (keeps pages light). */
  function whenVisible(el, start, stop) {
    if (!("IntersectionObserver" in window)) { start(); return; }
    new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop && stop())), { threshold: 0.05 }).observe(el);
  }

  /* ---- UI bits ---- */
  function sunIcon() {
    return s("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" },
      s("circle", { cx: 12, cy: 12, r: 4, class: "theme-ico" }),
      s("path", { class: "theme-ico", d: "M12 2.4v2.3M12 19.3v2.3M2.4 12h2.3M19.3 12h2.3M5.05 5.05l1.6 1.6M17.35 17.35l1.6 1.6M18.95 5.05l-1.6 1.6M6.65 17.35l-1.6 1.6" }));
  }
  function moonIcon() {
    return s("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" },
      s("path", { class: "theme-moon", d: "M15.2 3.1a8.1 8.1 0 1 0 5.6 13.9A6.7 6.7 0 0 1 15.2 3.1z" }));
  }
  /** Sun and crescent. Light is the default; the choice is remembered. */
  function themeSwitch() {
    const theme = activeTheme();
    const wrap = h("div", { class: "theme-switch", role: "group", "aria-label": "Color theme", "data-theme-switch": "1" });
    [["light", "Light mode", sunIcon()], ["dark", "Dark mode", moonIcon()]].forEach(([name, label, icon]) => {
      const b = h("button", { type: "button", "data-theme": name, "aria-label": label, "aria-pressed": String(name === theme) }, icon);
      b.addEventListener("click", () => applyTheme(name));
      wrap.appendChild(b);
    });
    return wrap;
  }
  /** Animation speed picker for the top bar; changing it speeds up or slows down every sim on the page. */
  function speedSwitch() {
    const sel = h("select", { "aria-label": "Animation speed", title: "Animation speed", "data-speed-switch": "1" },
      SPEEDS.map((v) => h("option", { value: String(v) }, `${v}×`)));
    sel.value = String(speed.value);
    sel.addEventListener("change", () => setSpeed(Number(sel.value)));
    return h("label", { class: "speed-switch" }, sel);
  }
  /* Phones: a machine wider than the screen fits it whole, or zooms in and scrolls sideways.
     One choice for every machine on every page, remembered; the CSS only acts on it at phone width. */
  const VIEW_KEY = "datatown-sim-view";
  function applyView(view) {
    document.documentElement.setAttribute("data-sim-view", view);
    try { localStorage.setItem(VIEW_KEY, view); } catch (e) {}
    $$(".sim-zoom button").forEach((b) => {
      const zoomed = view === "zoom";
      b.setAttribute("aria-pressed", String(zoomed));
      b.lastChild.textContent = zoomed ? "Fit" : "Zoom";
      b.title = zoomed ? "Fit the whole machine on screen" : "Zoom in, then drag sideways";
    });
  }
  try { if (localStorage.getItem(VIEW_KEY) === "zoom") document.documentElement.setAttribute("data-sim-view", "zoom"); } catch (e) {}
  /** One zoom button in the head row of each stage that has a scrollable machine. */
  function mountZoom() {
    $$(".stage-scroll").forEach((sc) => {
      const stage = sc.closest(".stage");
      const head = stage && $(".stage-head", stage);
      if (!head || $(".sim-zoom", head)) return;
      const b = h("button", { type: "button", "aria-label": "Zoom in on the machine" },
        s("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, s("circle", { cx: 10.5, cy: 10.5, r: 6.5 }), s("path", { d: "M15.5 15.5L21 21M8 10.5h5M10.5 8v5" })),
        h("span", {}, ""));
      b.addEventListener("click", () => {
        const view = document.documentElement.getAttribute("data-sim-view") === "zoom" ? "fit" : "zoom";
        applyView(view);
        $$(".stage-scroll", stage).forEach((x) => { x.scrollLeft = 0; });
        if (view === "zoom") toast("Drag a machine sideways to see all of it");
      });
      head.appendChild(h("span", { class: "sim-zoom" }, b));
    });
    applyView(document.documentElement.getAttribute("data-sim-view") === "zoom" ? "zoom" : "fit");
  }
  function mountTheme() {
    $$(".topbar .wrap").forEach((wrap) => {
      if (wrap.querySelector("[data-theme-switch]")) return;
      if (!$(".spacer", wrap)) wrap.appendChild(h("span", { class: "spacer" }));
      wrap.appendChild(themeSwitch());
    });
  }

  /** Segmented control: seg(['A','B'], 0, i => ...) */
  function seg(labels, active, onChange, id) {
    const wrap = h("div", { class: "seg", role: "group", id });
    labels.forEach((label, i) => {
      const b = h("button", { type: "button", "aria-pressed": String(i === active) }, label);
      b.addEventListener("click", () => {
        $$("button", wrap).forEach((x, j) => x.setAttribute("aria-pressed", String(j === i)));
        onChange(i);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }
  /** Slider: slider({id, label, min, max, step, value, format, onInput}) */
  function slider(o) {
    const out = h("output", { for: o.id }, (o.format || String)(o.value));
    const input = h("input", { type: "range", id: o.id, min: o.min, max: o.max, step: o.step || 1, value: o.value });
    input.addEventListener("input", () => { const v = Number(input.value); out.textContent = (o.format || String)(v); o.onInput && o.onInput(v); });
    return h("div", { class: "slider" }, h("label", { for: o.id }, o.label), input, out);
  }
  /** Stat tile that you can update: const st = stat('Queries', 0); st.set(5, 'good') */
  function stat(label, value, tone) {
    const v = h("span", { class: "v" }, String(value));
    const el = h("div", { class: "stat" + (tone ? " " + tone : "") }, h("span", { class: "k" }, label), v);
    el.set = (val, t) => { v.textContent = String(val); el.className = "stat" + (t ? " " + t : ""); };
    return el;
  }
  let toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = h("div", { class: "toast", role: "status", "aria-live": "polite" }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  /* ---- progress (per-viewer convenience only) ---- */
  const PROGRESS = "datatown-progress-v1:";
  const KEY = PROGRESS + BOOK.slug;
  /* Slugs a book used to have, so a rename doesn't wipe a reader's progress: new slug → old slug.
     Copies the old record across once, if there is no new one yet, and leaves the old one alone.
     Runs on every page (the shelf reads every book's progress too), before anything reads it. */
  const RENAMED = { clrs: "algo" };
  Object.keys(RENAMED).forEach((slug) => {
    try {
      const old = localStorage.getItem(PROGRESS + RENAMED[slug]);
      if (old !== null && localStorage.getItem(PROGRESS + slug) === null) localStorage.setItem(PROGRESS + slug, old);
    } catch (e) {}
  });
  function getProgress() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function setDone(n) { try { const p = getProgress(); p[n] = true; localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }

  /** Quiz: quiz(container, [{q, options:[..], answer: 1, why:'...'}], chapterNumber) */
  function quiz(root, items, chapter) {
    let right = 0, answered = 0;
    const score = h("div", { class: "score", "aria-live": "polite" }, `0 / ${items.length} answered`);
    items.forEach((it, qi) => {
      const why = h("p", { class: "why", hidden: true }, it.why || "");
      const opts = h("div", { class: "opts" });
      it.options.forEach((label, oi) => {
        const b = h("button", { type: "button", class: "opt", id: `q${chapter}-${qi}-${oi}` }, label);
        b.addEventListener("click", () => {
          if (opts.dataset.done) return;
          opts.dataset.done = "1"; answered++;
          const buttons = $$(".opt", opts);
          buttons[it.answer].classList.add("right");
          if (oi === it.answer) right++; else b.classList.add("wrong");
          why.hidden = false;
          why.prepend(h("strong", {}, oi === it.answer ? "Yes! " : "Not quite. "));
          score.textContent = `${right} / ${items.length} correct` + (answered === items.length ? (right === items.length ? " — perfect!" : " — nice work") : "");
          if (answered === items.length) { setDone(chapter); renderDots(chapter); toast(`Chapter ${chapter} marked as explored`); }
        });
        opts.appendChild(b);
      });
      root.appendChild(h("div", { class: "q" }, h("h3", {}, `${qi + 1}. ${it.q}`), opts, why));
    });
    root.appendChild(score);
  }

  /* ---- page chrome ---- */
  const brandSvg = () =>
    s("svg", { class: "brand-mark", viewBox: "0 0 26 26", "aria-hidden": "true" },
      s("rect", { x: 1, y: 9, width: 11, height: 16, rx: 2.5, class: "sv-fill-blue" }),
      s("rect", { x: 14, y: 3, width: 11, height: 22, rx: 2.5, class: "sv-fill-ink" }),
      s("rect", { x: 4, y: 3, width: 5, height: 5, rx: 1.5, class: "sv-fill-sun" }),
      s("rect", { x: 17, y: 7, width: 5, height: 3, rx: 1, class: "sv-fill-surface" }),
      s("rect", { x: 17, y: 13, width: 5, height: 3, rx: 1, class: "sv-fill-surface" }));

  function renderDots(current) {
    const dots = $(".dots"); if (!dots) return;
    const p = getProgress();
    clear(dots);
    CHAPTERS.forEach((c) => {
      const ready = c.n <= BUILT;
      dots.appendChild(ready
        ? h("a", { href: file(c.n), "data-tip": `${c.n}. ${c.title}`, "aria-label": `Chapter ${c.n}: ${c.title}`, class: (c.n === current ? "here " : "") + (p[c.n] ? "done" : "") })
        : h("span", { class: "soon", "data-tip": `${c.n}. ${c.title} — coming soon`, "aria-label": `Chapter ${c.n}: ${c.title}, coming soon` }));
    });
    dotTips(dots);
  }
  /** Instant tooltip under a chapter dot (the native title tooltip waits ~1s), kept inside the viewport. */
  function dotTips(dots) {
    if (dots.dataset.tips) return;
    dots.dataset.tips = "1";
    const tip = h("div", { class: "dot-tip", "aria-hidden": "true" });
    document.body.appendChild(tip);
    const show = (e) => {
      const d = e.target.closest && e.target.closest("[data-tip]"); if (!d) return;
      tip.textContent = d.dataset.tip;
      tip.classList.add("show");
      const r = d.getBoundingClientRect(), w = tip.offsetWidth;
      tip.style.left = `${Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8))}px`;
      tip.style.top = `${r.bottom + 8}px`;
    };
    const hide = () => tip.classList.remove("show");
    dots.addEventListener("pointerover", show);
    dots.addEventListener("focusin", show);
    dots.addEventListener("pointerleave", hide);
    dots.addEventListener("focusout", hide);
    addEventListener("scroll", hide, { passive: true });
  }
  const file = (n) => `ch${String(n).padStart(2, "0")}.html`;

  /** Printed page → page of the book's PDF, via BOOK.pdf.offsets: [[first printed page, pages to add], …]. */
  function pdfPage(p) {
    let at = p;
    for (const [first, add] of BOOK.pdf.offsets) if (p >= first) at = p + add;
    return at;
  }
  /** A cite starts with its printed pages ("pp. 198–208 · …"): link them to the PDF, opened at that page in a new tab. */
  function linkCites() {
    if (!BOOK.pdf) return;
    $$("p.cite").forEach((cite) => {
      const t = cite.firstChild;
      if (!t || t.nodeType !== 3 || !/^pp?\./.test(t.data)) return;
      const pages = t.data.split(" · ")[0];
      const link = (text, p) => h("a", { href: `${BOOK.pdf.file}#page=${pdfPage(p)}`, target: "_blank", rel: "noopener", title: `Open the book at page ${p}` }, text);
      const groups = [...pages.matchAll(/\d+(?:–\d+)?/g)];
      const parts = [];
      if (groups.length === 1) parts.push(link(pages, parseInt(pages.match(/\d+/)[0], 10)));
      else {
        let i = 0;
        for (const g of groups) {
          parts.push(pages.slice(i, g.index), link(g[0], parseInt(g[0], 10)));
          i = g.index + g[0].length;
        }
        parts.push(pages.slice(i));
      }
      t.data = t.data.slice(pages.length);
      cite.insertBefore(add(document.createDocumentFragment(), parts), t);
    });
  }

  /** Call once per chapter page: K.page(n). Fills #topbar and #chapter-end. */
  function page(n) {
    linkCites();
    const c = CHAPTERS[n - 1];
    const prev = CHAPTERS[n - 2], next = n < BUILT ? CHAPTERS[n] : null, upcoming = CHAPTERS[n];
    const top = $("#topbar");
    if (top) {
      top.className = "topbar";
      top.appendChild(h("div", { class: "wrap" },
        h("a", { class: "navbtn wide", href: "../../index.html", title: "All books" }, "Books"),
        h("a", { class: "brand", href: "index.html", "aria-label": BOOK.book ? `${BOOK.short}, ${BOOK.book}` : BOOK.short }, brandSvg(), h("span", { class: "brand-name" }, BOOK.short)),
        h("span", { class: "where" }, `Ch ${n} · ${c.title}`),
        h("span", { class: "spacer" }),
        h("nav", { class: "dots", "aria-label": "Chapters" }),
        h("a", { class: "navbtn", href: prev ? file(prev.n) : "#", "aria-label": "Previous chapter", "aria-disabled": String(!prev) }, "←"),
        h("a", { class: "navbtn", href: next ? file(next.n) : "#", "aria-label": "Next chapter", "aria-disabled": String(!next) }, "→"),
        speedSwitch(),
        themeSwitch()));
      renderDots(n);
    }
    const end = $("#chapter-end");
    if (end) {
      end.className = "chapter-end";
      end.appendChild(h("div", { class: "wrap" },
        h("div", { class: "end-row" },
          h("a", { class: "btn", href: "index.html" }, "← All chapters"),
          h("button", { class: "btn good", type: "button", onclick: () => { setDone(n); renderDots(n); toast(`Chapter ${n} marked as explored`); } }, "✓ Mark chapter explored")),
        next
          ? h("a", { class: "next-card", href: file(next.n) }, h("span", { class: "num" }, String(next.n).padStart(2, "0")),
              h("span", {}, h("div", { class: "s" }, "Next stop"), h("div", { class: "t" }, next.title), h("div", { class: "s" }, next.kid)),
              h("span", { class: "arrow", "aria-hidden": "true" }, "→"))
          : h("a", { class: "next-card", href: "index.html" }, h("span", { class: "num" }, upcoming ? "…" : "✓"),
              h("span", {},
                h("div", { class: "s" }, upcoming ? "Coming soon" : "The end"),
                h("div", { class: "t" }, upcoming ? `${upcoming.n}. ${upcoming.title}` : "You finished every chapter!"),
                h("div", { class: "s" }, upcoming ? "Not built yet — head back to the map for the chapters that are ready." : "Head back to the map to revisit any chapter.")),
              h("span", { class: "arrow", "aria-hidden": "true" }, "→"))));
    }
    document.title = document.title || `Ch ${n} · ${c.title}`;
  }

  /* ---- drawing vocabulary: consistent pictures across chapters (all centred on cx, cy) ---- */
  const draw = {
    /** text label */
    label(x, y, text, cls = "sv-label", anchor = "middle") { return s("text", { x, y, class: cls, "text-anchor": anchor }, text); },
    /** database cylinder (lilac) */
    db(cx, cy, w = 70, hgt = 80, label, cls = "sv-db") {
      const rx = w / 2, ry = Math.max(6, w * 0.16), x0 = cx - rx, top = cy - hgt / 2 + ry, bot = cy + hgt / 2 - ry;
      return s("g", {},
        s("path", { class: cls, d: `M${x0},${top} V${bot} A${rx},${ry} 0 0 0 ${cx + rx},${bot} V${top}` }),
        s("ellipse", { class: cls, cx, cy: top, rx, ry }),
        s("path", { d: `M${x0},${cy - 2} A${rx},${ry} 0 0 0 ${cx + rx},${cy - 2}`, fill: "none", class: "sv-wire-solid", style: { stroke: "var(--lilac)", opacity: 0.45 } }),
        label ? draw.label(cx, cy + hgt / 2 + 18, label) : null);
    },
    /** server / service box (blue) with slots + status light. g.light lets you recolor the LED. */
    server(cx, cy, w = 80, hgt = 90, label, cls = "sv-server") {
      const x = cx - w / 2, y = cy - hgt / 2;
      const light = s("circle", { cx: x + w - 14, cy: y + 14, r: 5, class: "sv-fill-mint" });
      const g = s("g", {},
        s("rect", { x, y, width: w, height: hgt, rx: 12, class: cls }),
        ...[0, 1, 2].slice(0, Math.max(1, Math.floor((hgt - 24) / 16))).map((i) => s("rect", { x: x + 12, y: y + 30 + i * 16, width: w - 24, height: 7, rx: 3.5, class: "sv-fill-surface", style: { opacity: 0.9 } })),
        light,
        label ? draw.label(cx, cy + hgt / 2 + 18, label) : null);
      g.light = light;
      return g;
    },
    /** a person (use a fill class for color) */
    person(cx, cy, cls = "sv-fill-ink", scale = 1) {
      return s("g", { transform: `translate(${cx},${cy}) scale(${scale})` },
        s("circle", { cx: 0, cy: -14, r: 9, class: cls }),
        s("path", { d: "M-15,16 C-15,-2 15,-2 15,16 Z", class: cls }));
    },
    /** phone / frontend */
    phone(cx, cy, label) {
      return s("g", {},
        s("rect", { x: cx - 18, y: cy - 32, width: 36, height: 64, rx: 8, class: "sv-box" }),
        s("rect", { x: cx - 12, y: cy - 24, width: 24, height: 40, rx: 3, class: "sv-panel" }),
        s("circle", { cx, cy: cy + 24, r: 2.5, class: "sv-fill-line" }),
        label ? draw.label(cx, cy + 50, label) : null);
    },
    /** a data parcel — returns a <g> positioned at 0,0; move it with K.fly */
    parcel(cls = "sv-data", size = 16, text) {
      const g = s("g", { transform: "translate(-100,-100)" },
        s("rect", { x: -size / 2, y: -size / 2, width: size, height: size, rx: size * 0.25, class: cls }),
        text ? s("text", { x: 0, y: 4, class: "sv-label", "text-anchor": "middle", style: { fill: "var(--ink)", fontSize: "10px", fontWeight: 700 } }, text)
             : s("rect", { x: -size / 2, y: -1.5, width: size, height: 3, class: "sv-fill-surface", style: { opacity: 0.55 } }));
      return g;
    },
    /** straight arrow with head */
    arrow(x1, y1, x2, y2, cls = "sv-wire-solid") {
      const a = Math.atan2(y2 - y1, x2 - x1), L = 9;
      return s("g", {},
        s("line", { x1, y1, x2, y2, class: cls }),
        s("path", { d: `M${x2},${y2} L${x2 - L * Math.cos(a - 0.45)},${y2 - L * Math.sin(a - 0.45)} L${x2 - L * Math.cos(a + 0.45)},${y2 - L * Math.sin(a + 0.45)} Z`, class: "sv-fill-line", style: { fill: "var(--line-strong)" } }));
    },
    /** speech bubble whose tail points at (cx, cy); sizes itself to the text. g.say('hi') / g.say('') */
    bubble(cx, cy, minW = 60, bounds = [0, 10000]) {
      const t = s("text", { x: cx, y: cy - 22, class: "sv-text", "text-anchor": "middle", style: { fontSize: "13px", fontWeight: 700 } }, "");
      const r = s("rect", { x: cx - minW / 2, y: cy - 42, width: minW, height: 30, rx: 10, class: "sv-box" });
      const g = s("g", { style: { opacity: 0, transition: "opacity .25s" }, "aria-hidden": "true" },
        r, s("path", { d: `M${cx - 7},${cy - 13.5} L${cx},${cy - 4} L${cx + 7},${cy - 13.5} Z`, class: "sv-fill-surface" }), t);
      g.say = (text) => {
        t.textContent = text || "";
        const w = Math.max(minW, (text || "").length * 7.1 + 24);
        const x = Math.min(Math.max(cx - w / 2, bounds[0]), bounds[1] - w);
        r.setAttribute("x", x); r.setAttribute("width", w); t.setAttribute("x", x + w / 2);
        g.style.opacity = text ? 1 : 0;
      };
      return g;
    },
    /** rounded tag with text, positioned at 0,0 — move it with K.fly */
    tag(text, cls = "sv-data-soft") {
      const w = Math.max(28, String(text).length * 7.4 + 18);
      return s("g", { transform: "translate(-200,-200)" },
        s("rect", { x: -w / 2, y: -11, width: w, height: 22, rx: 11, class: cls }),
        s("text", { x: 0, y: 4, class: "sv-label", "text-anchor": "middle", style: { fill: "var(--ink)", fontWeight: 700 } }, String(text)));
    },
  };

  /* ---- full screen: one machine and its code side by side (CS:APP pages) ----
     The same idea as books/clrs/algo.js's Full screen, for pages that don't load algo.js. A Full screen button in each
     machine's head row lifts that stage over the page (and into the browser's own full screen where allowed): the
     picture fills the left and the code panel the right. The picture fits its box at 100%; − and + (or ctrl/⌘ + wheel,
     a trackpad pinch, or the - + 0 keys) zoom it, and a zoomed picture pans by dragging. Code hides or shows the
     listing. Esc or the button leaves. Code panels are built after this file runs, so a stage's panel is looked up
     when it enters full screen. */
  const FULL_BOOKS = ["csapp"];
  const FULL_CSS = `
.fs-btn, .fs-code { appearance: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px;
  border: 1px solid var(--line-strong); border-radius: 999px; background: var(--surface); color: var(--ink-2); font: 700 12px/1 var(--f-body); }
.fs-btn { padding-left: 9px; }
.fs-btn:hover, .fs-code:hover { border-color: var(--lilac); color: var(--lilac); }
.fs-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.fs-btn[aria-pressed="true"], .fs-code[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--bg); }
.stage-head > .stage-title { margin-right: auto; }
.fs-zoom, .fs-code { display: none; }
.is-full .fs-code { display: inline-flex; }
.is-full .fs-zoom { display: inline-flex; background: var(--surface); border: 1px solid var(--line-strong); border-radius: 999px; padding: 2px; gap: 2px; }
.fs-zoom button { appearance: none; border: 0; background: transparent; color: var(--ink-2); font: 700 13px/1 var(--f-mono); min-width: 28px; height: 24px; padding: 0 7px; border-radius: 999px; cursor: pointer; }
.fs-zoom button:hover { background: var(--surface-2); color: var(--lilac); }
.has-full, .has-full body { overflow: hidden; }
.wrap .stage.is-full { position: fixed; inset: 0; z-index: 70; margin: 0; max-width: none; width: auto; height: 100vh; height: 100dvh;
  border: 0; border-radius: 0; box-shadow: none; background-image: none;
  display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(360px, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto auto; }
.stage.is-full > * { grid-column: 1; min-width: 0; }
.stage.is-full > .stage-head { grid-column: 1 / -1; }
.stage.is-full .sim-zoom { display: none; }
.stage.is-full > .stage-scroll { display: flex; overflow: auto; padding: 8px; overscroll-behavior: contain; }
.stage.is-full > .stage-scroll > svg { flex: none; margin: auto; min-width: 0; max-width: none; }
.stage.is-full > .stage-scroll.zoomed { cursor: grab; }
.stage.is-full > .stage-scroll.panning { cursor: grabbing; user-select: none; }
.stage.is-full > .codepane { grid-column: 2; grid-row: 2 / -1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border-top: 0; border-left: 1px solid var(--line); }
.stage.is-full .codepane > * { flex: none; }
.stage.is-full .codepane > .cp-body { flex: 1 1 0; min-height: 0; max-height: none; }
.stage.is-full .codepane > .cp-out { max-height: 22vh; overflow: auto; }
.wrap .stage.is-full.no-code { grid-template-columns: minmax(0, 1fr); }
.stage.is-full.no-code > .codepane { display: none; }
@media (max-width: 899px) and (orientation: portrait) {
  .wrap .stage.is-full { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto auto minmax(0, 40%); }
  .stage.is-full > .codepane { grid-column: 1; grid-row: 6; border-left: 0; border-top: 1px solid var(--line); }
}
@media (max-width: 899px) and (orientation: landscape) { .wrap .stage.is-full { grid-template-columns: minmax(0, 1.2fr) minmax(300px, 1fr); } }
@media (max-width: 899px), (max-height: 560px) {
  .stage.is-full > .stage-head { padding: 6px 10px; gap: 6px; }
  .stage.is-full > .stage-head > .stage-title { display: none; }
  .stage.is-full > .controls { padding: 6px 10px; }
  .stage.is-full > .statrow { flex-wrap: nowrap; overflow-x: auto; padding: 6px 10px; gap: 6px; }
  .stage.is-full > .caption { padding: 6px 12px; min-height: 0; font-size: 14px; }
  .stage.is-full .codepane .cp-head { padding: 5px 10px; }
}`;
  function mountFull() {
    if (!FULL_BOOKS.includes(BOOK.slug)) return;
    document.head.appendChild(h("style", { id: "kit-full-css" }, FULL_CSS));
    const STEPS = [1, 1.25, 1.5, 2, 2.5, 3, 4];
    const ICON_IN = "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5", ICON_OUT = "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5";
    const stages = [];
    let cur = null;
    const pane = (st) => $(":scope > .codepane", st.stage); // built by the page after this file runs
    function size() {
      if (!cur) return;
      const { scroller: sc, svg } = cur, vb = svg.viewBox.baseVal;
      if (vb && vb.width && vb.height) {
        const k = Math.max(0.1, Math.min((sc.clientWidth - 16) / vb.width, (sc.clientHeight - 16) / vb.height)) * cur.z;
        svg.style.width = vb.width * k + "px"; svg.style.height = vb.height * k + "px";
      }
      sc.classList.toggle("zoomed", cur.z > 1);
      cur.pct.textContent = Math.round(cur.z * 100) + "%";
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
    function paint(st) {
      const on = cur === st, hasCode = !!pane(st);
      st.btn.setAttribute("aria-pressed", String(on));
      $("path", st.btn).setAttribute("d", on ? ICON_OUT : ICON_IN);
      st.btn.lastChild.textContent = on ? "Exit" : "Full screen";
      st.btn.title = on ? "Leave full screen (Esc)" : "Show this machine and its code side by side";
      st.stage.classList.toggle("no-code", on && (st.codeOff || !hasCode));
      st.code.hidden = !hasCode;
      st.code.setAttribute("aria-pressed", String(!st.codeOff));
    }
    function enter(st) {
      if (cur) exit();
      cur = Object.assign(st, { z: 1, native: false });
      st.stage.classList.add("is-full");
      document.documentElement.classList.add("has-full");
      st.ro = new ResizeObserver(size); st.ro.observe(st.scroller);
      st.mo = new MutationObserver(size); st.mo.observe(st.svg, { attributes: true, attributeFilter: ["viewBox"] });
      paint(st); size(); st.btn.focus();
      try {
        const p = st.stage.requestFullscreen && st.stage.requestFullscreen({ navigationUI: "hide" });
        if (p && p.then) p.then(() => { if (cur === st) st.native = true; }, () => {});
      } catch (e) {}
    }
    function exit() {
      const st = cur; if (!st) return;
      cur = null;
      st.ro.disconnect(); st.mo.disconnect();
      st.stage.classList.remove("is-full", "no-code");
      document.documentElement.classList.remove("has-full");
      st.scroller.classList.remove("zoomed", "panning");
      st.svg.style.width = st.svg.style.height = "";
      if (document.fullscreenElement === st.stage) document.exitFullscreen().catch(() => {});
      paint(st);
      st.stage.scrollIntoView({ block: "nearest" });
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
    $$(".stage").forEach((stage) => {
      const scroller = $(":scope > .stage-scroll", stage), svg = scroller && $(":scope > svg", scroller);
      const head = $(":scope > .stage-head", stage);
      if (!svg || !head || $(".fs-btn", head)) return;
      const btn = h("button", { type: "button", class: "fs-btn" },
        s("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, s("path", { d: ICON_IN })), h("span", {}, ""));
      const bar = h("span", { class: "fs-zoom", role: "group", "aria-label": "Zoom the picture" });
      const zb = (label, aria, fn) => { const x = h("button", { type: "button", "aria-label": aria, title: aria }, label); x.addEventListener("click", fn); bar.appendChild(x); return x; };
      zb("−", "Zoom out", () => step(-1));
      const pct = zb("100%", "Fit the picture to the screen", () => zoom(1));
      zb("+", "Zoom in", () => step(1));
      const code = h("button", { type: "button", class: "fs-code", title: "Show or hide the code panel" }, "Code");
      const st = { stage, scroller, svg, btn, pct, code, codeOff: stage.dataset.code === "off" };
      btn.addEventListener("click", () => (cur === st ? exit() : enter(st)));
      code.addEventListener("click", () => { st.codeOff = !st.codeOff; paint(st); });
      head.append(code, bar, btn);
      stages.push(st); wire(st); paint(st);
    });
    // a page builds its code panels after this file runs: paint again so Code shows where a listing exists
    window.addEventListener("load", () => stages.forEach(paint));
  }

  mountTheme();
  mountZoom();
  mountFull();
  window.K = { BOOK, CHAPTERS, BUILT, h, s, $, $$, clear, tween, fly, path, loop, sleep, lerp, ease, speed, setSpeed, reduced, whenVisible, seg, slider, stat, toast, quiz, page, themeSwitch, speedSwitch, applyTheme, getProgress, setDone, file, draw };
})();
