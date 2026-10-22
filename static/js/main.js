/* Interactive figures: compare sliders, pipeline, assignments, learned partitions, gallery. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const NS = "http://www.w3.org/2000/svg";
  const MINUS = "\u2212";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover)").matches;
  const IMG = "static/img/";

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const tip = $("#tooltip");
  function showTip(html, ev) {
    tip.innerHTML = html;
    tip.classList.add("on");
    const pad = 14, r = tip.getBoundingClientRect();
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }
  const hideTip = () => tip.classList.remove("on");
  const vec = (dx, dy) => `(${dx > 0 ? "+" : dx < 0 ? MINUS : ""}${Math.abs(dx)}, ${dy > 0 ? "+" : dy < 0 ? MINUS : ""}${Math.abs(dy)})`;

  /* ---------------------------------------------------------------- nav */
  const nav = $(".topnav");
  const links = $$(".navlinks a");
  let current = null;
  function setActive(id) {
    if (id === current) return;
    current = id;
    links.forEach((a) => {
      const on = a.getAttribute("href") === "#" + id;
      a.classList.toggle("active", on);
      if (on && window.innerWidth < 900) a.parentElement.scrollTo({ left: a.offsetLeft - 40, behavior: "smooth" });
    });
  }
  const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  const onScroll = () => {
    nav.classList.toggle("scrolled", window.scrollY > 40);
    if (atBottom()) setActive("citation");
    else if (window.scrollY < 40) setActive(null);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting && !atBottom()) setActive(e.target.id); });
  }, { rootMargin: "-45% 0px -50% 0px" });
  $$("section[id]").forEach((s) => io.observe(s));

  /* --------------------------------------------------------------- math */
  function renderMath() {
    if (!window.renderMathInElement) return false;
    window.renderMathInElement(document.body, {
      delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }],
      throwOnError: false,
    });
    return true;
  }
  if (!renderMath()) window.addEventListener("load", renderMath);

  /* ---------------------------------------------------- compare slider */
  function Compare(root) {
    const base = $(".base", root), top = $(".top", root);
    const divider = $(".divider", root), lens = $(".lens", root);
    const tagL = $(".tag-left", root), tagR = $(".tag-right", root);
    const Z = 2.6;
    let pos = 50, dragging = false;
    const setPos = (p) => {
      pos = Math.max(0, Math.min(100, p));
      root.style.setProperty("--pos", pos + "%");
      divider.setAttribute("aria-valuenow", String(Math.round(pos)));
    };
    const pct = (ev) => { const r = root.getBoundingClientRect(); return ((ev.clientX - r.left) / r.width) * 100; };
    root.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      dragging = true;
      root.classList.remove("lens-on");
      root.setPointerCapture(ev.pointerId);
      setPos(pct(ev));
    });
    root.addEventListener("pointermove", (ev) => {
      if (dragging) { setPos(pct(ev)); return; }
      if (!lens || !canHover || ev.pointerType !== "mouse") return;
      const r = root.getBoundingClientRect();
      const px = ev.clientX - r.left, py = ev.clientY - r.top;
      if (px < 0 || py < 0 || px > r.width || py > r.height) { root.classList.remove("lens-on"); return; }
      const img = (px / r.width) * 100 < pos ? top : base;
      const L = lens.offsetWidth || 190;
      lens.style.left = px + "px";
      lens.style.top = py + "px";
      lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
      lens.style.backgroundSize = `${r.width * Z}px ${r.height * Z}px`;
      lens.style.backgroundPosition = `${-(px * Z - L / 2)}px ${-(py * Z - L / 2)}px`;
      root.classList.add("lens-on");
    });
    const end = () => { dragging = false; };
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
    root.addEventListener("pointerleave", () => root.classList.remove("lens-on"));
    divider.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft") { setPos(pos - 4); ev.preventDefault(); }
      if (ev.key === "ArrowRight") { setPos(pos + 4); ev.preventDefault(); }
    });
    setPos(50);
    return {
      set({ left, right, w, h, at }) {
        if (at != null) setPos(at);
        base.width = w; base.height = h;
        base.src = right.src; base.alt = right.label;
        top.src = left.src; top.alt = left.label;
        tagL.textContent = left.label; tagR.textContent = right.label;
      },
      root,
    };
  }

  /* -------------------------------------------------------------- teaser */
  (function teaser() {
    const root = $("#teaser-compare");
    if (!root) return;
    const cmp = Compare(root);
    const T = {
      sintel: { w: 1024, h: 436, name: "Sintel" },
      spring: { w: 1600, h: 900, name: "Spring" },
    };
    let scene = "sintel", left = "units";
    const draw = () => {
      const t = T[scene];
      cmp.set({
        left: left === "units" ? { src: `${IMG}teaser/${scene}_units.webp`, label: "Learned units" } : { src: `${IMG}teaser/${scene}_image.webp`, label: "Input image" },
        right: { src: `${IMG}teaser/${scene}_flow.webp`, label: "Predicted dense flow" },
        w: t.w, h: t.h,
      });
    };
    $$("[data-teaser]").forEach((b) => b.addEventListener("click", () => {
      scene = b.dataset.teaser;
      $$("[data-teaser]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      draw();
    }));
    $$("[data-teaser-left]").forEach((b) => b.addEventListener("click", () => {
      left = b.dataset.teaserLeft;
      $$("[data-teaser-left]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      draw();
    }));
    draw();
    ["spring_units", "spring_flow", "sintel_image"].forEach((n) => { const i = new Image(); i.src = `${IMG}teaser/${n}.webp`; });
  })();

  /* ---------------------------------------------------------- count-up */
  (function countUp() {
    const nums = $$("[data-count]");
    if (reduceMotion || !nums.length) return;
    const ob = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        ob.unobserve(e.target);
        const target = parseFloat(e.target.dataset.count), d = parseInt(e.target.dataset.dec || "0", 10);
        const suffix = e.target.dataset.suffix || "";
        const t0 = performance.now(), dur = 900;
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur), v = target * (1 - Math.pow(1 - k, 3));
          e.target.textContent = v.toFixed(d) + suffix;
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    nums.forEach((n) => ob.observe(n));
  })();

  /* ------------------------------------------------- pipeline stepper */
  (function pipeline() {
    const svg = $(".pipeline-overlay"), out = $("#step-text");
    if (!svg) return;
    const B = {
      image1: [3.6, 45.5, 108, 108], extract: [122.4, 38.9, 198.1, 96.5], dense: [212.5, 38.9, 275.6, 96.5],
      pLabel: [140, 110, 284, 166], pPanel: [286.5, 112.3, 401.7, 168.5],
      pool: [290, 38.9, 398.2, 96.5], attn: [412.6, 38.9, 480.9, 96.5], feat1: [495.3, 38.9, 566.9, 96.5],
      image2: [424, 110, 470, 129], feat2: [474.9, 103.7, 566.9, 132.5], refine: [581.3, 38.9, 678.3, 131],
      unitFlow: [692.7, 38.9, 770.8, 96.5], broadcast: [290, 175.7, 398.2, 233.3], flow: [3.6, 182.3, 108, 246],
      lUnit: [624.4, 2.9, 783, 24.5], lFlow: [427.6, 144.7, 656, 166.3], lAssign: [427.6, 172.1, 669, 193.7],
    };
    const steps = [
      { n: "", name: "Overview", text: "Soft assignments \\(P\\), predicted from dense image features, define adaptive units: pooling through \\(P\\) forms each unit's matching features, and broadcasting through \\(P\\) returns the predicted unit flow \\(U_t\\) to pixels as the dense flow \\(\\hat F_t\\). Image 2's units use shared weights. Pick a step to highlight it.", boxes: [] },
      { n: 1, name: "Dense features", text: "A shared backbone extracts dense features from each image.",
        boxes: ["image1", "extract", "dense"] },
      { n: 2, name: "Soft assignments", text: "Each pixel predicts soft weights over the \\(3\\times3\\) unit anchors around its cell, resolved at image resolution. Together they form the assignment matrix \\(P\\).",
        boxes: ["pLabel", "pPanel"] },
      { n: 3, name: "Unit matching features", text: "Pooling through \\(P\\) summarizes dense features over each unit's learned support. The pooled feature then queries local attention over nearby dense features of the same image.",
        boxes: ["dense", "pPanel", "pool", "attn", "feat1"] },
      { n: 4, name: "Matching and refinement", text: "WAFT's iterative matching and refinement estimates unit flow \\(U_t\\) from the two images' unit features. Each image's assignments are predicted once and reused across the \\(T\\) updates.",
        boxes: ["feat1", "image2", "feat2", "refine", "unitFlow"] },
      { n: 5, name: "Adaptive broadcasting", text: "The same assignments return each unit's flow to its pixels, giving dense flow \\(\\hat F_t = P\\,U_t\\).",
        boxes: ["unitFlow", "pPanel", "broadcast", "flow"] },
      { n: "", name: "Training", text: "Three losses on ground-truth flow train the units and assignments jointly: each unit fits the ground-truth flow pooled over its support, assignments favor motion-compatible units, and ground-truth flow passed through \\(P\\) should reconstruct the original.",
        boxes: ["lUnit", "lFlow", "lAssign"] },
    ];
    const { width: VW, height: VH } = svg.viewBox.baseVal;
    const defs = el("defs", {}, svg);
    const mask = el("mask", { id: "pipe-mask" }, defs);
    const dim = el("rect", { class: "dim", x: 0, y: 0, width: VW, height: VH, mask: "url(#pipe-mask)" }, svg);
    const hl = el("g", {}, svg);
    function show(i) {
      const st = steps[i];
      mask.textContent = "";
      hl.textContent = "";
      el("rect", { x: 0, y: 0, width: VW, height: VH, fill: "#fff" }, mask);
      st.boxes.map((k) => B[k]).forEach(([x0, y0, x1, y1]) => {
        el("rect", { x: x0 - 2, y: y0 - 2, width: x1 - x0 + 4, height: y1 - y0 + 4, rx: 5, fill: "#000" }, mask);
        el("rect", { x: x0 - 2, y: y0 - 2, width: x1 - x0 + 4, height: y1 - y0 + 4, rx: 5, class: "hl" }, hl);
      });
      dim.style.opacity = st.boxes.length ? 1 : 0;
      out.innerHTML = (st.n ? `<span class="step-n">${st.n}</span>` : "") + `<span class="step-name">${st.name}.</span> ${st.text}`;
      if (window.renderMathInElement) window.renderMathInElement(out, { delimiters: [{ left: "\\(", right: "\\)", display: false }], throwOnError: false });
      $$("[data-step]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.step === i)));
    }
    $$("[data-step]").forEach((b) => b.addEventListener("click", () => show(+b.dataset.step)));
    show(0);
    window.addEventListener("load", () => show(+($("[data-step][aria-pressed='true']") || { dataset: { step: 0 } }).dataset.step));
  })();

  /* --------------------------------------------- assignment explorer */
  (function assignments() {
    const svg = $("#assign-svg");
    if (!svg) return;
    const L = 120, O = 210;
    const st = { mx: 0.25, my: -0.15, spread: 0.75, elong: 1, rot: 0 };
    const offs = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) offs.push([dx, dy]);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      el("rect", { class: "cell" + (r === 1 && c === 1 ? " center" : ""), x: O - 1.5 * L + c * L + 3, y: O - 1.5 * L + r * L + 3, width: L - 6, height: L - 6, rx: 8 }, svg);
    }
    const note = el("text", { x: O - 0.5 * L + 11, y: O - 0.5 * L + 20, class: "cell-note" }, svg);
    note.textContent = "pixel x's cell";
    const gLinks = el("g", {}, svg);
    const outer = el("ellipse", { class: "contour outer" }, svg), inner = el("ellipse", { class: "contour" }, svg);
    const bubbles = offs.map(() => el("circle", { class: "anchor-bubble" }, svg));
    offs.forEach(([dx, dy]) => el("circle", { class: "anchor-dot", cx: O + dx * L, cy: O + dy * L, r: 3 }, svg));
    const labels = offs.map(([dx, dy]) => el("text", { class: "pct", x: O + dx * L, y: O + dy * L + 46, "text-anchor": "middle" }, svg));
    const mu = el("circle", { class: "mu", r: 9 }, svg);
    const muLabel = el("text", { class: "mu-label" }, svg);
    muLabel.textContent = "\u03bc";
    el("tspan", { "baseline-shift": "sub", "font-size": "70%" }, muLabel).textContent = "x";

    const sl = { spread: $("#s-spread"), elong: $("#s-elong"), rot: $("#s-rot") };
    const vOut = { spread: $("#v-spread"), elong: $("#v-elong"), rot: $("#v-rot") };
    function update() {
      const s1 = st.spread * Math.sqrt(st.elong), s2 = st.spread / Math.sqrt(st.elong), th = (st.rot * Math.PI) / 180;
      const c = Math.cos(th), s = Math.sin(th);
      const g11 = (c * c) / (s1 * s1) + (s * s) / (s2 * s2);
      const g22 = (s * s) / (s1 * s1) + (c * c) / (s2 * s2);
      const g12 = c * s * (1 / (s1 * s1) - 1 / (s2 * s2));
      const a = offs.map(([dx, dy]) => { const ex = dx - st.mx, ey = dy - st.my; return -0.5 * (g11 * ex * ex + 2 * g12 * ex * ey + g22 * ey * ey); });
      const amax = Math.max(...a), e = a.map((v) => Math.exp(v - amax)), z = e.reduce((p, q) => p + q, 0), A = e.map((v) => v / z);
      const H = -A.reduce((p, q) => p + (q > 1e-12 ? q * Math.log(q) : 0), 0) / Math.log(9);
      const mx = O + st.mx * L, my = O + st.my * L;
      [[inner, 1], [outer, 2]].forEach(([n, k]) => {
        n.setAttribute("cx", mx); n.setAttribute("cy", my);
        n.setAttribute("rx", k * s1 * L); n.setAttribute("ry", k * s2 * L);
        n.setAttribute("transform", `rotate(${st.rot} ${mx} ${my})`);
      });
      gLinks.textContent = "";
      offs.forEach(([dx, dy], i) => {
        const ax = O + dx * L, ay = O + dy * L;
        if (A[i] > 0.004) el("line", { class: "link", x1: mx, y1: my, x2: ax, y2: ay, "stroke-width": 0.6 + 9 * A[i], "stroke-opacity": 0.15 + 0.6 * A[i] }, gLinks);
        bubbles[i].setAttribute("cx", ax); bubbles[i].setAttribute("cy", ay);
        bubbles[i].setAttribute("r", 4 + 30 * Math.sqrt(A[i]));
        bubbles[i].setAttribute("fill-opacity", 0.18 + 0.6 * A[i]);
        labels[i].textContent = A[i] >= 0.995 ? "100%" : A[i] < 0.005 ? "0%" : (100 * A[i]).toFixed(A[i] < 0.1 ? 1 : 0) + "%";
        labels[i].setAttribute("opacity", A[i] < 0.005 ? 0.35 : 1);
      });
      mu.setAttribute("cx", mx); mu.setAttribute("cy", my);
      muLabel.setAttribute("x", mx + 12); muLabel.setAttribute("y", my - 10);
      vOut.spread.textContent = st.spread.toFixed(2);
      vOut.elong.textContent = st.elong.toFixed(1) + "\u00d7";
      vOut.rot.textContent = Math.round(st.rot) + "\u00b0";
      $("#v-entropy").textContent = H.toFixed(2);
      $("#entropy-mark").style.left = (H * 100).toFixed(1) + "%";
      let msg;
      if (H < 0.15) msg = "<b>Concentrated.</b> The pixel takes its flow from one unit, as near a motion boundary.";
      else if (H > 0.6) msg = "<b>Broad.</b> Several units share the pixel\u2019s weight, as inside a coherent region.";
      else msg = "<b>In between.</b> A few nearby units share the pixel.";
      if (st.elong > 2) msg += " Elongation spreads its weight along one direction.";
      $("#assign-msg").innerHTML = msg;
    }
    Object.keys(sl).forEach((k) => sl[k].addEventListener("input", () => {
      st[k] = parseFloat(sl[k].value);
      $$("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", "false"));
      update();
    }));
    let drag = false;
    const toLattice = (ev) => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      st.mx = Math.max(-1.45, Math.min(1.45, (p.x - O) / L));
      st.my = Math.max(-1.45, Math.min(1.45, (p.y - O) / L));
      $$("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", "false"));
      update();
    };
    svg.addEventListener("pointerdown", (ev) => { drag = true; svg.setPointerCapture(ev.pointerId); toLattice(ev); });
    svg.addEventListener("pointermove", (ev) => { if (drag) toLattice(ev); });
    svg.addEventListener("pointerup", () => { drag = false; });
    svg.addEventListener("pointercancel", () => { drag = false; });
    const presets = {
      interior: { mx: 0.1, my: -0.05, spread: 1.0, elong: 1, rot: 0 },
      boundary: { mx: 0.92, my: 0.05, spread: 0.24, elong: 1, rot: 0 },
      edge: { mx: 0.05, my: 0.5, spread: 0.6, elong: 4, rot: 0 },
    };
    $$("[data-preset]").forEach((b) => b.addEventListener("click", () => {
      Object.assign(st, presets[b.dataset.preset]);
      sl.spread.value = st.spread; sl.elong.value = st.elong; sl.rot.value = st.rot;
      $$("[data-preset]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      update();
    }));
    update();
  })();

  /* ------------------------------------------------ learned partitions */
  (function partition() {
    const root = $("#partition");
    if (!root) return;
    const cmp = Compare($("#part-compare"));
    const W = 1047, H = 524, U = `${IMG}units/`;
    const draw = (k) => {
      $("#part-image").src = `${U}${k}_image1.webp`;
      $("#part-groups").src = `${U}${k}_groups.webp`;
      ["#part-image", "#part-groups"].forEach((s) => { $(s).width = W; $(s).height = H; });
      cmp.set({
        left: { src: `${U}${k}_original_gt.webp`, label: "GT: original cells" },
        right: { src: `${U}${k}_learned_gt.webp`, label: "GT: learned groups" },
        w: W, h: H,
      });
      $$("[data-part]", root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.part === k)));
    };
    $$("[data-part]", root).forEach((b) => b.addEventListener("click", () => draw(b.dataset.part)));
    draw("b1");
  })();

  /* ------------------------------------------------------------ gallery */
  (function gallery() {
    const root = $("#gallery");
    if (!root) return;
    const EX = [
      { id: "sintel-ambush2", ds: "Sintel Clean", name: "ambush 2", title: "An occluded cape", w: 1024, h: 436,
        caption: "Much of the cape is hidden in Image\u00a02, so it has no visible match. DACE recovers its motion; WAFT gives it the wrong motion." },
      { id: "sintel-ambush5", ds: "Sintel Final", name: "ambush 5", title: "Blurred hair", w: 1024, h: 436, at: 22,
        caption: "The Final rendering blurs the moving hair. DACE recovers its motion; WAFT gives it the wrong direction." },
      { id: "kitti-45", ds: "KITTI", name: "000045", title: "A vehicle leaving the image", w: 1242, h: 375, at: 86,
        caption: "Part of the vehicle has left the image in Image\u00a02. DACE better separates its motion from the surrounding road." },
      { id: "kitti-182", ds: "KITTI", name: "000182", title: "An approaching vehicle", w: 1241, h: 376, at: 22,
        caption: "DACE better separates the approaching vehicle\u2019s motion from the road; WAFT spreads it into the road at the bottom left." },
      { id: "sintel-cave2", ds: "Sintel Clean", name: "cave 2", title: "A wing behind crossing limbs", w: 1024, h: 436,
        caption: "WAFT assigns incorrect motion to the wing behind the crossing limbs; DACE recovers the wing\u2019s motion." },
      { id: "sintel-ambush4", ds: "Sintel Clean", name: "ambush 4", title: "A broad sleeve", w: 1024, h: 436,
        caption: "The sleeve moves differently across its extent. DACE recovers this spatially varying motion; WAFT gives much of it the wrong motion." },
    ];
    const minis = $$(".mini", root), thumbs = $(".thumbs", root);
    const cmpRoot = $("#gallery-compare"), cmp = Compare(cmpRoot);
    const src = (ex, layer) => `${IMG}examples/${ex.id}/${layer}.webp`;
    let cur = EX[0];

    EX.forEach((ex) => {
      const b = document.createElement("button");
      b.className = "thumb"; b.type = "button";
      b.innerHTML = `<img src="${src(ex, "thumb")}" alt="" width="360" height="${Math.round((360 * ex.h) / ex.w)}"><span><b>${ex.ds}</b>${ex.title}</span>`;
      b.addEventListener("click", () => { cur = ex; render(); });
      thumbs.appendChild(b);
    });

    /* Hovering any view marks the same image position in all of them. */
    const views = minis.map((m) => $(".mini-img", m)).concat([cmpRoot]);
    const unmark = () => root.classList.remove("marking");
    views.forEach((v) => {
      v.addEventListener("pointermove", (ev) => {
        if (!canHover || ev.pointerType !== "mouse") return;
        const r = v.getBoundingClientRect();
        const fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
        if (fx < 0 || fy < 0 || fx > 1 || fy > 1) { unmark(); return; }
        root.style.setProperty("--fx", fx * 100 + "%");
        root.style.setProperty("--fy", fy * 100 + "%");
        views.forEach((o) => o.classList.toggle("here", o === v));
        root.classList.add("marking");
      });
      v.addEventListener("pointerleave", unmark);
    });

    function render() {
      $$(".thumb", thumbs).forEach((b, i) => b.setAttribute("aria-pressed", String(EX[i] === cur)));
      $("#ex-title").textContent = cur.title;
      $("#ex-meta").textContent = `${cur.ds} \u00b7 ${cur.name}`;
      $("#ex-caption").textContent = cur.caption;
      minis.forEach((m) => {
        const img = $("img", m);
        img.width = cur.w; img.height = cur.h;
        img.src = src(cur, m.dataset.layer);
      });
      cmp.set({
        left: { src: src(cur, "waft"), label: "WAFT" },
        right: { src: src(cur, "dace"), label: "DACE (ours)" },
        w: cur.w, h: cur.h, at: cur.at ?? 50,
      });
    }
    render();
  })();

  $$('a[href="#flow-colors"]').forEach((a) => a.addEventListener("click", () => { $("#flow-colors").open = true; }));

  /* -------------------------------------------------------- color wheel */
  (function wheel() {
    const cv = $("#colorwheel");
    if (!cv) return;
    const n = 132, dpr = Math.min(2, window.devicePixelRatio || 1), N = Math.round(n * dpr);
    cv.width = N; cv.height = N;
    const ctx = cv.getContext("2d"), im = ctx.createImageData(N, N);
    const RY = 15, YG = 6, GC = 4, CB = 11, BM = 13, MR = 6, cw = [];
    for (let i = 0; i < RY; i++) cw.push([1, i / RY, 0]);
    for (let i = 0; i < YG; i++) cw.push([1 - i / YG, 1, 0]);
    for (let i = 0; i < GC; i++) cw.push([0, 1, i / GC]);
    for (let i = 0; i < CB; i++) cw.push([0, 1 - i / CB, 1]);
    for (let i = 0; i < BM; i++) cw.push([i / BM, 0, 1]);
    for (let i = 0; i < MR; i++) cw.push([1, 0, 1 - i / MR]);
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      const u = (px + 0.5) / N * 2 - 1, v = (py + 0.5) / N * 2 - 1, r = Math.hypot(u, v), o = (py * N + px) * 4;
      if (r > 1) { im.data[o + 3] = 0; continue; }
      const a = Math.atan2(-v, -u) / Math.PI, fk = ((a + 1) / 2) * (cw.length - 1);
      const k0 = Math.floor(fk), k1 = (k0 + 1) % cw.length, t = fk - k0;
      for (let ch = 0; ch < 3; ch++) {
        const c = (1 - t) * cw[k0][ch] + t * cw[k1][ch];
        im.data[o + ch] = Math.round(255 * (1 - r * (1 - c)));
      }
      im.data[o + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
  })();

  /* ------------------------------------------------------------- bibtex */
  (function bib() {
    const btn = $("#copy-bib");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const t = $("#bibtex").innerText;
      try { await navigator.clipboard.writeText(t); } catch (e) {
        const r = document.createRange(); r.selectNodeContents($("#bibtex"));
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand("copy"); s.removeAllRanges();
      }
      btn.textContent = "Copied"; btn.classList.add("done");
      setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1600);
    });
  })();
})();
