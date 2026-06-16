# Political YouTube Leaderboard — Chaotic Era

A sortable, filterable leaderboard of the **biggest political YouTube channels**,
branded for [Chaotic Era](https://chaoticera.news) (Kyle Tharp's newsletter on
politics, media, and online influence).

It mirrors the design of the Chaotic Era **Substack Politics Leaderboard**: a
packed-bubble "map" (sized by subscribers, coloured by partisan lean) above a
sortable table.

For each channel the table shows: **Channel**, **Partisan Lean**,
**Subscribers**, **90-Day Subscriber Growth**, **Total Views**, **90-Day Views**,
and a **channel URL**. Click any column header to sort; use the search box to
filter by channel or lean.

## Project layout

```
index.html / styles.css / app.js   # static, sortable front-end (no build step)
chart.js                            # D3 packed-bubble chart
scripts/source.md                   # the raw channel data (pipe-delimited, editable)
scripts/build-data.mjs              # source.md + handles.json -> data/channels.json
scripts/serve.mjs                   # tiny local preview server
data/channels.json                  # generated channel data (do not edit by hand)
data/lean.json                      # curated partisan-lean classifications (editable)
data/handles.json                   # curated real channel URLs (editable)
```

The front-end is plain static HTML/CSS/JS — it just reads the JSON files, so it
can be hosted anywhere (GitHub Pages, Netlify, Vercel, …).

## Updating the data

1. Edit `scripts/source.md` (one channel per line, pipe-delimited). Numbers may
   use `K` / `M` / `B` suffixes; use `--` for unavailable values.
2. Rebuild the JSON the front-end reads:

   ```bash
   npm run build      # writes data/channels.json
   ```

3. Preview locally:

   ```bash
   npm run serve      # → http://localhost:8000
   ```

## Curating partisan lean

`data/lean.json` maps a channel name → `"left"` | `"right"` | `"neutral"`.
Anything not listed shows as **Unrated**. The current file is a **first pass** —
edit it freely; it is never overwritten by `npm run build`.

## Channel URLs

`data/handles.json` maps a channel name → a YouTube handle (e.g. `"@MeidasTouch"`)
or a full URL. Channels listed there link **directly** to the channel; everything
else falls back to a YouTube **search** link that resolves to the channel. To
upgrade a search link, add the exact handle to `data/handles.json` and re-run
`npm run build`.

## Branding

All brand tokens (colours, fonts) live at the top of `styles.css` under `:root`,
matching the Chaotic Era Substack leaderboard. Append `?embed=1` to the URL to
hide the masthead/footer for embedding in an iframe.

## Hosting on GitHub Pages

This is a static site:

1. **Settings → Pages**.
2. **Build and deployment → Source** → **Deploy from a branch**.
3. Pick the branch and `/ (root)`, then **Save**.
