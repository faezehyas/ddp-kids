// The placeholder home page passes every guard on all three devices, and
// leaves a screenshot of each in test-artifacts/. Skips without Playwright.
//
//   npm run test:browser
import test from "node:test";
import path from "node:path";
import { ARTIFACTS, DEVICES, assertNoSideScroll, assertNoWords, openPage, skipWithoutPlaywright } from "./helpers.js";

const skip = skipWithoutPlaywright();

for (const device of Object.keys(DEVICES)) {
  test(`home page passes every guard on ${device}`, { skip }, async (t) => {
    const page = await openPage(t, "/", device);
    await page.locator(".rook").waitFor();
    await assertNoWords(page);
    await assertNoSideScroll(page);
    await page.screenshot({ path: path.join(ARTIFACTS, `home-${device}.png`) });
  });
}
