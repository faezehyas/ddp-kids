import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { startServer } from "./browser/helpers.js";

const HEADERS = {
  "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

// A request with the path sent as is: fetch() would resolve "..".
function raw(base, target, method = "GET") {
  return new Promise((resolve, reject) => {
    http.request(`${base}/`, { path: target, method }, (res) => {
      res.resume();
      res.on("end", () => resolve(res));
    }).on("error", reject).end();
  });
}

test("health check", async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const res = await fetch(`${srv.base}/healthz`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await res.json(), { ok: true });
});

test("security headers on every response", async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  for (const [target, method, status] of [["/", "GET", 200], ["/rook.svg", "GET", 200], ["/healthz", "GET", 200], ["/nope", "GET", 404], ["/", "POST", 405], ["/../package.json", "GET", 404]]) {
    const res = await raw(srv.base, target, method);
    assert.equal(res.statusCode, status, `${method} ${target}`);
    for (const [name, value] of Object.entries(HEADERS)) assert.equal(res.headers[name], value, `${name} on ${method} ${target}`);
  }
});

test("home page and static files", async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const home = await fetch(`${srv.base}/`);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(home.headers.get("cache-control"), "no-cache");
  assert.match(await home.text(), /<title>ddp-kids<\/title>/);
  const css = await fetch(`${srv.base}/home.css`);
  assert.equal(css.headers.get("content-type"), "text/css; charset=utf-8");
  assert.match(css.headers.get("cache-control"), /max-age=\d+/);
});

test("the manifest and the service worker", async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  for (const [file, type, cache] of [["/manifest.webmanifest", "application/manifest+json", /max-age=\d+/], ["/sw.js", "text/javascript; charset=utf-8", /^no-cache$/]]) {
    const res = await fetch(srv.base + file);
    assert.equal(res.status, 200, file);
    assert.equal(res.headers.get("content-type"), type, file);
    assert.match(res.headers.get("cache-control"), cache, file);
    for (const [name, value] of Object.entries(HEADERS)) assert.equal(res.headers.get(name), value, `${name} on ${file}`);
  }
  const manifest = await (await fetch(`${srv.base}/manifest.webmanifest`)).json();
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) assert.equal((await fetch(srv.base + icon.src)).headers.get("content-type"), icon.type, icon.src);
});

test("content types, folders and redirects", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ddp-kids-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const types = {
    html: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    svg: "image/svg+xml",
    json: "application/json; charset=utf-8",
    webmanifest: "application/manifest+json",
    woff2: "font/woff2",
    png: "image/png",
  };
  fs.mkdirSync(path.join(dir, "chess"));
  fs.writeFileSync(path.join(dir, "chess", "index.html"), "chess");
  for (const ext of Object.keys(types)) fs.writeFileSync(path.join(dir, `file.${ext}`), ext);
  fs.writeFileSync(path.join(dir, "chess", "rules.test.js"), "test");
  const srv = await startServer({ publicDir: dir });
  t.after(() => srv.close());

  for (const [ext, type] of Object.entries(types)) {
    assert.equal((await fetch(`${srv.base}/file.${ext}`)).headers.get("content-type"), type, ext);
  }
  for (const [target, location] of [["/chess", "/chess/"], ["/chess?piece=R", "/chess/?piece=R"]]) {
    const res = await fetch(srv.base + target, { redirect: "manual" });
    assert.equal(res.status, 301, target);
    assert.equal(res.headers.get("location"), location, target);
  }
  assert.equal(await (await fetch(`${srv.base}/chess/`)).text(), "chess");
  assert.equal((await fetch(`${srv.base}/file.css/`)).status, 404, "a file is not a folder");
  assert.equal((await fetch(`${srv.base}/chess/rules.test.js`)).status, 404, "tests are not served");
});

test("GET and HEAD only", async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const head = await fetch(`${srv.base}/`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
    for (const target of ["/", "/healthz"]) {
      const res = await fetch(srv.base + target, { method });
      assert.equal(res.status, 405, `${method} ${target}`);
      assert.equal(res.headers.get("allow"), "GET, HEAD");
    }
  }
});

test("refused paths are 404s", async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  for (const target of [
    "/../package.json",
    "/../server/app.js",
    "/%2e%2e/package.json",
    "/%2e%2e%2fpackage.json",
    "/..%2fserver%2fapp.js",
    "/server/app.js",
    "/package.json",
    "/.git/config",
    "/rook.svg%00",
    "/a%5Cb",
    "/%E0%A4%A",
    "/missing.html",
    "/missing/",
  ]) {
    assert.equal((await raw(srv.base, target)).statusCode, 404, target);
  }
});
