# helscape

Personal site for Fabian Aprilliano — plain static HTML/CSS/JS, no
framework, served by Bun.

## Running

```sh
bun install      # installs katex (build-time dep) into node_modules
bun dev          # build the blog, then serve with watch: http://localhost:3000
bun start        # build the blog, then serve once (PORT overrides 3000)
bun run build    # regenerate the blog only
bun run vendor   # re-copy KaTeX css + fonts into assets/katex/ (after upgrades)
```

`bun dev` watches `server.ts`; rebuild the blog after editing posts with
`bun run build` (or just restart `bun dev`).

## Writing

Posts are Markdown with optional front matter. Write in `blog/posts/`,
then build:

```sh
bun run new "Title of the post"    # scaffold blog/posts/title-of-the-post.md
# ...write...
bun run build                      # regenerate blog/index.html and each post
```

Front matter:

```yaml
---
title: Title of the post      # defaults to the filename
date: 2026-10-01              # defaults to the file's mtime
description: One-line summary # shown on the index and in <meta>
slug: custom-url              # defaults to the filename
draft: true                   # skip this post entirely
---
```

### Math

Equations are rendered to static HTML at build time with
[KaTeX](https://katex.org) — no runtime JavaScript. Use `$…$` (or `\(…\)`)
inline and `$$…$$` (or `\[…\]`) for display:

```markdown
Inline $O(n \log n)$, then a display equation:

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$
```

The KaTeX stylesheet is linked only on posts that actually use math. Its
CSS and woff2 fonts are vendored into `assets/katex/`; refresh them with
`bun run vendor` after bumping the `katex` dependency.

### Images

Put images in a directory named after the post, next to it:

```
blog/posts/
  hello-world.md
  hello-world/
    diagram.svg
```

They are copied into the post's output directory, so `![](./diagram.svg)`
resolves to `/blog/hello-world/diagram.svg`. An image that sits alone in a
paragraph and carries a title becomes a captioned `<figure>`:

```markdown
![alt text](./diagram.svg "The caption shown under the image.")
```

## Comments

Blog posts end with a threaded comment form. Posts are static files, so the
form talks to the comments API in `server.ts`, which stores everything in
MySQL/MariaDB:

| method | path | who | what |
| ------ | ---- | --- | ---- |
| `GET` | `/api/comments?slug=<slug>` | anyone | approved comments, flat (thread via `parentId`) |
| `POST` | `/api/comments` | anyone | add a comment (`slug`, `author`, `body`, optional `parentId`) |
| `PATCH` | `/api/comments/<id>` | admin | `{approved: bool}` — hide or unhide |
| `DELETE` | `/api/comments/<id>` | admin | delete a comment and its replies |

Copy `.env.example` to `.env` and start a database (a `docker compose` stack
with MariaDB works). The table is created — and upgraded — automatically on
start. Comments turn on when the database is reachable; otherwise
`/api/comments` answers 503 and the section hides itself, leaving a plain
static site.

Public visitors only ever see approved comments. Admin requests carry the
`ADMIN_TOKEN` value as an `x-admin-token` header (or `Authorization:
Bearer`). The moderation UI lives at `/admin/`: paste the token, load by slug
(blank for all), then hide, unhide or delete.

Deploying needs a process that can reach your database. Behind a reverse
proxy, set `TRUST_PROXY=1` so the client IP comes from `X-Forwarded-For` for
rate limiting; otherwise the socket address is used, and the header is
ignored. A static-only host cannot serve `/api/comments`.

## Layout

```
index.html              home page (hand-written)
404.html                not-found page (hand-written)
server.ts               static server + comments API (Bun)
.env.example            comments DB + admin token (copy to .env; ignored)
assets/main.css         all styles, light + dark themes
assets/theme.js         theme toggle
assets/comments.js      threaded comment form
assets/admin.js         comment moderation
assets/katex/           vendored KaTeX css + woff2 fonts (bun run vendor)
admin/index.html        comment moderation page
blog/
  posts/*.md            ← the sources you edit
  posts/<name>/         ← images for a post, copied next to its page
  templates/*.html      ← page shells ({{placeholders}})
  build.ts              generator: Markdown → static pages
  new.ts                post scaffolder
  vendor-katex.ts       refresh assets/katex/ from node_modules
  index.html            GENERATED
  <slug>/index.html     GENERATED
```

Files marked GENERATED are overwritten on every build — edit the templates
or the Markdown instead. Deleting a post's `.md` removes its page on the
next build.
