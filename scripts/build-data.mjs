#!/usr/bin/env node
/**
 * Build the per-quarter channel data the front-end reads:
 *   scripts/source-q2.md -> data/channels-q2.json   (archived)
 *   scripts/source-q3.md -> data/channels-q3.json   (current)
 *
 * Each source is a pipe-delimited table:
 *   Channel | Total Subscribers | <Quarter> Subscriber Growth | <Quarter> Video Views
 * Numbers may use K / M / B suffixes (e.g. 7.3M, 510K, 3.4B); "--" -> 0; negatives allowed.
 *
 * Channel URLs come from data/handles.json; partisan lean is applied at render
 * time from data/lean.json. Channels in data/excluded.json are dropped from all
 * quarters, and only channels with >= 100,000 subscribers are included.
 *
 * Re-run after editing any source / handles / excluded file:
 *   npm run build
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIN_SUBS = 100000;

const QUARTERS = [
  { key: "q2", label: "Q2 2026", asOf: "Jul 1, 2026", source: "scripts/source-q2.md", out: "data/channels-q2.json" },
  { key: "q3", label: "Q3 2026", asOf: "Sep 25, 2026", source: "scripts/source-q3.md", out: "data/channels-q3.json" },
];

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

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
  const handleDoc = JSON.parse(await readFile(resolve(ROOT, "data/handles.json"), "utf8"));
  const handles = {};
  for (const [name, h] of Object.entries(handleDoc.handles || {})) handles[norm(name)] = h;

  let excluded = new Set();
  try {
    const exDoc = JSON.parse(await readFile(resolve(ROOT, "data/excluded.json"), "utf8"));
    excluded = new Set((exDoc.excluded || []).map(norm));
  } catch {
    /* no exclusion file -> exclude nothing */
  }

  for (const q of QUARTERS) {
    let md;
    try {
      md = await readFile(resolve(ROOT, q.source), "utf8");
    } catch {
      console.log(`(skip ${q.key}: ${q.source} not found)`);
      continue;
    }
    const rows = md
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.includes("|"))
      .map((l) => l.split("|").map((c) => c.trim()))
      .filter((cols) => cols.length >= 4 && cols[0] && norm(cols[0]) !== "channel");

    const channels = rows
      .map((cols) => {
        const channel = cols[0];
        const realUrl = handleToUrl(handles[norm(channel)]);
        return {
          channel,
          subscribers: parseNum(cols[1]),
          growth: parseNum(cols[2]) ?? 0,
          views: parseNum(cols[3]) ?? 0,
          url: realUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(channel)}`,
          hasRealUrl: !!realUrl,
        };
      })
      .filter((c) => c.subscribers >= MIN_SUBS && !excluded.has(norm(c.channel)));

    const withRealUrl = channels.filter((c) => c.hasRealUrl).length;
    const out = {
      title: "The Biggest Political YouTube Channels",
      quarter: q.label,
      asOf: q.asOf,
      generatedAt: new Date().toISOString(),
      count: channels.length,
      channels,
    };
    await writeFile(resolve(ROOT, q.out), JSON.stringify(out, null, 2) + "\n");
    console.log(`${q.out} — ${channels.length} channels (${withRealUrl} curated URLs, ${channels.length - withRealUrl} search fallback).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
