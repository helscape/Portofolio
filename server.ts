/**
 * Static host, dev server, and comments API.
 *
 * The static side mirrors how Vercel serves the site: files from disk,
 * directory index resolution, and 404.html for unknown paths.
 *
 * Comments are backed by MySQL/MariaDB and turn on when the DB_* environment
 * variables are present (Bun loads .env automatically); without them the
 * server is a plain static host and /api/comments answers 503. Moderation
 * (hiding/approving/deleting) needs ADMIN_TOKEN.
 *
 * Run: bun run server.ts   (or: bun dev for watch mode, bun start for prod)
 */

const ROOT = import.meta.dir;

/** Content types for the asset kinds we ship. Anything not listed here
 *  falls back to Bun's own inference from the file extension. */
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

/** Map a URL path to a file on disk, or null if nothing matches. */
async function resolve(pathname: string): Promise<string | null> {
  // strip query/hash and decode, then normalize the leading slash
  let clean: string;
  try {
    clean = decodeURIComponent(pathname.split(/[?#]/)[0]).replace(/^\/+/, "");
  } catch {
    return null; // malformed percent-encoding
  }

  // block path traversal
  if (clean.split("/").some((seg) => seg === "..")) return null;

  const target = clean === "" ? "index.html" : clean;
  const candidates = target.endsWith("/")
    ? [target + "index.html"]
    : [target, target + "/index.html"];

  for (const rel of candidates) {
    const file = Bun.file(`${ROOT}/${rel}`);
    if (await file.exists()) return rel;
  }
  return null;
}

/** Serve a file from disk with the right content type. `no-cache` keeps
 *  edits to html/css/js visible on refresh without a hard reload. */
function fileResponse(rel: string, status = 200): Response {
  const file = Bun.file(`${ROOT}/${rel}`);
  const dot = rel.lastIndexOf(".");
  const ext = dot === -1 ? "" : rel.slice(dot).toLowerCase();
  const type = MIME[ext] || file.type || "application/octet-stream";
  return new Response(file, {
    status,
    headers: { "content-type": type, "cache-control": "no-cache" },
  });
}

/* ---------------------------------------------------------------------- *
 * Database
 * ---------------------------------------------------------------------- */

type Sql = InstanceType<typeof Bun.SQL>;

let sql: Sql | null = null;

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

/** Create the table, and add columns introduced after the first release so
 *  an existing database upgrades itself on start. */
async function ensureSchema(client: Sql): Promise<void> {
  await client`
    CREATE TABLE IF NOT EXISTS comments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(190) NOT NULL,
      parent_id BIGINT UNSIGNED NULL,
      author VARCHAR(80) NOT NULL,
      body TEXT NOT NULL,
      approved TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY slug_created (slug, created_at),
      KEY parent_id (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  const columns = await client`
    SELECT COLUMN_NAME AS name
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments'
  `;
  const have = new Set(columns.map((c) => String((c as { name: string }).name)));

  if (!have.has("parent_id")) {
    await client`ALTER TABLE comments ADD COLUMN parent_id BIGINT UNSIGNED NULL, ADD KEY parent_id (parent_id)`;
  }
  if (!have.has("approved")) {
    await client`ALTER TABLE comments ADD COLUMN approved TINYINT(1) NOT NULL DEFAULT 1`;
  }
}

if (process.env.DB_NAME) {
  const config = {
    adapter: "mysql" as const,
    hostname: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME,
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  };

  const client = new Bun.SQL(config);
  try {
    await ensureSchema(client);
    sql = client;
    console.log(`  comments: on (${config.hostname}:${config.port}/${config.database})`);
    console.log(`  moderation: ${ADMIN_TOKEN ? "on" : "off (set ADMIN_TOKEN)"}`);
  } catch (err) {
    console.warn(`  comments: off — ${(err as Error).message}`);
    await client.end().catch(() => {});
  }
}

/* ---------------------------------------------------------------------- *
 * Comments API
 * ---------------------------------------------------------------------- */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const MAX_AUTHOR = 80;
const MAX_BODY = 2000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
const PAGE_LIMIT = 1000;

interface Comment {
  id: number;
  parentId: number | null;
  author: string;
  body: string;
  approved: boolean;
  createdAt: unknown;
}

const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  if (hits.size > 5000) hits.clear();
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_MAX;
}

/** Length-safe constant-time-ish comparison for the admin token. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAdmin(req: Request): boolean {
  if (!ADMIN_TOKEN) return false;
  const given =
    req.headers.get("x-admin-token") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return safeEqual(given, ADMIN_TOKEN);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Behind a proxy, the client IP is the first entry of X-Forwarded-For. */
function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function toComment(row: Record<string, unknown>): Comment {
  return {
    id: Number(row.id),
    parentId: row.parent_id === null || row.parent_id === undefined ? null : Number(row.parent_id),
    author: String(row.author),
    body: String(row.body),
    approved: Number(row.approved) === 1,
    createdAt: row.created_at,
  };
}

async function listComments(url: URL, req: Request): Promise<Response> {
  if (!sql) return json({ error: "comments are unavailable" }, 503);

  const slug = url.searchParams.get("slug");
  const admin = isAdmin(req);

  if (slug === null && !admin) return json({ error: "a slug is required" }, 400);
  if (slug !== null && !SLUG_RE.test(slug)) return json({ error: "invalid slug" }, 400);

  // admins see hidden comments; everyone else sees only approved ones
  const rows = slug !== null
    ? admin
      ? await sql`SELECT id, parent_id, author, body, approved, created_at FROM comments WHERE slug = ${slug} ORDER BY created_at ASC, id ASC LIMIT ${PAGE_LIMIT}`
      : await sql`SELECT id, parent_id, author, body, approved, created_at FROM comments WHERE slug = ${slug} AND approved = 1 ORDER BY created_at ASC, id ASC LIMIT ${PAGE_LIMIT}`
    : await sql`SELECT id, parent_id, author, body, approved, created_at FROM comments ORDER BY created_at ASC, id ASC LIMIT ${PAGE_LIMIT}`;

  const comments = rows.map(toComment);

  // Admins see everything. For everyone else, a reply is only visible while
  // its parent is visible, so hiding a comment hides its whole branch instead
  // of promoting the replies to the top level. Parents always sort before
  // their children, so one pass is enough.
  if (!admin) {
    const visible = new Set<number>();
    const kept: Comment[] = [];
    for (const comment of comments) {
      if (comment.parentId === null || visible.has(comment.parentId)) {
        visible.add(comment.id);
        kept.push(comment);
      }
    }
    return json({ comments: kept });
  }

  return json({ comments });
}

async function createComment(req: Request, ip: string): Promise<Response> {
  if (!sql) return json({ error: "comments are unavailable" }, 503);
  if (rateLimited(ip)) return json({ error: "too many comments, slow down" }, 429);

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (!payload || typeof payload !== "object") return json({ error: "invalid body" }, 400);

  // honeypot: bots fill every field. Pretend success, store nothing.
  if (typeof payload.website === "string" && payload.website.trim() !== "") {
    return json({ ok: true });
  }

  const slug = String(payload.slug ?? "");
  const author = String(payload.author ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const parentRaw = payload.parentId;

  if (!SLUG_RE.test(slug)) return json({ error: "invalid slug" }, 400);
  if (author.length < 1 || author.length > MAX_AUTHOR) {
    return json({ error: `name must be 1–${MAX_AUTHOR} characters` }, 400);
  }
  if (body.length < 1 || body.length > MAX_BODY) {
    return json({ error: `comment must be 1–${MAX_BODY} characters` }, 400);
  }

  let parentId: number | null = null;
  if (parentRaw !== undefined && parentRaw !== null && String(parentRaw) !== "") {
    const candidate = Number(parentRaw);
    if (!Number.isSafeInteger(candidate) || candidate <= 0) {
      return json({ error: "invalid parent" }, 400);
    }
    const parent = await sql`SELECT id FROM comments WHERE id = ${candidate} AND slug = ${slug} LIMIT 1`;
    if (parent.length === 0) return json({ error: "invalid parent" }, 400);
    parentId = candidate;
  }

  await sql`INSERT INTO comments (slug, parent_id, author, body) VALUES (${slug}, ${parentId}, ${author}, ${body})`;
  return json({ ok: true }, 201);
}

async function updateComment(req: Request, id: number): Promise<Response> {
  if (!sql) return json({ error: "comments are unavailable" }, 503);
  if (!isAdmin(req)) return json({ error: "unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (typeof payload.approved !== "boolean") {
    return json({ error: "approved must be a boolean" }, 400);
  }

  const found = await sql`SELECT id FROM comments WHERE id = ${id} LIMIT 1`;
  if (found.length === 0) return json({ error: "not found" }, 404);

  await sql`UPDATE comments SET approved = ${payload.approved ? 1 : 0} WHERE id = ${id}`;
  return json({ ok: true });
}

async function deleteComment(req: Request, id: number): Promise<Response> {
  if (!sql) return json({ error: "comments are unavailable" }, 503);
  if (!isAdmin(req)) return json({ error: "unauthorized" }, 401);

  const found = await sql`SELECT id FROM comments WHERE id = ${id} LIMIT 1`;
  if (found.length === 0) return json({ error: "not found" }, 404);

  // no foreign key, so collect the subtree and remove it explicitly
  const doomed = [id];
  for (let i = 0; i < doomed.length; i++) {
    const children = await sql`SELECT id FROM comments WHERE parent_id = ${doomed[i]}`;
    for (const child of children) doomed.push(Number(child.id));
  }
  for (const victim of doomed) {
    await sql`DELETE FROM comments WHERE id = ${victim}`;
  }

  return json({ ok: true, removed: doomed.length });
}

/* ---------------------------------------------------------------------- *
 * Server
 * ---------------------------------------------------------------------- */

const port = Number(process.env.PORT) || 3000;

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/comments") {
      if (req.method === "GET") return listComments(url, req);
      if (req.method === "POST") return createComment(req, clientIp(req));
      return json({ error: "method not allowed" }, 405);
    }

    const single = /^\/api\/comments\/(\d+)$/.exec(url.pathname);
    if (single) {
      const id = Number(single[1]);
      if (req.method === "PATCH") return updateComment(req, id);
      if (req.method === "DELETE") return deleteComment(req, id);
      return json({ error: "method not allowed" }, 405);
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    const hit = await resolve(url.pathname);
    if (hit) return fileResponse(hit);

    // fallback: 404.html if present, otherwise a bare response
    if (await Bun.file(`${ROOT}/404.html`).exists()) {
      return fileResponse("404.html", 404);
    }
    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
});

console.log(`→ http://localhost:${port}`);
