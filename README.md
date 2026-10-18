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
bun run build                      # regenerate the index, posts, feed, sitemap
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

Deploying needs a process that can reach your database. Behind a reverse
proxy, set `TRUST_PROXY=1` so the client IP comes from `X-Forwarded-For` for
rate limiting; otherwise the socket address is used, and the header is
ignored. A static-only host cannot serve `/api/comments`.

### Moderating

There is no account and no login. Moderation is gated by one shared secret,
`ADMIN_TOKEN`, sent as a request header. Whoever holds it can hide, unhide
and delete comments; without it the API answers 401 and hidden comments stay
hidden. The `/admin/` page itself is public — it is only a form, and the
token is the sole thing that grants anything.

Generate one and store it in `.env` (which is gitignored; `.env.example`
ships a placeholder):

```sh
printf 'ADMIN_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env
bun dev   # restart so the server picks it up
```

Use at least 32 random bytes. A memorable passphrase is not enough: the
token is checked on every request and is not rate limited per guess.

Then moderate in the browser at **http://localhost:3000/admin/**:

1. Paste the token into **Admin token**. It is kept in that browser's
   `localStorage`, so you only paste it once per browser.
2. Type a post slug, or leave it **blank to load every post**.
3. Press **Load**, then **Hide** / **Unhide** / **Delete** any comment.
   Deleting a comment also deletes its replies.

The same thing from a shell:

```sh
TOKEN=$(grep '^ADMIN_TOKEN=' .env | cut -d= -f2)

# every comment on a post, including hidden ones
curl -s "localhost:3000/api/comments?slug=hello-world" -H "x-admin-token: $TOKEN"

# hide comment 4 …
curl -s -X PATCH localhost:3000/api/comments/4 \
  -H "x-admin-token: $TOKEN" -H 'content-type: application/json' \
  -d '{"approved":false}'

# … then delete it and its replies
curl -s -X DELETE localhost:3000/api/comments/4 -H "x-admin-token: $TOKEN"
```

`Authorization: Bearer <token>` works anywhere `x-admin-token` does. To
rotate the secret, change `ADMIN_TOKEN` and restart; the old value stops
working at once.

## Deployment

`main` deploys to Vercel as a static site at
**https://helscape-portofolio.vercel.app**, and every branch (including
`dev`) gets a preview build. Nothing on Vercel runs `server.ts`, so:

- **compression and ETag/304 are Vercel's job.** They are deliberately not
  implemented in the Bun server, since only local development would benefit.
- the comments API is **not available there** — `/api/comments` answers 503
  and the section hides itself, leaving a plain static site.
- caching and security headers come from `vercel.json`.

`server.ts` reads `vercel.json` at start and applies the same security
headers, so local and deployed responses can't drift. Two are dropped
locally on purpose: `Cache-Control` (a long cache would hide your edits) and
`Strict-Transport-Security` (it would pin `http://localhost` to https in
your browser).

The CSP allows `'unsafe-inline'` for scripts and styles deliberately: the
theme is set by a tiny inline script that has to run before paint to avoid a
flash, and KaTeX emits inline styles. Nothing third-party executes — the
only external origin allowed anywhere is the OpenStreetMap iframe.

### Absolute URLs

`sitemap.xml`, `blog/feed.xml`, `canonical` and `og:url` all need a full
origin, resolved in this order:

1. `SITE_URL` — set this when you move to a custom domain
2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel provides it, so a preview build
   still advertises the production URL
3. the committed default in `blog/site.ts`

On a custom domain, set `SITE_URL` (in Vercel and locally) and update the
hardcoded `canonical`/`og:url` in the hand-written `index.html`.

### Generated for discovery

`bun run build` also writes these, deterministically — nothing is stamped
with the build time, so an unedited site rebuilds byte-identical:

| file | |
| ---- | ---- |
| `sitemap.xml` | the home page, the blog index, and every post |
| `robots.txt` | crawl rules; `/admin/` is disallowed |
| `blog/feed.xml` | RSS 2.0 feed, advertised on every page |

## Layout

```
index.html              home page (hand-written)
404.html                not-found page (hand-written)
server.ts               static server + comments API (Bun)
vercel.json             deployed headers + trailing slash (read by server.ts)
.env.example            comments DB + admin token (copy to .env; ignored)
assets/main.css         all styles, light + dark themes
assets/theme.js         theme toggle
assets/comments.js      threaded comment form
assets/admin.js         comment moderation
assets/katex/           vendored KaTeX css + woff2 fonts (bun run vendor)
admin/index.html        comment moderation page
sitemap.xml             GENERATED
robots.txt              GENERATED
blog/
  posts/*.md            ← the sources you edit
  posts/<name>/         ← images for a post, copied next to its page
  templates/*.html      ← page shells ({{placeholders}})
  build.ts              generator: Markdown → static pages
  site.ts               origin + the sitemap/robots/feed writers
  new.ts                post scaffolder
  vendor-katex.ts       refresh assets/katex/ from node_modules
  index.html            GENERATED
  feed.xml              GENERATED
  <slug>/index.html     GENERATED
```

Files marked GENERATED are overwritten on every build — edit the templates
or the Markdown instead. Deleting a post's `.md` removes its page on the
next build.
