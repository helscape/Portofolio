/**
 * Local dev server. Mirrors how Vercel serves the site: files from disk,
 * directory index resolution, and 404.html for unknown paths.
 *
 * Run: bun run server.ts  (or: bun --watch server.ts)
 */

const ROOT = import.meta.dir;

/** Map a URL path to a file on disk, or null if nothing matches. */
async function resolve(pathname: string): Promise<string | null> {
  // strip query/hash and decode, then normalize the leading slash
  const clean = decodeURIComponent(pathname.split(/[?#]/)[0]).replace(/^\/+/, "");

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

Bun.serve({
  port: 3000,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const hit = await resolve(pathname);

    if (hit) {
      return new Response(Bun.file(`${ROOT}/${hit}`));
    }

    // fallback: 404.html if present, otherwise a bare response
    const fallback = Bun.file(`${ROOT}/404.html`);
    return new Response(
      (await fallback.exists()) ? fallback : "Not Found",
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  },
});

console.log("→ http://localhost:3000");
