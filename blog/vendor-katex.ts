/**
 * Copy the KaTeX stylesheet and the woff2 fonts it references out of
 * node_modules and into assets/katex/, so the built site is self-contained
 * — no CDN, no runtime JavaScript. Re-run this after bumping `katex`.
 *
 * Only woff2 is copied: every browser we care about supports it, and the
 * .woff/.ttf fallbacks would roughly triple the footprint.
 *
 * Usage: bun run vendor
 */

import { mkdir, rm } from "node:fs/promises";

const ROOT = import.meta.dir; // .../blog
const SRC = `${ROOT}/../node_modules/katex/dist`;
const DEST = `${ROOT}/../assets/katex`;

const css = Bun.file(`${SRC}/katex.min.css`);
if (!(await css.exists())) {
  console.error("katex is not installed — run `bun install` first");
  process.exit(1);
}

await rm(DEST, { recursive: true, force: true });
await mkdir(`${DEST}/fonts`, { recursive: true });
await Bun.write(`${DEST}/katex.min.css`, css);

let fonts = 0;
for await (const name of new Bun.Glob("*.woff2").scan(`${SRC}/fonts`)) {
  await Bun.write(`${DEST}/fonts/${name}`, Bun.file(`${SRC}/fonts/${name}`));
  fonts++;
}

console.log(`vendored katex.min.css + ${fonts} woff2 fonts into assets/katex/`);
