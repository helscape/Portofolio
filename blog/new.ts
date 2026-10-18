/**
 * Scaffold a new post. Creates blog/posts/<slug>.md with front matter and
 * today's date filled in, so you can go straight to writing.
 *
 * Usage: bun run new "Title of the post"
 */

import { mkdir } from "node:fs/promises";

const ROOT = import.meta.dir;
const POSTS = `${ROOT}/posts`;

const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('usage: bun run new "Title of the post"');
  process.exit(1);
}

const slug =
  title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "post";

const path = `${POSTS}/${slug}.md`;
if (await Bun.file(path).exists()) {
  console.error(`refusing to overwrite existing blog/posts/${slug}.md`);
  process.exit(1);
}

await mkdir(POSTS, { recursive: true });
await Bun.write(
  path,
  `---
title: ${title}
date: ${new Date().toISOString().slice(0, 10)}
description:
---

Start writing here.
`,
);

console.log(`created blog/posts/${slug}.md`);
