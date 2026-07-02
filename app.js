/* Chaotic Era — Political YouTube Leaderboard front-end.
   Loads data/channels.json + data/lean.json, renders a sortable, filterable table. */
(() => {
  "use strict";

  const DATA_URL = "data/channels.json";
  const LEAN_URL = "data/lean.json";

  // Subjective partisan-lean buckets (data/lean.json maps channel name -> key).
  const LEAN_META = {
    left: { label: "Left", cls: "lean-left", full: "Left — left-leaning, progressive, or Democrat" },
    "left-adjacent": { label: "Left Adjacent", cls: "lean-leftadj", full: "Left Adjacent — center-left or a soft Democratic lean" },
    "right-adjacent": { label: "Right Adjacent", cls: "lean-rightadj", full: "Right Adjacent — center-right or a soft Republican lean" },
    right: { label: "Right", cls: "lean-right", full: "Right — right-leaning, conservative, or Republican" },
    unrated: { label: "Unrated", cls: "lean-unrated", full: "Not yet classified — suggestions welcome" },
  };
  // Sort order across the spectrum (left → right), with Unrated last.
  const LEAN_ORDER = { left: 0, "left-adjacent": 1, "right-adjacent": 2, right: 3, unrated: 4 };

  const state = {
    rows: [], // enriched channel records
    leans: null, // normalized name -> lean key
    doc: null, // parsed channels.json
    sortKey: "subscribers",
    sortDir: -1, // largest first
    filter: "",
  };

  const els = {
    rows: document.getElementById("rows"),
    empty: document.getElementById("empty"),
    meta: document.getElementById("meta"),
    banner: document.getElementById("banner"),
    search: document.getElementById("search"),
    headers: Array.from(document.querySelectorAll("th.sortable")),
  };

  const NF = new Intl.NumberFormat("en-US");

  // Normalize a channel name for matching against data/lean.json keys.
  const nameKey = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

  // Abbreviate a non-negative number: 7.3M, 510K, 9K, 3.4B, 190.
  function abbr(n) {
    if (n >= 1e9) return strip(n / 1e9) + "B";
    if (n >= 1e6) return strip(n / 1e6) + "M";
    if (n >= 1e3) return (n < 1e4 ? strip(n / 1e3) : Math.round(n / 1e3)) + "K";
    return String(Math.round(n));
  }
  function strip(x) {
    return String(Math.round(x * 10) / 10);
  }

  function numHTML(v) {
    if (v == null) v = 0;
    return `<span title="${NF.format(v)}">${abbr(Math.abs(v))}</span>`;
  }

  // Signed, color-coded delta (used for Q2 subscriber growth & Q2 views).
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

  // Columns whose null values always sort to the bottom regardless of direction.
  const NULLS_LAST = new Set(["q2Growth", "q2Views"]);

  function compare(a, b) {
    const k = state.sortKey;
    if (NULLS_LAST.has(k)) {
      const an = a[k] == null;
      const bn = b[k] == null;
      if (an && bn) return 0;
      if (an) return 1;
      if (bn) return -1;
      return (a[k] - b[k]) * state.sortDir;
    }
    let va = a[k];
    let vb = b[k];
    if (k === "lean") {
      const ra = LEAN_ORDER[a.lean] ?? 99;
      const rb = LEAN_ORDER[b.lean] ?? 99;
      return (ra - rb) * state.sortDir;
    }
    if (k === "channel") {
      va = String(va || "").toLowerCase();
      vb = String(vb || "").toLowerCase();
      return va < vb ? -state.sortDir : va > vb ? state.sortDir : 0;
    }
    va = Number(va) || 0;
    vb = Number(vb) || 0;
    return (va - vb) * state.sortDir;
  }

  function render() {
    const list = state.rows
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
          <td class="num" data-label="Q2 Sub Growth">${deltaHTML(p.q2Growth)}</td>
          <td class="num" data-label="Q2 Views">${deltaHTML(p.q2Views)}</td>
          <td data-label="URL">${urlHTML(p)}</td>
        </tr>`
      )
      .join("");

    els.empty.hidden = list.length > 0;

    const when = state.doc && state.doc.generatedAt
      ? `updated ${new Date(state.doc.generatedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}`
      : "";
    els.meta.textContent = `${list.length} channels${when ? " · " + when : ""}`;
    postHeight();
  }

  // Report our document height to a parent frame (for auto-resizing embeds).
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
      if (th.dataset.key === state.sortKey) {
        th.setAttribute("aria-sort", state.sortDir === 1 ? "ascending" : "descending");
      } else {
        th.removeAttribute("aria-sort");
      }
    });
  }

  function setSort(key) {
    if (state.sortKey === key) {
      state.sortDir *= -1;
    } else {
      state.sortKey = key;
      // Text columns default A→Z; numeric default high→low.
      state.sortDir = key === "channel" || key === "lean" ? 1 : -1;
    }
    updateHeaderIndicators();
    render();
  }

  async function getJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function load() {
    let doc;
    try {
      doc = await getJSON(DATA_URL);
    } catch (err) {
      els.banner.hidden = false;
      els.banner.innerHTML = `Could not load <code>${DATA_URL}</code> (${escapeHTML(err.message)}). Run <code>npm run build</code>.`;
      return;
    }
    state.doc = doc;

    state.leans = {};
    try {
      const leanDoc = await getJSON(LEAN_URL);
      for (const [name, val] of Object.entries(leanDoc.leans || {})) state.leans[nameKey(name)] = val;
    } catch {
      /* no lean file -> everything shows as Unrated */
    }

    state.rows = (doc.channels || []).map((c) => ({
      ...c,
      lean: state.leans[nameKey(c.channel)] || "unrated",
    }));
    render();
  }

  function init() {
    els.headers.forEach((th) => th.addEventListener("click", () => setSort(th.dataset.key)));
    els.search.addEventListener("input", (e) => {
      state.filter = e.target.value.trim().toLowerCase();
      render();
    });
    updateHeaderIndicators();
    load();

    // When embedded, keep the parent frame sized to our content.
    if (window.parent && window.parent !== window) {
      window.addEventListener("load", postHeight);
      window.addEventListener("resize", postHeight);
      if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.body);
      setTimeout(postHeight, 600); // after fonts/chart settle
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
