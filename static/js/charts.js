/* Result charts, drawn with D3 from window.DACE_DATA. */
(function () {
  "use strict";
  const D = window.DACE_DATA;
  if (!D || !window.d3) return;

  const C = {
    dace: "#E07020", daceLight: "#F6C29A", waft: "#5E7894", h4: "#7B5EA7", h4Light: "#C4B3DD",
    other: "#9AA8B5", occ: "#3B9FDB", good: "#1A7F37", bad: "#C2412D", ink: "#142F45", ink2: "#3A5266",
    muted: "#687A8A", line: "#E2E8EC", line2: "#CFD8DF", band: "#FFF4EA",
  };
  const MINUS = "\u2212";
  const fmt = (v, d = 2) => (v == null || Number.isNaN(v) ? "\u2013" : (v < 0 ? MINUS : "") + Math.abs(v).toFixed(d));
  const trunc1 = (v) => (Math.floor(v * 10 + 1e-9) / 10).toFixed(1);

  const DS5 = [
    { key: "thingsC", label: "Things Clean", short: "Things C" },
    { key: "thingsF", label: "Things Final", short: "Things F" },
    { key: "sintelC", label: "Sintel Clean", short: "Sintel C" },
    { key: "sintelF", label: "Sintel Final", short: "Sintel F" },
    { key: "kittiEPE", label: "KITTI", short: "KITTI" },
  ];
  const DS6 = DS5.concat([{ key: "kittiFl", label: "KITTI Fl (%)", short: "KITTI Fl", d: 1 }]);
  const dec = (k) => (k === "kittiFl" ? 1 : 2);

  /* ------------------------------------------------------------ helpers */
  const tip = document.getElementById("tooltip");
  function moveTip(ev) {
    const pad = 14, r = tip.getBoundingClientRect();
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }
  function showTip(html, ev) { tip.innerHTML = html; tip.classList.add("on"); moveTip(ev); }
  function hideTip() { tip.classList.remove("on"); }
  function bindTip(sel, html) {
    sel.on("pointerenter", (ev, d) => showTip(html(d), ev)).on("pointermove", moveTip).on("pointerleave", hideTip);
  }
  const ttRow = (k, v) => `<div class="tt-row"><span>${k}</span><span>${v}</span></div>`;
  window.addEventListener("scroll", hideTip, { passive: true });

  const charts = [];
  function register(el, render) {
    if (!el) return null;
    const entry = { el, w: 0, draw() { const w = Math.round(el.clientWidth); if (w) { entry.w = w; render(el, w); } } };
    new ResizeObserver(() => {
      const w = Math.round(el.clientWidth);
      if (w && Math.abs(w - entry.w) > 1) { entry.w = w; render(el, w); }
    }).observe(el);
    charts.push(entry);
    return entry;
  }
  function svgIn(el, w, h) {
    d3.select(el).selectAll("svg").remove();
    return d3.select(el).append("svg").attr("width", w).attr("height", h).attr("viewBox", `0 0 ${w} ${h}`);
  }
  function sym(g, type, x, y, area, fill, stroke, sw = 1.5) {
    return g.append("path").attr("d", d3.symbol(type, area)()).attr("transform", `translate(${x},${y})`)
      .attr("fill", fill).attr("stroke", stroke || "none").attr("stroke-width", sw);
  }
  function text(g, x, y, s, cls, anchor = "start") {
    return g.append("text").attr("x", x).attr("y", y).attr("class", cls || "label").attr("text-anchor", anchor).text(s);
  }
  function gridY(g, y, x0, x1, ticks) {
    g.append("g").attr("class", "grid").selectAll("line").data(ticks).join("line")
      .attr("x1", x0).attr("x2", x1).attr("y1", (t) => y(t)).attr("y2", (t) => y(t));
  }
  function gridX(g, x, y0, y1, ticks) {
    g.append("g").attr("class", "grid").selectAll("line").data(ticks).join("line")
      .attr("y1", y0).attr("y2", y1).attr("x1", (t) => x(t)).attr("x2", (t) => x(t));
  }
  function pills(group, onChange) {
    const btns = document.querySelectorAll(`[data-group="${group}"] .pill`);
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      onChange(b.dataset.metric);
    }));
  }
  function boxesOverlap(a, b) {
    return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
  }
  /* Greedy label placement around points; an item may carry a second line (`sub`).
     Returns [{x, y, anchor}] (first baseline) or null per item. */
  function placeLabels(items, bounds, obstacles) {
    const placed = obstacles.slice();
    return items.map((it) => {
      const cw = it.cw || 6.3, fh = it.fh || 13, r = (it.r || 4) + 3;
      const w = it.w || Math.max(it.text.length, it.sub ? it.sub.length : 0) * cw, h = fh * (it.sub ? 2 : 1);
      const d = r * 0.7;
      const cands = [
        [it.x + r, it.y - h / 2, "start"],
        [it.x - r - w, it.y - h / 2, "end"],
        [it.x - w / 2, it.y - r - 3 - h, "middle"],
        [it.x - w / 2, it.y + r, "middle"],
        [it.x + d, it.y - d - 2 - h, "start"],
        [it.x + d, it.y + d, "start"],
        [it.x - d - w, it.y - d - 2 - h, "end"],
        [it.x - d - w, it.y + d, "end"],
      ];
      const order = it.prefer ? [cands[it.prefer]].concat(cands) : cands;
      for (const [bx, by, a] of order) {
        const b = [bx, by, w, h];
        if (bx < bounds[0] || by < bounds[1] || bx + w > bounds[2] || by + h > bounds[3]) continue;
        if (placed.some((p) => boxesOverlap(p, b))) continue;
        placed.push(b);
        return { x: a === "start" ? bx : a === "end" ? bx + w : bx + w / 2, y: by + fh * 0.8, anchor: a };
      }
      return null;
    });
  }

  /* -------------------------------------------- zero-shot benchmark */
  function zeroShot() {
    const M = {
      sintelFinal: { label: "Sintel Final EPE", d: 2 },
      sintelClean: { label: "Sintel Clean EPE", d: 2 },
      kittiEPE: { label: "KITTI EPE", d: 2 },
      kittiFl: { label: "KITTI Fl (%)", d: 1 },
    };
    let metric = "sintelFinal";
    const rows = D.zeroShot;
    const colorOf = (m) => (m === "DACE" ? C.dace : m === "WAFT" ? C.waft : C.other);

    const scatter = register(document.getElementById("chart-zs-scatter"), (el, W) => {
      const H = Math.max(300, Math.min(440, Math.round(W * 0.7)));
      const m = { t: 30, r: 14, b: 44, l: 48 };
      const s = svgIn(el, W, H);
      const pts = rows.filter((r) => r[metric] != null && r.macs != null);
      const x = d3.scaleLog().domain([80, 16000]).range([m.l, W - m.r]);
      const vals = pts.map((p) => p[metric]);
      const y = d3.scaleLinear().domain([d3.min(vals) * 0.9, d3.max(vals) * 1.03]).nice().range([H - m.b, m.t]);
      const xt = [100, 300, 1000, 3000, 10000];
      gridX(s, x, m.t, H - m.b, xt);
      gridY(s, y, m.l, W - m.r, y.ticks(6));
      s.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
        .call(d3.axisBottom(x).tickValues(xt).tickFormat((d) => (d >= 1000 ? d / 1000 + "k" : d)).tickSizeOuter(0));
      s.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
      text(s, (m.l + W - m.r) / 2, H - 8, "GMACs per 540\u00d7960 image pair (log scale)", "axis-title", "middle");
      text(s, m.l - 40, m.t - 14, M[metric].label + " \u2193", "axis-title");
      text(s, W - m.r, m.t - 14, "dashed: accuracy\u2013compute frontier", "label muted", "end");

      const front = [];
      let best = Infinity;
      pts.slice().sort((a, b) => a.macs - b.macs).forEach((p) => { if (p[metric] < best) { front.push(p); best = p[metric]; } });
      s.append("path").attr("d", d3.line().x((p) => x(p.macs)).y((p) => y(p[metric]))(front))
        .attr("fill", "none").attr("stroke", C.ink2).attr("stroke-width", 1.2).attr("stroke-dasharray", "4 4").attr("opacity", 0.5);

      const order = pts.slice().sort((a, b) => (a.method === "DACE") - (b.method === "DACE") || (a.method === "WAFT") - (b.method === "WAFT"));
      const g = s.append("g");
      g.selectAll("circle").data(order).join("circle")
        .attr("cx", (p) => x(p.macs)).attr("cy", (p) => y(p[metric]))
        .attr("r", (p) => (p.method === "DACE" ? 7 : 5))
        .attr("fill", (p) => (p.method === "DACE" || p.method === "WAFT" ? colorOf(p.method) : "#fff"))
        .attr("stroke", (p) => (p.method === "DACE" ? "#fff" : colorOf(p.method)))
        .attr("stroke-width", (p) => (p.method === "DACE" ? 2 : 1.6));
      g.selectAll(".hit").data(order).join("circle").attr("class", "hit")
        .attr("cx", (p) => x(p.macs)).attr("cy", (p) => y(p[metric])).attr("r", 11)
        .call(bindTip, (p) => `<b>${p.method}</b>${ttRow(M[metric].label, fmt(p[metric], M[metric].d))}${ttRow("GMACs", p.macs.toFixed(0))}`);

      const prio = (p) => (p.method === "DACE" ? 0 : p.method === "WAFT" ? 1 : front.includes(p) ? 2 : ["SAMFlow", "FlowDiffuser"].includes(p.method) ? 3 : 4);
      const clsOf = (p) => (p.method === "DACE" ? "label dace" : p.method === "WAFT" ? "label waft" : "label muted");
      const widthOf = (p) => {
        const t = text(g, 0, 0, p.method, clsOf(p));
        const w = t.node().getComputedTextLength();
        t.remove();
        return w + 2;
      };
      const items = pts.slice().sort((a, b) => prio(a) - prio(b)).map((p) => ({
        p, x: x(p.macs), y: y(p[metric]), r: p.method === "DACE" ? 7 : 5, text: p.method, w: widthOf(p), fh: 13,
      }));
      const obstacles = pts.map((p) => [x(p.macs) - 5, y(p[metric]) - 5, 10, 10]);
      const pos = placeLabels(items, [m.l + 2, m.t, W - m.r, H - m.b - 2], obstacles);
      items.forEach((it, i) => {
        if (!pos[i]) return;
        text(g, pos[i].x, pos[i].y, it.text, clsOf(it.p), pos[i].anchor).attr("pointer-events", "none");
      });
    });

    const rank = register(document.getElementById("chart-zs-rank"), (el, W) => {
      const data = rows.filter((r) => r[metric] != null).slice().sort((a, b) => a[metric] - b[metric] || (b.method === "DACE") - (a.method === "DACE"));
      const rowH = 18, m = { t: 30, r: 42, b: 6, l: 104 };
      const H = m.t + data.length * rowH + m.b;
      const s = svgIn(el, W, H);
      const vals = data.map((d) => d[metric]);
      const x = d3.scaleLinear().domain([Math.min(...vals) * 0.85, Math.max(...vals) * 1.02]).range([m.l, W - m.r]);
      text(s, 0, 14, "All methods, ranked", "panel-title");
      text(s, W - 2, 14, "lower is better", "label muted", "end");
      const g = s.append("g").attr("transform", `translate(0,${m.t})`);
      const row = g.selectAll("g").data(data).join("g").attr("transform", (d, i) => `translate(0,${i * rowH})`);
      row.filter((d) => d.method === "DACE").append("rect").attr("x", 0).attr("y", 0).attr("width", W).attr("height", rowH).attr("rx", 4).attr("fill", C.band);
      row.append("text").attr("x", m.l - 10).attr("y", rowH / 2 + 4).attr("text-anchor", "end")
        .attr("class", (d) => (d.method === "DACE" ? "label dace" : d.method === "WAFT" ? "label waft" : "label"))
        .text((d) => d.method);
      row.append("line").attr("x1", m.l).attr("x2", (d) => x(d[metric])).attr("y1", rowH / 2).attr("y2", rowH / 2)
        .attr("stroke", (d) => (d.method === "DACE" ? C.daceLight : C.line2)).attr("stroke-width", 2);
      row.append("circle").attr("cx", (d) => x(d[metric])).attr("cy", rowH / 2).attr("r", (d) => (d.method === "DACE" ? 5.5 : 4.2))
        .attr("fill", (d) => colorOf(d.method));
      row.append("text").attr("x", (d) => x(d[metric]) + 8).attr("y", rowH / 2 + 4).attr("class", "value")
        .attr("font-weight", (d) => (d.method === "DACE" ? 700 : 400)).text((d) => fmt(d[metric], M[metric].d));
      row.append("rect").attr("class", "hit").attr("x", 0).attr("width", W).attr("height", rowH)
        .call(bindTip, (d) => `<b>${d.method}</b>${ttRow(M[metric].label, fmt(d[metric], M[metric].d))}${ttRow("GMACs", d.macs == null ? "not reported" : d.macs.toFixed(0))}`);
    });

    pills("zs-metric", (k) => { metric = k; scatter.draw(); rank.draw(); });
  }

  /* ------------------------------------- where the error is, by region */
  const diffTxt = (v) => (v > 0 ? "+" : v < 0 ? MINUS : "") + Math.abs(v).toFixed(2);
  const REGIONS = [
    { key: "visible", title: "Visible target" },
    { key: "occluded", title: "Target occluded or out of frame" },
    { key: "boundary", title: "Near motion boundaries" },
  ];
  function regions() {
    const R = D.regions, CC = D.concentration;
    register(document.getElementById("chart-concentration"), (el, W) => {
      const rowH = 40, m = { t: 52, r: 16, b: 28, l: 92 };
      const H = m.t + DS5.length * rowH + m.b;
      const s = svgIn(el, W, H);
      const x = d3.scaleLinear().domain([0, 60]).range([m.l, W - m.r]);
      text(s, 0, 14, W >= 480 ? "A small share of pixels causes roughly half of the error" : "Few pixels, roughly half of the error", "panel-title");
      const lg = s.append("g").attr("transform", `translate(${W >= 520 ? m.l : 0},30)`);
      lg.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", C.occ);
      text(lg, 15, 9, "share of valid pixels", "label");
      lg.append("rect").attr("x", 150).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", C.waft);
      text(lg, 165, 9, "share of WAFT\u2019s EPE", "label");
      gridX(s, x, m.t - 4, H - m.b, [0, 10, 20, 30, 40, 50, 60]);
      s.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
        .call(d3.axisBottom(x).tickValues([0, 10, 20, 30, 40, 50, 60]).tickFormat((d) => d + "%").tickSizeOuter(0));
      DS5.forEach((ds, i) => {
        const c = CC[ds.key], y0 = m.t + i * rowH;
        text(s, m.l - 10, y0 + rowH / 2 + 2, ds.label, "label", "end");
        [[c.pixels, C.occ, 6], [c.error, C.waft, 19]].forEach(([v, col, dy]) => {
          s.append("rect").attr("x", m.l).attr("y", y0 + dy).attr("width", x(v) - m.l).attr("height", 11).attr("rx", 2).attr("fill", col);
          text(s, x(v) + 5, y0 + dy + 10, v.toFixed(1) + "%", "value");
        });
        s.append("rect").attr("class", "hit").attr("x", 0).attr("y", y0).attr("width", W).attr("height", rowH)
          .call(bindTip, () => `<b>${ds.label}</b>${ttRow("Target occluded or out of frame", c.pixels.toFixed(1) + "% of pixels")}${ttRow("Their share of WAFT\u2019s EPE", c.error.toFixed(1) + "%")}`);
      });
    });

    register(document.getElementById("chart-regions"), (el, W) => {
      const cols = W >= 760 ? 3 : 1, gap = 30, vgap = 22;
      const pw = (W - gap * (cols - 1)) / cols;
      const rowH = 36, top = 46, ph = top + DS5.length * rowH + 4;
      const H = cols === 3 ? ph : REGIONS.length * ph + (REGIONS.length - 1) * vgap;
      const s = svgIn(el, W, H);
      REGIONS.forEach((rg, i) => {
        const g = s.append("g").attr("transform", cols === 3 ? `translate(${i * (pw + gap)},0)` : `translate(0,${i * (ph + vgap)})`);
        const lw = 68, rw = 46;
        const vmax = d3.max(DS5, (ds) => Math.max(R[ds.key][rg.key].WAFT, R[ds.key][rg.key].DACE));
        const x = d3.scaleLinear().domain([0, vmax]).range([lw, pw - rw - 36]);
        text(g, 0, 14, rg.title, "panel-title");
        text(g, 0, 31, "EPE in pixels", "label muted");
        text(g, pw, 31, "change", "label muted", "end");
        DS5.forEach((ds, j) => {
          const v = R[ds.key][rg.key], y0 = top + j * rowH;
          text(g, lw - 8, y0 + 16, ds.short, "label", "end");
          [["WAFT", C.waft, 0], ["DACE", C.dace, 1]].forEach(([nm, col, t]) => {
            const yy = y0 + 4 + t * 12;
            g.append("rect").attr("x", lw).attr("y", yy).attr("width", x(v[nm]) - lw).attr("height", 10).attr("rx", 2).attr("fill", col);
            text(g, x(v[nm]) + 4, yy + 9, fmt(v[nm]), nm === "DACE" ? "value dace small" : "value small");
          });
          const ch = v.DACE - v.WAFT;
          text(g, pw, y0 + 16, diffTxt(ch), ch < 0 ? "value good" : "value bad", "end");
          g.append("rect").attr("class", "hit").attr("x", 0).attr("y", y0).attr("width", pw).attr("height", rowH)
            .call(bindTip, () => `<b>${ds.label}: ${rg.title.toLowerCase()}</b>${ttRow("WAFT", fmt(v.WAFT))}${ttRow("DACE", fmt(v.DACE))}${ttRow("Change", diffTxt(ch) + " px")}`);
        });
      });
    });
  }

  /* ------------------------------------------- adaptive units vs. fixed grids */
  const ROWS6 = [
    ["thingsC", "Things Clean"], ["thingsF", "Things Final"], ["sintelC", "Sintel Clean"],
    ["sintelF", "Sintel Final"], ["kittiEPE", "KITTI EPE"], ["kittiFl", "KITTI Fl"],
  ];
  const daceRow = D.h4Overall.find((r) => r.system === "DACE" && r.attention);
  const gridRows = [
    { name: "Fixed grid, same unit count", color: C.h4, row: D.h4Overall.find((r) => r.system === "WAFT-H/4" && r.attention) },
    { name: "WAFT, four times as many units", color: C.waft, row: D.updates.find((r) => r.system === "WAFT" && r.updates === 5) },
  ];
  const MODELS3 = [gridRows[1], gridRows[0], { name: "DACE", color: C.dace, row: daceRow, ours: true }];

  /* Small multiples: as many columns as fit, else 3, else 2. */
  function panelLayout(W, n, minW) {
    const cols = W >= minW * n ? n : W >= 480 ? 3 : 2, gap = 18;
    const pw = (W - gap * (cols - 1)) / cols;
    return { cols, pw, rows: Math.ceil(n / cols), at: (i) => [(i % cols) * (pw + gap), Math.floor(i / cols)] };
  }

  /* One small bar panel per metric, each with its own scale. */
  function barPanels(el, W, metrics, models) {
    const L = panelLayout(W, metrics.length, 150), ph = 150, rowGap = 16, n = models.length;
    const s = svgIn(el, W, L.rows * ph + (L.rows - 1) * rowGap);
    metrics.forEach(([k, label], i) => {
      const [px, r] = L.at(i), d = dec(k);
      const g = s.append("g").attr("transform", `translate(${px},${r * (ph + rowGap)})`);
      const top = 40, base = ph - 6;
      const y = d3.scaleLinear().domain([0, d3.max(models, (mo) => mo.row[k])]).range([base, top]);
      const bw = Math.min(34, (L.pw - 24) / n - 8), gap = Math.min(12, bw * 0.4);
      const x0 = (L.pw - n * bw - (n - 1) * gap) / 2;
      text(g, L.pw / 2, 14, label + (k === "kittiFl" ? " (%)" : ""), "panel-title", "middle");
      models.forEach((mo, j) => {
        const v = mo.row[k], bx = x0 + j * (bw + gap);
        g.append("rect").attr("x", bx).attr("y", y(v)).attr("width", bw).attr("height", base - y(v)).attr("rx", 2).attr("fill", mo.color);
        text(g, bx + bw / 2, y(v) - 5, fmt(v, d), mo.ours ? "value dace" : "value", "middle");
      });
      g.append("line").attr("x1", x0 - 6).attr("x2", L.pw - x0 + 6).attr("y1", base).attr("y2", base).attr("stroke", C.line2);
      g.append("rect").attr("class", "hit").attr("width", L.pw).attr("height", ph)
        .call(bindTip, () => `<b>${label}</b>` + models.map((mo) => ttRow(mo.name, fmt(mo.row[k], d))).join(""));
    });
  }

  function fixedGrids() {
    register(document.getElementById("chart-grid"), (el, W) => barPanels(el, W, ROWS6, MODELS3));
  }

  /* -------------------------------- motion retained by units and readout */
  function reconstruction() {
    const models = [
      { name: "Fixed grid, same unit count", color: C.h4, row: D.reconstruction.find((r) => r.system === "WAFT-H/4") },
      { name: "DACE", color: C.dace, row: D.reconstruction.find((r) => r.system === "DACE"), ours: true },
    ];
    register(document.getElementById("chart-recon"), (el, W) => barPanels(el, W, ROWS6.slice(0, 5), models));
  }

  /* ------------------------------------- error vs. compute over updates */
  function updates() {
    const M = {
      sintelF: "Sintel Final EPE", sintelC: "Sintel Clean EPE", kittiEPE: "KITTI EPE",
      kittiFl: "KITTI Fl (%)", thingsC: "Things Clean EPE", thingsF: "Things Final EPE",
    };
    let metric = "sintelF";
    const series = [
      { name: "WAFT", color: C.waft, cls: "label waft", pts: D.updates.filter((r) => r.system === "WAFT") },
      { name: "DACE", color: C.dace, cls: "label dace", pts: D.updates.filter((r) => r.system === "DACE") },
    ];
    const d64 = D.updates.find((r) => r.system === "DACE-64");
    const chart = register(document.getElementById("chart-updates"), (el, W) => {
      const H = Math.max(300, Math.min(400, Math.round(W * 0.48)));
      const m = { t: 34, r: 16, b: 44, l: 52 };
      const s = svgIn(el, W, H);
      const d = dec(metric);
      const lo = d3.min(D.updates, (r) => r[metric]);
      const cap = d3.max(D.updates.filter((r) => r.updates >= 2), (r) => r[metric]);
      const y = d3.scaleLinear().domain([lo - (cap - lo) * 0.1, cap + (cap - lo) * 0.2]).range([H - m.b, m.t]);
      const x = d3.scaleLinear().domain([370, 880]).range([m.l, W - m.r]);
      const off = (v) => v > y.domain()[1];
      gridX(s, x, m.t, H - m.b, x.ticks(6));
      gridY(s, y, m.l, W - m.r, y.ticks(6));
      s.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6).tickSizeOuter(0));
      s.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
      text(s, (m.l + W - m.r) / 2, H - 8, "GMACs per 540\u00d7960 image pair", "axis-title", "middle");
      text(s, m.l - 44, m.t - 18, M[metric] + " \u2193", "axis-title");
      text(s, W - m.r, m.t - 18, "numbers: refinement updates", "label muted", "end");

      const clipId = "upd-clip";
      s.append("clipPath").attr("id", clipId).append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.b - m.t);
      const w5 = series[0].pts.find((p) => p.updates === 5);
      s.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(w5[metric])).attr("y2", y(w5[metric]))
        .attr("stroke", C.waft).attr("stroke-dasharray", "4 4").attr("opacity", 0.55);
      const obstacles = [];
      series.forEach((se) => {
        s.append("path").attr("clip-path", `url(#${clipId})`)
          .attr("d", d3.line().x((p) => x(p.macs)).y((p) => y(p[metric]))(se.pts))
          .attr("fill", "none").attr("stroke", se.color).attr("stroke-width", 2);
        se.pts.forEach((p) => {
          const cx = x(p.macs);
          if (off(p[metric])) {
            sym(s, d3.symbolTriangle, cx, m.t + 6, 60, se.color);
            text(s, cx + 8, m.t + 10, `${p.updates}: ${fmt(p[metric], d)} \u2191`, se.cls)
              .attr("paint-order", "stroke").attr("stroke", "#fff").attr("stroke-width", 3).attr("stroke-linejoin", "round");
            obstacles.push([cx - 6, m.t, 70, 14]);
            return;
          }
          const cy = y(p[metric]);
          s.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 8.5).attr("fill", se.color).attr("stroke", "#fff").attr("stroke-width", 1.5);
          text(s, cx, cy + 3.6, String(p.updates), "dot-num", "middle");
          obstacles.push([cx - 9, cy - 9, 18, 18]);
        });
      });
      const dx = x(d64.macs), dy = y(d64[metric]);
      sym(s, d3.symbolDiamond, dx, dy, 150, "#fff", C.dace, 2);
      obstacles.push([dx - 8, dy - 8, 16, 16]);
      const items = [
        { text: "WAFT", cls: "label waft", x: x(w5.macs), y: y(w5[metric]), r: 9, prefer: 0 },
        { text: "DACE", cls: "label dace", x: x(series[1].pts[4].macs), y: y(series[1].pts[4][metric]), r: 9, prefer: 0 },
        { text: "DACE-64", cls: "label dace", x: dx, y: dy, r: 8 },
      ];
      items.forEach((it) => {
        const t = text(s, 0, 0, it.text, it.cls);
        it.w = t.node().getComputedTextLength() + 2;
        t.remove();
      });
      const pos = placeLabels(items, [m.l + 2, m.t, W - m.r, H - m.b - 2], obstacles);
      items.forEach((it, i) => { if (pos[i]) text(s, pos[i].x, pos[i].y, it.text, it.cls, pos[i].anchor).attr("pointer-events", "none"); });

      const all = D.updates.map((p) => ({ p, cx: x(p.macs), cy: off(p[metric]) ? m.t + 6 : y(p[metric]) }));
      s.selectAll("circle.hit").data(all).join("circle").attr("class", "hit").attr("cx", (q) => q.cx).attr("cy", (q) => q.cy).attr("r", 12)
        .call(bindTip, (q) => `<b>${q.p.system}, ${q.p.updates} update${q.p.updates > 1 ? "s" : ""}</b>${ttRow(M[metric], fmt(q.p[metric], d))}${ttRow("GMACs", q.p.macs.toFixed(1))}`);
    });
    pills("up-metric", (k) => { metric = k; chart.draw(); });
  }

  /* ------------------------------- gain from the same local attention */
  function contextGain() {
    const pick = (sys, att) => D.h4Occluded.find((r) => r.system === sys && r.attention === att);
    const series = [
      { name: "Fixed grid, same unit count", color: C.h4, cls: "value h4", off: pick("WAFT-H/4", false), on: pick("WAFT-H/4", true) },
      { name: "DACE", color: C.dace, cls: "value dace", off: pick("DACE", false), on: pick("DACE", true) },
    ];
    const valsOf = (k) => series.flatMap((se) => [se.off[k], se.on[k]]);
    const span = d3.max(DS5, (ds) => d3.max(valsOf(ds.key)) - d3.min(valsOf(ds.key))) * 1.2;
    register(document.getElementById("chart-gain"), (el, W) => {
      const L = panelLayout(W, DS5.length, 150), ph = 190, rowGap = 16;
      const s = svgIn(el, W, L.rows * ph + (L.rows - 1) * rowGap);
      DS5.forEach((ds, i) => {
        const [px, r] = L.at(i), k = ds.key;
        const g = s.append("g").attr("transform", `translate(${px},${r * (ph + rowGap)})`);
        const top = 34, base = ph - 28, xa = 24, xb = L.pw - 54;
        const mid = (d3.max(valsOf(k)) + d3.min(valsOf(k))) / 2;
        const y = d3.scaleLinear().domain([mid - span / 2, mid + span / 2]).range([base, top]);
        text(g, L.pw / 2, 14, ds.label, "panel-title", "middle");
        [[xa, "without"], [xb, "with"]].forEach(([x, t]) => {
          g.append("line").attr("x1", x).attr("x2", x).attr("y1", top - 6).attr("y2", base + 6).attr("stroke", C.line);
          text(g, x, ph - 8, t, "label muted", "middle");
        });
        const ends = series.map((se) => y(se.on[k]));
        if (Math.abs(ends[0] - ends[1]) < 14) {
          const m = (ends[0] + ends[1]) / 2, sg = ends[0] <= ends[1] ? -1 : 1;
          ends[0] = m + sg * 7; ends[1] = m - sg * 7;
        }
        series.forEach((se, j) => {
          const y0 = y(se.off[k]), y1 = y(se.on[k]), change = se.on[k] - se.off[k];
          g.append("line").attr("x1", xa).attr("x2", xb).attr("y1", y0).attr("y2", y1).attr("stroke", se.color).attr("stroke-width", 2.2);
          g.append("circle").attr("cx", xa).attr("cy", y0).attr("r", 3.6).attr("fill", "#fff").attr("stroke", se.color).attr("stroke-width", 1.8);
          g.append("circle").attr("cx", xb).attr("cy", y1).attr("r", 4.2).attr("fill", se.color);
          text(g, xb + 9, ends[j] + 4, (change > 0 ? "+" : MINUS) + Math.abs(change).toFixed(2), se.cls);
        });
        g.append("rect").attr("class", "hit").attr("width", L.pw).attr("height", ph)
          .call(bindTip, () => `<b>${ds.label}</b>` + series.map((se) => ttRow(se.name, `${fmt(se.off[k])} \u2192 ${fmt(se.on[k])}`)).join(""));
      });
    });
  }

  /* ---------------------------------------------- "Show the numbers" tables */
  const cell = (v, d) => (v == null ? "\u2013" : fmt(v, d));
  const tableHTML = (head, body) => `<div class="table-wrap"><table class="num"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  const tables = {
    zeroShot: () => {
      const cols = [["sintelClean", "Sintel Clean", 2], ["sintelFinal", "Sintel Final", 2], ["kittiEPE", "KITTI EPE", 2], ["kittiFl", "KITTI Fl (%)", 1]];
      const best = {};
      cols.forEach(([k]) => { best[k] = Math.min(...D.zeroShot.map((r) => r[k]).filter((v) => v != null)); });
      const head = "<tr><th>Method</th>" + cols.map((c) => `<th>${c[1]}</th>`).join("") + "<th>GMACs</th></tr>";
      const body = D.zeroShot.map((r) => `<tr class="${r.method === "DACE" ? "ours" : ""}"><td>${r.method}</td>` +
        cols.map((c) => `<td class="${r[c[0]] === best[c[0]] ? "best" : ""}">${cell(r[c[0]], c[2])}</td>`).join("") +
        `<td>${r.macs == null ? "\u2013" : r.macs.toFixed(0)}</td></tr>`).join("");
      return tableHTML(head, body) + '<p class="src">Bold: lowest error. \u2013: not reported.</p>';
    },
    grids: () => {
      const head = "<tr><th>Model</th>" + ROWS6.map(([, l]) => `<th>${l}${l === "KITTI Fl" ? " (%)" : ""}</th>`).join("") + "</tr>";
      const rows = [{ name: "DACE", row: daceRow, ours: true }].concat(gridRows);
      const body = rows.map((g) => `<tr class="${g.ours ? "ours" : ""}"><td>${g.name}</td>` +
        ROWS6.map(([k]) => `<td class="${g.ours ? "best" : ""}">${fmt(g.row[k], dec(k))}</td>`).join("") + "</tr>").join("");
      return tableHTML(head, body) + '<p class="src">Lower is better.</p>';
    },
    regions: () => {
      const head = "<tr><th>Dataset</th><th>Occluded or out-of-frame pixels (%)</th><th>Their share of WAFT\u2019s EPE (%)</th>" +
        REGIONS.map((rg) => `<th>${rg.title}<br><small>WAFT / DACE</small></th>`).join("") + "</tr>";
      const body = DS5.map((ds) => {
        const r = D.regions[ds.key], c = D.concentration[ds.key];
        return `<tr><td>${ds.label}</td><td>${c.pixels.toFixed(1)}</td><td>${c.error.toFixed(1)}</td>` +
          REGIONS.map((rg) => `<td>${fmt(r[rg.key].WAFT)} / <b>${fmt(r[rg.key].DACE)}</b></td>`).join("") + "</tr>";
      }).join("");
      return tableHTML(head, body) + '<p class="src">Pooled EPE over valid pixels in each region. On Things, the missing-target region includes only out-of-frame pixels.</p>';
    },
    updates: () => {
      const head = "<tr><th>Model</th><th>Updates</th>" + ROWS6.map(([, l]) => `<th>${l}${l === "KITTI Fl" ? " (%)" : ""}</th>`).join("") + "<th>GMACs</th></tr>";
      const body = D.updates.map((r) => `<tr class="${r.system !== "WAFT" ? "ours" : ""}"><td>${r.system}</td><td>${r.updates}</td>` +
        ROWS6.map(([k]) => `<td>${fmt(r[k], dec(k))}</td>`).join("") + `<td>${r.macs.toFixed(1)}</td></tr>`).join("");
      return tableHTML(head, body) + '<p class="src">Both models are trained with five updates; DACE-64 is a separately trained narrower model.</p>';
    },
  };
  document.querySelectorAll("details.numbers[data-table]").forEach((det) => {
    const build = tables[det.dataset.table];
    if (!build) return;
    det.addEventListener("toggle", () => {
      if (det.open && !det.dataset.built) { det.insertAdjacentHTML("beforeend", build()); det.dataset.built = "1"; }
    });
  });

  zeroShot();
  regions();
  fixedGrids();
  contextGain();
  reconstruction();
  updates();
})();
