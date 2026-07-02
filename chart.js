/* Chaotic Era — political-YouTube charts.
   Three lean-coloured, interactive charts driven by data/channels.json + data/lean.json:
     1. Total subscribers  -> packed-bubble chart (D3 force layout)
     2. Q2 subscriber growth -> horizontal row chart (top N)
     3. Q2 video views       -> horizontal row chart (top N)
   Colour encodes partisan lean (blue = Left … red = Right). */
(() => {
  "use strict";

  const COLORS = {
    left: "#419eff",
    "left-adjacent": "#8fc4ff",
    "right-adjacent": "#ff9bb3",
    right: "#fa2c5d",
    unrated: "#9aa6b2",
  };
  const LEAN_LABEL = {
    left: "Left",
    "left-adjacent": "Left Adjacent",
    "right-adjacent": "Right Adjacent",
    right: "Right",
    unrated: "Unrated",
  };
  const NF = new Intl.NumberFormat("en-US");
  const ROW_LIMIT = 25; // rows shown in each bar chart (top N by the metric)

  const nameKey = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

  function abbr(n) {
    const s = n < 0 ? "−" : "";
    n = Math.abs(n);
    if (n >= 1e9) return s + strip(n / 1e9) + "B";
    if (n >= 1e6) return s + strip(n / 1e6) + "M";
    if (n >= 1e3) return s + (n < 1e4 ? strip(n / 1e3) : Math.round(n / 1e3)) + "K";
    return s + Math.round(n);
  }
  const strip = (x) => String(Math.round(x * 10) / 10);

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  async function getJSON(url) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }

  async function build() {
    const [doc, leanDoc] = await Promise.all([getJSON("data/channels.json"), getJSON("data/lean.json")]);
    if (!doc || !Array.isArray(doc.channels)) return;

    const leans = {};
    if (leanDoc && leanDoc.leans)
      for (const [n, v] of Object.entries(leanDoc.leans)) leans[nameKey(n)] = v;

    const items = doc.channels.map((c) => ({
      name: String(c.channel || "").trim(),
      url: c.url,
      subscribers: c.subscribers,
      q2Growth: c.q2Growth,
      q2Views: c.q2Views,
      lean: leans[nameKey(c.channel)] || "unrated",
    }));

    buildBubble(document.getElementById("bubble-chart"), items);
    buildRows(document.getElementById("growth-chart"), items, "q2Growth");
    buildRows(document.getElementById("views-chart"), items, "q2Views");
  }

  /* ---------- Chart 1: packed bubbles (subscribers) ---------- */
  function buildBubble(el, allItems) {
    if (!el || typeof d3 === "undefined") return;
    const items = allItems
      .filter((d) => d.subscribers > 0)
      .map((d) => ({ name: d.name, url: d.url, total: d.subscribers, lean: d.lean }));
    if (!items.length) return;

    const PAD = 2;
    const maxT = d3.max(items, (d) => d.total) || 1;
    const r = d3.scaleSqrt().domain([0, maxT]).range([3.5, 52]);
    items.forEach((d, i) => {
      d.r = r(d.total);
      const a = (i / items.length) * 2 * Math.PI;
      d.x = Math.cos(a) * 90;
      d.y = Math.sin(a) * 140;
    });

    const sim = d3
      .forceSimulation(items)
      .force("x", d3.forceX(0).strength(0.025))
      .force("y", d3.forceY(0).strength(0.18))
      .force("collide", d3.forceCollide((d) => d.r + PAD).iterations(6).strength(1))
      .stop();
    for (let i = 0; i < 400; i++) sim.tick();
    resolveOverlaps(items, PAD, 400);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const d of items) {
      minX = Math.min(minX, d.x - d.r);
      maxX = Math.max(maxX, d.x + d.r);
      minY = Math.min(minY, d.y - d.r);
      maxY = Math.max(maxY, d.y + d.r);
    }
    const m = 4;
    const svg = d3
      .select(el)
      .append("svg")
      .attr("viewBox", `${minX - m} ${minY - m} ${maxX - minX + 2 * m} ${maxY - minY + 2 * m}`)
      .attr("class", "bubbles-svg")
      .attr("role", "img")
      .attr("aria-label", "Packed bubbles of political YouTube channels, sized by subscribers and coloured by partisan lean");

    const tip = d3.select(el).append("div").attr("class", "bubble-tip").style("opacity", 0);

    svg
      .selectAll("circle")
      .data(items)
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r)
      .attr("fill", (d) => COLORS[d.lean] || COLORS.unrated)
      .attr("fill-opacity", 0.88)
      .attr("stroke", (d) => d3.color(COLORS[d.lean] || COLORS.unrated).darker(0.6))
      .attr("stroke-width", 0.6)
      .style("cursor", "pointer")
      .on("mousemove", function (event, d) {
        const [mx, my] = d3.pointer(event, el);
        tip
          .html(`<strong>${escapeHTML(d.name)}</strong><br>${NF.format(d.total)} subscribers · ${LEAN_LABEL[d.lean]}`)
          .style("left", mx + 12 + "px")
          .style("top", my + 12 + "px")
          .style("opacity", 1);
      })
      .on("mouseleave", () => tip.style("opacity", 0))
      .on("click", (event, d) => d.url && window.open(d.url, "_blank", "noopener"));
  }

  function resolveOverlaps(items, pad, maxPasses) {
    for (let pass = 0; pass < maxPasses; pass++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        for (let j = i + 1; j < items.length; j++) {
          const b = items[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const min = a.r + b.r + pad;
          if (dist < min) {
            const shift = (min - dist) / 2 / dist;
            a.x -= dx * shift; a.y -= dy * shift;
            b.x += dx * shift; b.y += dy * shift;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
  }

  /* ---------- Charts 2 & 3: horizontal row charts (top N) ---------- */
  function buildRows(el, allItems, key) {
    if (!el) return;
    const items = allItems
      .filter((d) => typeof d[key] === "number")
      .sort((a, b) => b[key] - a[key])
      .slice(0, ROW_LIMIT);
    if (!items.length) return;

    const max = Math.max(...items.map((d) => d[key]), 0) || 1;
    el.innerHTML = items
      .map((d) => {
        const color = COLORS[d.lean] || COLORS.unrated;
        const pct = Math.max(0, (d[key] / max) * 100);
        const valLabel = (d[key] > 0 ? "+" : "") + abbr(d[key]);
        const title = `${d.name} · ${valLabel} · ${LEAN_LABEL[d.lean]}`;
        return `<a class="rowbar" href="${escapeHTML(d.url)}" target="_blank" rel="noopener" title="${escapeHTML(title)}">
          <span class="rowbar-label">${escapeHTML(d.name)}</span>
          <span class="rowbar-track"><span class="rowbar-fill" style="width:${pct.toFixed(2)}%;background:${color}"></span></span>
          <span class="rowbar-val">${valLabel}</span>
        </a>`;
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", build);
})();
