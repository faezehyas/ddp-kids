// The service worker's list: every file under public/ and nothing else, and a
// VERSION that changes whenever one of them does.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const PUBLIC = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));

// VERSION and FILES as sw.js declares them, without running it in a browser.
const worker = vm.runInNewContext(`${fs.readFileSync(path.join(PUBLIC, "sw.js"), "utf8")}\n({ VERSION, FILES })`, { self: { addEventListener() {} } });

// What the site serves: every file but sw.js and the tests, a folder's
// index.html as the folder.
const served = fs.readdirSync(PUBLIC, { recursive: true })
  .map((file) => file.split(path.sep).join("/"))
  .filter((file) => fs.statSync(path.join(PUBLIC, file)).isFile() && file !== "sw.js" && !file.endsWith(".test.js") && !path.basename(file).startsWith("."))
  .sort();
const url = (file) => `/${file.replace(/(^|\/)index\.html$/, "$1")}`;

test("the cache list has every file under public/ and nothing else", () => {
  assert.deepEqual([...worker.FILES].sort(), served.map(url).sort());
});

test("VERSION changes whenever a cached file does", () => {
  const hash = crypto.createHash("sha256");
  for (const file of served) hash.update(`${file}\0`).update(fs.readFileSync(path.join(PUBLIC, file)));
  const version = hash.digest("hex").slice(0, 12);
  assert.equal(worker.VERSION, version, `set VERSION in public/sw.js to "${version}"`);
});

test("the manifest's colours are the paper", () => {
  const paper = fs.readFileSync(path.join(PUBLIC, "engine/theme.css"), "utf8").match(/--paper:\s*(#\w+);/)[1];
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.background_color, paper);
  assert.equal(manifest.theme_color, paper);
});
