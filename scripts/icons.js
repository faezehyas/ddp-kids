// Redraws public/icon-192.png and public/icon-512.png from public/icon.svg
// with Playwright's Chromium, found the way the browser tests find it.
//
//   node scripts/icons.js
import fs from "node:fs";
import path from "node:path";
import { loadPlaywright } from "../test/browser/helpers.js";

const svg = fs.readFileSync(path.resolve("public/icon.svg"), "utf8");
const playwright = loadPlaywright();
if (!playwright) throw new Error("Playwright not found: npm install --global playwright && npx playwright install chromium, or set PLAYWRIGHT_MODULE");

const browser = await playwright.chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>*{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
  await page.screenshot({ path: path.resolve(`public/icon-${size}.png`) });
  await page.close();
}
await browser.close();
