// The home shelf: the chess box passes every guard on all three devices, and
// opens /chess/ by tap, Enter and Space. Leaves screenshots of the shelf and of
// the lid mid-lift in test-artifacts/. Skips without Playwright.
//
//   node --test test/browser/home.test.js
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { ARTIFACTS, DEVICES, assertBigTargets, assertNoSideScroll, assertNoWords, openPage, skipWithoutPlaywright } from "./helpers.js";

const skip = skipWithoutPlaywright();

// The shelf with /chess/ standing in for the game, so these tests check only
// the home page.
async function open(t, device) {
  const page = await openPage(t, "/", device);
  await page.route("**/chess/", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>ddp-kids</title>" }));
  await page.locator('.box[data-game="chess"]').waitFor();
  return page;
}

for (const device of Object.keys(DEVICES)) {
  test(`home shelf passes every guard on ${device}`, { skip }, async (t) => {
    const page = await open(t, device);
    assert.equal(await page.title(), "ddp-kids");
    assert.equal(await page.locator(".box").count(), 1);
    assert.equal(await page.locator(".box").getAttribute("aria-label"), "Chess");
    await assertNoWords(page);
    await assertNoSideScroll(page);
    await assertBigTargets(page);
    await page.screenshot({ path: path.join(ARTIFACTS, `home-${device}.png`) });
  });

  test(`a tap on the chess box lifts the lid and opens /chess/ on ${device}`, { skip }, async (t) => {
    const page = await open(t, device);
    await page.tap(".box");
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(ARTIFACTS, `home-${device}-lid.png`) });
    await page.waitForURL("**/chess/");
  });
}

for (const key of ["Enter", "Space"]) {
  test(`${key} on the chess box opens /chess/`, { skip }, async (t) => {
    const page = await open(t, "phone");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.game), "chess");
    await page.keyboard.press(key);
    await page.waitForURL("**/chess/");
  });
}
