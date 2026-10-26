// Offline: after one visit, the shelf and the playground open and play with
// the network off, and a deploy's new files take over on the next visit.
// Leaves screenshots of the shelf offline in test-artifacts/. Skips without
// Playwright.
//
//   node --test test/browser/offline.test.js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NAMES } from "../../public/chess/pieces.js";
import { ARTIFACTS, DEVICES, assertNoSideScroll, assertNoWords, loadPlaywright, openPage, skipWithoutPlaywright, startServer } from "./helpers.js";

const skip = skipWithoutPlaywright();

// Resolves once the service worker has stored every file.
const stored = (page) => page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

for (const device of Object.keys(DEVICES)) {
  test(`the shelf and the playground work offline after one visit on ${device}`, { skip }, async (t) => {
    const page = await openPage(t, "/", device, { serviceWorkers: "allow" });
    await page.locator(".box").waitFor();
    assert.ok(await stored(page));
    await page.context().setOffline(true);

    await page.reload();
    await page.locator('.box[data-game="chess"]').waitFor();
    assert.ok(await page.evaluate(() => navigator.serviceWorker.controller !== null), "the worker serves the page");
    await assertNoWords(page);
    await assertNoSideScroll(page);
    await page.screenshot({ path: path.join(ARTIFACTS, `offline-home-${device}.png`) });

    await page.tap(".box");
    await page.waitForURL("**/chess/");
    const dot = page.locator(".mark.dot").first();
    await dot.waitFor();
    const to = await dot.evaluate((el) => ({ c: el.dataset.c, r: el.dataset.r }));
    await page.tap(`.sq[data-c="${to.c}"][data-r="${to.r}"]`);
    await page.waitForFunction((to) => {
      const piece = document.querySelector(".piece");
      return piece.dataset.c === to.c && piece.dataset.r === to.r && !piece.classList.contains("moving");
    }, to);

    await page.goto(page.url().replace(/\/chess\/.*/, "/chess/?piece=B"));
    await page.locator(`.piece[aria-label="${NAMES.B}"]`).waitFor();
  });
}

test("a deploy's new files take over on the next visit", { skip }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ddp-kids-"));
  fs.cpSync("public", dir, { recursive: true });
  const srv = await startServer({ publicDir: dir });
  const browser = await loadPlaywright().chromium.launch();
  t.after(async () => {
    await browser.close();
    await srv.close();
    fs.rmSync(dir, { recursive: true });
  });
  const ctx = await browser.newContext();
  const css = (page) => page.evaluate(async () => (await fetch("/home.css")).text());
  let page = await ctx.newPage();
  await page.goto(`${srv.base}/`);
  await stored(page);
  await page.reload();
  const before = await css(page);

  // The deploy: one file changes, and VERSION with it.
  fs.appendFileSync(path.join(dir, "home.css"), "/* next */\n");
  const sw = path.join(dir, "sw.js");
  fs.writeFileSync(sw, fs.readFileSync(sw, "utf8").replace(/const VERSION = ".*";/, 'const VERSION = "next";'));

  // This visit finds the new worker, which stores the new files and waits.
  const next = ctx.waitForEvent("serviceworker");
  await page.reload();
  const worker = await next;
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration()).waiting !== null);
  assert.equal(await css(page), before, "the open page keeps the old files");
  await page.close();

  // With no page open, the new worker takes over and drops the old files.
  for (const until = Date.now() + 5000; (await worker.evaluate(() => caches.keys())).join() !== "ddp-kids-next"; ) {
    assert.ok(Date.now() < until, "the new worker takes over");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // The next visit gets the new files.
  page = await ctx.newPage();
  await page.goto(`${srv.base}/`);
  assert.match(await css(page), /\/\* next \*\//);
});
