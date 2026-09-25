/* Chaotic Era — Political YouTube Leaderboard front-end.
   Loads the current + archived quarter data (data/channels-q3.json, data/channels-q2.json)
   plus data/lean.json, and renders a sortable, filterable table with a quarter switcher. */
(() => {
  "use strict";

  const LEAN_URL = "data/lean.json";
  // Quarters, newest first. `short` labels the columns; `label` labels the tab.
  const QUARTERS = {
    q3: { url: "data/channels-q3.json", short: "Q3", label: "Q3 2026", asOf: "Sep 25, 2026" },
    q2: { url: "data/channels-q2.json", short: "Q2", label: "Q2 2026", asOf: "Jul 1, 2026" },
  };

  // Subjective partisan-lean buckets (data/lean.json maps channel name -> key).
  const LEAN_META = {
    left: { label: "Left", cls: "lean-left", full: "Left — left-leaning, progressive, or Democrat" },
    "left-adjacent": { label: "Left Adjacent", cls: "lean-leftadj", full: "Left Adjacent — center-left or a soft Democratic lean" },
    "right-adjacent": { label: "Right Adjacent", cls: "lean-rightadj", full: "Right Adjacent — center-right or a soft Republican lean" },
    right: { label: "Right", cls: "lean-right", full: "Right — right-leaning, conservative, or Republican" },
    unrated: { label: "Unrated", cls: "lean-unrated", full: "Not yet classified — suggestions welcome" },
  };
  const LEAN_ORDER = { left: 0, "left-adjacent": 1, "right-adjacent": 2, right: 3, unrated: 4 };

  const state = {
    quarter: "q3",
    data: {}, // quarter key -> enriched rows
    docs: {}, // quarter key -> parsed doc
    leans: {}, // normalized name -> lean key
    sortKey: "subscribers",
    sortDir: -1,
    filter: "",
  };

  const els = {
    rows: document.getElementById("rows"),
    empty: document.getElementById("empty"),
    meta: document.getElementById("meta"),
    banner: document.getElementById("banner"),
    search: document.getElementById("search"),
    headers: Array.from(document.querySelectorAll("th.sortable")),
    tabs: Array.from(document.querySelectorAll(".ttab")),
  };

  const NF = new Intl.NumberFormat("en-US");

  const nameKey = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

  function abbr(n) {
    if (n >= 1e9) return strip(n / 1e9) + "B";
    if (n >= 1e6) return strip(n / 1e6) + "M";
    if (n >= 1e3) return (n < 1e4 ? strip(n / 1e3) : Math.round(n / 1e3)) + "K";
    return String(Math.round(n));
  }
  const strip = (x) => String(Math.round(x * 10) / 10);

  function numHTML(v) {
    if (v == null) v = 0;
    return `<span title="${NF.format(v)}">${abbr(Math.abs(v))}</span>`;
  }

  // Signed, color-coded delta (subscriber growth & views for the quarter).
  function deltaHTML(v) {
    if (v == null) v = 0;
    const sign = v > 0 ? "+" : v < 0 ? "−" : "";
    const cls = v > 0 ? "growth-up" : v < 0 ? "growth-down" : "growth-flat";
    return `<span class="growth ${cls}" title="${sign}${NF.format(Math.abs(v))}">${sign}${abbr(Math.abs(v))}</span>`;
  }

  function leanHTML(pub) {
    const meta = LEAN_META[pub.lean] || LEAN_META.unrated;
    return `<span class="lean ${meta.cls}" title="${escapeHTML(meta.full)}">${meta.label}</span>`;
  }

  function urlHTML(p) {
    if (!p.url) return '<span class="na">N/A</span>';
    const label = p.hasRealUrl ? handleLabel(p.url) : "YouTube ↗";
    return `<a class="pub-link" href="${escapeHTML(p.url)}" target="_blank" rel="noopener">${escapeHTML(label)}</a>`;
  }

  function handleLabel(url) {
    try {
      const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
      return path || new URL(url).host.replace(/^www\./, "");
    } catch {
      return "YouTube ↗";
    }
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  const NULLS_LAST = new Set(["growth", "views"]);

  function compare(a, b) {
    const k = state.sortKey;
    if (NULLS_LAST.has(k)) {
      const an = a[k] == null, bn = b[k] == null;
      if (an && bn) return 0;
      if (an) return 1;
      if (bn) return -1;
      return (a[k] - b[k]) * state.sortDir;
    }
    if (k === "lean") {
      return ((LEAN_ORDER[a.lean] ?? 99) - (LEAN_ORDER[b.lean] ?? 99)) * state.sortDir;
    }
    if (k === "channel") {
      const va = String(a.channel || "").toLowerCase();
      const vb = String(b.channel || "").toLowerCase();
      return va < vb ? -state.sortDir : va > vb ? state.sortDir : 0;
    }
    return ((Number(a[k]) || 0) - (Number(b[k]) || 0)) * state.sortDir;
  }

  // Set the growth/views column headers + tooltips to the active quarter.
  function updateQuarterHeaders() {
    const { short, label } = QUARTERS[state.quarter];
    const set = (key, text, tip) => {
      const th = document.querySelector(`th[data-key="${key}"]`);
      if (!th) return;
      const lab = th.querySelector(".th-label");
      const hint = th.querySelector(".hint");
      if (lab) lab.textContent = text;
      if (hint) hint.title = tip;
    };
    set("growth", `${short} Sub Growth`, `Net subscribers gained (or lost) during ${label}.`);
    set("views", `${short} Views`, `Video views during ${label}, including YouTube Shorts.`);
  }

  function render() {
    const rows = state.data[state.quarter] || [];
    const list = rows
      .filter((p) => {
        if (!state.filter) return true;
        const leanLabel = (LEAN_META[p.lean] || {}).label || "";
        return `${p.channel} ${leanLabel}`.toLowerCase().includes(state.filter);
      })
      .sort(compare);

    els.rows.innerHTML = list
      .map(
        (p) => `<tr>
          <td data-label="Channel" class="pub-name">${escapeHTML(p.channel)}</td>
          <td data-label="Lean">${leanHTML(p)}</td>
          <td class="num" data-label="Subscribers">${numHTML(p.subscribers)}</td>
          <td class="num" data-label="Sub Growth">${deltaHTML(p.growth)}</td>
          <td class="num" data-label="Views">${deltaHTML(p.views)}</td>
          <td data-label="URL">${urlHTML(p)}</td>
        </tr>`
      )
      .join("");

    els.empty.hidden = list.length > 0;
    const asOf = (QUARTERS[state.quarter] || {}).asOf || "";
    els.meta.textContent = `${list.length} channels · Data as of ${asOf}`;
    postHeight();
  }

  function postHeight() {
    try {
      if (window.parent && window.parent !== window) {
        const h = Math.ceil(document.documentElement.getBoundingClientRect().height);
        window.parent.postMessage({ type: "chaoticera-embed-height", height: h }, "*");
      }
    } catch (e) {
      /* cross-origin parent without access is fine */
    }
  }

  function updateHeaderIndicators() {
    els.headers.forEach((th) => {
      if (th.dataset.key === state.sortKey) th.setAttribute("aria-sort", state.sortDir === 1 ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    });
  }

  function setSort(key) {
    if (state.sortKey === key) state.sortDir *= -1;
    else {
      state.sortKey = key;
      state.sortDir = key === "channel" || key === "lean" ? 1 : -1;
    }
    updateHeaderIndicators();
    render();
  }

  function selectQuarter(q) {
    if (!QUARTERS[q]) return;
    state.quarter = q;
    els.tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.quarter === q));
    els.tabs.forEach((t) => t.setAttribute("aria-selected", t.dataset.quarter === q ? "true" : "false"));
    updateQuarterHeaders();
    render();
  }

  async function getJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function load() {
    try {
      const leanDoc = await getJSON(LEAN_URL);
      for (const [name, val] of Object.entries(leanDoc.leans || {})) state.leans[nameKey(name)] = val;
    } catch {
      /* no lean file -> everything shows as Unrated */
    }

    for (const [key, cfg] of Object.entries(QUARTERS)) {
      try {
        const doc = await getJSON(cfg.url);
        state.docs[key] = doc;
        state.data[key] = (doc.channels || []).map((c) => ({
          ...c,
          lean: state.leans[nameKey(c.channel)] || "unrated",
        }));
      } catch (err) {
        state.data[key] = [];
        els.banner.hidden = false;
        els.banner.innerHTML = `Could not load <code>${cfg.url}</code> (${escapeHTML(err.message)}). Run <code>npm run build</code>.`;
      }
    }
    render();
  }

  function init() {
    els.headers.forEach((th) => th.addEventListener("click", () => setSort(th.dataset.key)));
    els.tabs.forEach((t) => t.addEventListener("click", () => selectQuarter(t.dataset.quarter)));
    els.search.addEventListener("input", (e) => {
      state.filter = e.target.value.trim().toLowerCase();
      render();
    });
    updateHeaderIndicators();
    updateQuarterHeaders();
    load();

    if (window.parent && window.parent !== window) {
      window.addEventListener("load", postHeight);
      window.addEventListener("resize", postHeight);
      if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.body);
      setTimeout(postHeight, 600);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
