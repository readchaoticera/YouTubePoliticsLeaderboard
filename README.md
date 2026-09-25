# Political YouTube Leaderboard — Chaotic Era

A sortable, filterable leaderboard of the **biggest political YouTube channels**,
branded for [Chaotic Era](https://chaoticera.news) (Kyle Tharp's newsletter on
politics, media, and online influence).

It mirrors the design of the Chaotic Era **Substack Politics Leaderboard**, with
three lean-colored, interactive charts above a sortable table:

1. **Total Subscribers** — packed-bubble "map", every channel sized by subscribers.
2. **Q2 Subscriber Growth** — horizontal row chart, top 25 by net subs gained in Q2.
3. **Q2 Video Views** — horizontal row chart, top 25 by Q2 views.

For each channel the table shows: **Channel**, **Partisan Lean**, **Total
Subscribers**, **Q2 Sub Growth**, **Q2 Views**, and a **channel URL**. Click any
column header to sort; use the search box to filter by channel or lean.

## Project layout

```
index.html / styles.css / app.js   # static, sortable front-end (no build step)
chart.js                            # the three charts (D3 bubble + HTML row charts), current quarter
scripts/source-q3.md                # raw Q3 2026 channel data (pipe-delimited, editable) — current
scripts/source-q2.md                # raw Q2 2026 channel data (archived)
scripts/build-data.mjs              # sources + handles + excluded -> data/channels-q{2,3}.json
scripts/serve.mjs                   # tiny local preview server
data/channels-q3.json               # generated Q3 data (do not edit by hand) — charts + default table
data/channels-q2.json               # generated Q2 data (archived, shown via the table's Q2 tab)
data/lean.json                      # curated partisan-lean classifications (editable, shared)
data/handles.json                   # curated real channel URLs (editable, shared)
data/excluded.json                  # channels removed from all quarters (editable)
```

The front-end is plain static HTML/CSS/JS — it reads the JSON files, so it can be
hosted anywhere (GitHub Pages, Netlify, Vercel, …). The **charts** always show the
current quarter (Q3 2026); the **table** has a Q3/Q2 tab switcher.

## Updating the data

1. Edit the quarter's source file (one channel per line, pipe-delimited:
   `Channel | Total Subscribers | <Quarter> Subscriber Growth | <Quarter> Video Views`) —
   `scripts/source-q3.md` for the current quarter. Numbers may use `K` / `M` / `B`
   suffixes and may be negative; use `--` for unavailable values (rendered as 0).
   Only channels with ≥ 100,000 subscribers are included; channels listed in
   `data/excluded.json` are dropped from every quarter.
2. Rebuild the JSON the front-end reads:

   ```bash
   npm run build      # writes data/channels-q2.json and data/channels-q3.json
   ```

3. Preview locally:

   ```bash
   npm run serve      # → http://localhost:8000
   ```

### Adding a new quarter

Add a `scripts/source-<q>.md` file, then add a matching entry to the `QUARTERS`
array in `scripts/build-data.mjs` and the `QUARTERS` map in `app.js` (plus a tab
button in `index.html`). Point `chart.js` at the new quarter's JSON to advance the
charts.

## Curating partisan lean

`data/lean.json` maps a channel name → `"left"` | `"left-adjacent"` |
`"right-adjacent"` | `"right"`. Anything not listed shows as **Unrated**. The
current file is a **first pass** — edit it freely; it is never overwritten by
`npm run build`. (Matching normalizes case, curly quotes, en/em dashes and
whitespace, so straight apostrophes/hyphens in your edits still match.)

## Channel URLs

`data/handles.json` maps a channel name → a YouTube handle (e.g. `"@MeidasTouch"`)
or a full URL. Channels listed there link **directly** to the channel; everything
else falls back to a YouTube **search** link that resolves to the channel. To
upgrade a search link, add the exact handle to `data/handles.json` and re-run
`npm run build`.

## Branding

All brand tokens (colors, fonts) live at the top of `styles.css` under `:root`,
matching the Chaotic Era Substack leaderboard. Append `?embed=1` to the URL to
hide the masthead/footer for embedding in an iframe.

## Hosting on GitHub Pages

This is a static site:

1. **Settings → Pages**.
2. **Build and deployment → Source** → **Deploy from a branch**.
3. Pick the branch and `/ (root)`, then **Save**.
