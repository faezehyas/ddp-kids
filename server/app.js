// One HTTP server that only serves files:
//   /            the home page (public/index.html)
//   /<folder>/   a folder's index.html; /<folder> redirects there
//   /healthz     JSON status for Wasmer's health check
// Only node:http, node:fs and node:path, which Wasmer's Edge.js runs.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.resolve(decodeURIComponent(new URL("../public", import.meta.url).pathname));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".png": "image/png",
};

// On every response, including redirects and errors.
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// Letters, digits, dot, dash, underscore, tilde and slash, once decoded.
const PLAIN_PATH = /^[\w.~/-]*$/;

export function createApp({ publicDir = PUBLIC_DIR } = {}) {
  function reply(req, res, status, headers, body) {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(req.method === "HEAD" ? undefined : body);
  }

  const notFound = (req, res) => reply(req, res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found");

  function send(req, res, file, data) {
    const ext = path.extname(file);
    reply(req, res, 200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": data.length,
      // The service worker too, so a deploy reaches it at once.
      "Cache-Control": ext === ".html" || path.basename(file) === "sw.js" ? "no-cache" : "max-age=300",
    }, data);
  }

  // Plain fs.readFile only, no fs.stat: it is on Edge.js's proven API list.
  function serveStatic(req, res, url) {
    let decoded;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      return notFound(req, res);
    }
    const segments = decoded.split("/").filter(Boolean);
    // No "..", no dotfiles, no tests.
    if (!PLAIN_PATH.test(decoded) || segments.some((s) => s.startsWith(".")) || decoded.endsWith(".test.js")) return notFound(req, res);
    const asFolder = decoded.endsWith("/");
    const file = path.join(publicDir, ...segments, asFolder ? "index.html" : "");
    fs.readFile(file, (err, data) => {
      if (!err) return send(req, res, file, data);
      if (asFolder) return notFound(req, res);
      // A folder: /chess -> /chess/ so the page's relative URLs resolve inside it.
      fs.readFile(path.join(file, "index.html"), (missing) => {
        if (missing) return notFound(req, res);
        reply(req, res, 301, { Location: `/${segments.join("/")}/${url.search}` });
      });
    });
  }

  return http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") return reply(req, res, 405, { Allow: "GET, HEAD" });
    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      return notFound(req, res);
    }
    if (url.pathname === "/healthz") {
      return reply(req, res, 200, { "Content-Type": "application/json", "Cache-Control": "no-store" }, JSON.stringify({ ok: true }));
    }
    serveStatic(req, res, url);
  });
}
