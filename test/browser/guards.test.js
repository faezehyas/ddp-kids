// The guards in helpers.js catch what they guard against. Skips without
// Playwright.
import test from "node:test";
import assert from "node:assert/strict";
import { assertNoSideScroll, assertNoWords, openPage, skipWithoutPlaywright } from "./helpers.js";

const skip = skipWithoutPlaywright();

test("assertNoWords fails on visible text outside [data-parent]", { skip }, async (t) => {
  const page = await openPage(t, "/");
  await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<p data-parent>Sound</p><p hidden>Hidden</p><span aria-label="Rook"></span>'));
  await assertNoWords(page);
  await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", "<p>Play</p>"));
  await assert.rejects(assertNoWords(page), /Play/);
});

test("assertNoSideScroll fails on a page wider than the screen", { skip }, async (t) => {
  const page = await openPage(t, "/", "phone");
  // Through the CSSOM: the CSP refuses style attributes.
  await page.evaluate(() => Object.assign(document.body.appendChild(document.createElement("div")).style, { width: "500px", height: "10px" }));
  await assert.rejects(assertNoSideScroll(page), /sideways/);
});
