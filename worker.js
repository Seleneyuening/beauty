const REPO_RAW = "https://raw.githubusercontent.com/Seleneyuening/beauty/main/";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);
    if (!path) return new Response("Bad request", { status: 400 });

    const upstream = await fetch(REPO_RAW + path, {
      cf: { cacheEverything: true, cacheTtl: path === "index.html" ? 60 : 86400 }
    });

    if (!upstream.ok) {
      return new Response(path === "index.html" ? "Site unavailable" : "Not found", {
        status: path === "index.html" ? 502 : 404
      });
    }

    const headers = new Headers(upstream.headers);
    headers.set("content-type", contentType(path));
    headers.set("cache-control", path === "index.html" ? "public, max-age=60" : "public, max-age=86400");
    headers.set("x-hosted-by", "cloudflare-worker");
    headers.delete("content-security-policy");
    headers.delete("x-frame-options");

    return new Response(upstream.body, { status: upstream.status, headers });
  }
};

function normalizePath(pathname) {
  const path = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
  if (path.includes("..") || path.startsWith(".")) return "";
  return path.endsWith("/") ? `${path}index.html` : path;
}

function contentType(path) {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  return TYPES[ext] || "application/octet-stream";
}
