// fills the Content-Security-Policy's inline-script hashes into the assembled site's _worker.js
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// run by deploy-web.yml after the site is assembled, as: node deploy/cloudflare/pages/csp-hashes.mjs deploy_out
const root = process.argv[2];
if (!root) throw new Error("usage: node csp-hashes.mjs <site dir>");

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(entryPath);
    if (entry.name.endsWith(".html")) return [entryPath];
    return [];
  });
}

// every inline <script> in the built HTML is allowed by its SHA-256 hash, so changing one needs no edit here
const hashes = new Set();
for (const file of htmlFiles(root)) {
  for (const [, attrs, body] of readFileSync(file, "utf8").matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc\s*=/.test(attrs) || !body.trim()) continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
}

const worker = join(root, "_worker.js");
const source = readFileSync(worker, "utf8");
if (!source.includes('"__INLINE_SCRIPT_HASHES__"')) throw new Error("csp-hashes: no placeholder in _worker.js");
writeFileSync(worker, source.replace('"__INLINE_SCRIPT_HASHES__"', JSON.stringify([...hashes].join(" "))));
console.log(`csp-hashes: ${hashes.size} inline script hash(es)`);
