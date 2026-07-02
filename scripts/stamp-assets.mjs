#!/usr/bin/env node
/**
 * Cache-busting: stamp index.html's CSS/JS references with a short content hash
 * (e.g. styles.css?v=1a2b3c4d). Because the query string changes whenever the
 * file's bytes change, browsers and the GitHub Pages CDN fetch the new version
 * immediately instead of serving a cached copy. Re-run after editing any asset:
 *   npm run build   (runs this automatically)
 */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = ["styles.css", "app.js", "chart.js"];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let html = await readFile(resolve(ROOT, "index.html"), "utf8");
const stamped = [];

for (const asset of ASSETS) {
  const bytes = await readFile(resolve(ROOT, asset));
  const hash = createHash("md5").update(bytes).digest("hex").slice(0, 8);
  // Match  href="asset"  or  src="asset"  with or without an existing ?v=… suffix.
  const re = new RegExp(`((?:href|src)=")${escapeRe(asset)}(?:\\?v=[a-f0-9]+)?(")`, "g");
  if (!re.test(html)) continue;
  re.lastIndex = 0;
  html = html.replace(re, `$1${asset}?v=${hash}$2`);
  stamped.push(`${asset}?v=${hash}`);
}

await writeFile(resolve(ROOT, "index.html"), html);
console.log(`Stamped ${stamped.length} assets: ${stamped.join(", ")}`);
