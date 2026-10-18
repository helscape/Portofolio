/**
 * Static host and local dev server. Mirrors how Vercel serves the site:
 * files from disk, directory index resolution, and 404.html for unknown
 * paths.
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

const port = Number(process.env.PORT) || 3000;

Bun.serve({
  port,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const hit = await resolve(pathname);

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
