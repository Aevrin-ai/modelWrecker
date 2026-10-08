// Writes the prerendered home page into dist/index.html, after `vite build` (the browser build) and
// `vite build --ssr src/entry-prerender.tsx` (the render function). Run by `npm run build`.
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const SSR_DIR = new URL("../node_modules/.prerender/", import.meta.url);
const INDEX = new URL("../dist/index.html", import.meta.url);

const { render } = await import(new URL("entry-prerender.js", SSR_DIR).href);
const html = render("/");
if (!html.includes('id="hero-heading"')) throw new Error("prerender: the hero is missing from the rendered HTML");

const page = readFileSync(INDEX, "utf8");
const marker = '<div id="root"></div>';
if (!page.includes(marker)) throw new Error("prerender: dist/index.html has no empty root to fill");
writeFileSync(INDEX, page.replace(marker, `<div id="root">${html}</div>`));
rmSync(SSR_DIR, { recursive: true, force: true });
console.log(`prerendered / (${(html.length / 1024).toFixed(1)} kB of HTML)`);
