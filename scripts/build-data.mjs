#!/usr/bin/env node
/**
 * Build data/channels.json from scripts/source.md (a pipe-delimited table of
 * YouTube channel stats) merged with real channel URLs from data/handles.json.
 *
 * Re-run after editing scripts/source.md or data/handles.json:
 *   npm run build      (or: node scripts/build-data.mjs)
 *
 * Numbers may use K / M / B suffixes (e.g. 7.3M, 510K, 3.4B). "--" means the
 * value is unavailable (rendered as N/A). Negative values are allowed.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

function parseNum(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "--" || s === "—" || s === "n/a") return null;
  const m = s.replace(/,/g, "").match(/^(-?)([\d.]+)\s*([KMB]?)$/i);
  if (!m) return null;
  let n = parseFloat(m[2]);
  const suffix = m[3].toUpperCase();
  if (suffix === "K") n *= 1e3;
  else if (suffix === "M") n *= 1e6;
  else if (suffix === "B") n *= 1e9;
  return Math.round(n) * (m[1] === "-" ? -1 : 1);
}

function handleToUrl(h) {
  if (!h) return null;
  if (h.startsWith("http")) return h;
  if (h.startsWith("@")) return `https://www.youtube.com/${h}`;
  return `https://www.youtube.com/@${h}`;
}

async function main() {
  const md = await readFile(resolve(ROOT, "scripts/source.md"), "utf8");
  const handleDoc = JSON.parse(await readFile(resolve(ROOT, "data/handles.json"), "utf8"));
  const handles = {};
  for (const [name, h] of Object.entries(handleDoc.handles || {})) handles[norm(name)] = h;

  const rows = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.includes("|"))
    .map((l) => l.split("|").map((c) => c.trim()))
    .filter((cols) => cols.length >= 7 && cols[0] && norm(cols[0]) !== "channel");

  let withRealUrl = 0;
  const channels = rows.map((cols) => {
    const channel = cols[0];
    const realUrl = handleToUrl(handles[norm(channel)]);
    if (realUrl) withRealUrl++;
    return {
      channel,
      subscribers: parseNum(cols[1]),
      growth30: parseNum(cols[2]),
      growth90: parseNum(cols[3]),
      views: parseNum(cols[4]),
      views30: parseNum(cols[5]),
      views90: parseNum(cols[6]),
      url: realUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(channel)}`,
      hasRealUrl: !!realUrl,
    };
  });

  const out = {
    title: "The Biggest Political YouTube Channels",
    source: "live",
    generatedAt: new Date().toISOString(),
    count: channels.length,
    notes: {
      growth90: "Subscribers added over the trailing 90 days.",
      views90: "Video views added over the trailing 90 days.",
      url: "Real channel URL where known (data/handles.json); otherwise a YouTube search link that resolves to the channel.",
    },
    channels,
  };

  await writeFile(resolve(ROOT, "data/channels.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(
    `Wrote data/channels.json — ${channels.length} channels (${withRealUrl} with curated URLs, ${
      channels.length - withRealUrl
    } via search fallback).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
