// Helpers for every browser test: a local server, pages on three touch
// devices, and the guards for the safety rules in ARCHITECTURE.md.
// Playwright stays out of package.json: it is loaded from PLAYWRIGHT_MODULE,
// a local install or the global one, and without it the tests skip.
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { after } from "node:test";
import { createApp } from "../../server/app.js";

export const DEVICES = {
  "tablet-landscape": { width: 1024, height: 768 },
  "tablet-portrait": { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
};

export const ARTIFACTS = path.resolve("test-artifacts");

const FIXTURES = path.resolve("test/browser/fixtures");

// The real server on a free port, which also serves the test pages in
// fixtures/ under /fixtures/; the site never does. publicDir swaps in other
// files.
export async function startServer({ publicDir } = {}) {
  const site = createApp({ publicDir });
  const fixtures = createApp({ publicDir: FIXTURES });
  const server = http.createServer((req, res) => {
    if (!req.url.startsWith("/fixtures/")) return site.emit("request", req, res);
    req.url = req.url.slice("/fixtures".length);
    fixtures.emit("request", req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close() {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

let playwright;
export function loadPlaywright() {
  if (playwright !== undefined) return playwright;
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_MODULE, "playwright"];
  try {
    candidates.push(path.join(execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(), "playwright"));
  } catch {}
  for (const c of candidates.filter(Boolean)) {
    try {
      return (playwright = require(c));
    } catch {}
  }
  return (playwright = null);
}

// A browser test's skip option: false, or why it can't run.
export const skipWithoutPlaywright = () =>
  !loadPlaywright() && "Playwright not found: npm install --global playwright && npx playwright install chromium, or set PLAYWRIGHT_MODULE";

// One server and one Chromium per test file, started on first use.
let shared;
function launch() {
  shared ??= Promise.all([startServer(), loadPlaywright().chromium.launch()]);
  return shared;
}
after(async () => {
  if (!shared) return;
  const [srv, browser] = await shared;
  await browser.close();
  await srv.close();
});

// Opens path on a touch device in a fresh context. When test t ends, it
// fails on any console error, page error or request to another origin
// (those requests are blocked). The service worker is blocked, so page.route()
// sees every request, unless serviceWorkers is "allow".
export async function openPage(t, pathname, device = "tablet-landscape", { serviceWorkers = "block" } = {}) {
  const [srv, browser] = await launch();
  const { origin } = new URL(srv.base);
  const ctx = await browser.newContext({ viewport: DEVICES[device], hasTouch: true, isMobile: true, serviceWorkers });
  const problems = [];
  const checkOrigin = (url) => /^(https?|wss?):/.test(url) && new URL(url).origin.replace(/^ws/, "http") !== origin && problems.push(`request to ${url}`);
  await ctx.route((url) => url.protocol.startsWith("http") && url.origin !== origin, (route) => route.abort());
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && problems.push(`console error: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("request", (r) => checkOrigin(r.url()));
  page.on("websocket", (ws) => checkOrigin(ws.url()));
  t.after(async () => {
    await ctx.close();
    assert.deepEqual(problems, [], `${pathname} on ${device}`);
  });
  await page.goto(srv.base + pathname);
  return page;
}

// One finger on the touch screen, through the DevTools protocol (Playwright's
// touchscreen only taps).
export async function finger(page) {
  const cdp = await page.context().newCDPSession(page);
  let at = null;
  const send = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  return {
    async down({ x, y }) {
      at = { x, y };
      await send("touchStart", [at]);
    },
    async move({ x, y }, steps = 8) {
      const from = at;
      for (let i = 1; i <= steps; i++) {
        at = { x: from.x + ((x - from.x) * i) / steps, y: from.y + ((y - from.y) * i) / steps };
        await send("touchMove", [at]);
      }
    },
    up: () => send("touchEnd", []),
  };
}

// Fails on visible text outside [data-parent]: text nodes, and text that CSS
// adds with ::before or ::after.
export async function assertNoWords(page) {
  const words = await page.evaluate(() => {
    const found = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!node.textContent.trim() || el.closest("[data-parent]")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const shown = [...range.getClientRects()].some((r) => r.width > 0 && r.height > 0);
      if (shown && el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) found.push(node.textContent.trim());
    }
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest("[data-parent]")) continue;
      for (const pseudo of ["::before", "::after"]) {
        const content = getComputedStyle(el, pseudo).content;
        if (/^".*\S.*"$/.test(content)) found.push(`${pseudo} ${content}`);
      }
    }
    return found;
  });
  assert.deepEqual(words, [], "visible words outside [data-parent]");
}

// clientWidth, not innerWidth: a mobile browser zooms out to fit a wide page.
// The body's scrollWidth too: theme.css hides its overflow, which would cut a
// wide page off instead.
export async function assertNoSideScroll(page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), width: document.documentElement.clientWidth }));
  assert.ok(scroll <= width, `the page scrolls sideways: ${scroll} px wide in a ${width} px window`);
}

// Fails on anything tappable smaller than --target (64 px) either way.
export async function assertBigTargets(page) {
  const small = await page.evaluate(() => {
    const target = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--target"));
    const tappable = 'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
    return [...document.querySelectorAll(tappable)]
      .filter((el) => el.checkVisibility())
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < target || r.height < target)
      .map(({ el, r }) => `${el.outerHTML.slice(0, 60)} is ${Math.round(r.width)}x${Math.round(r.height)}`);
  });
  assert.deepEqual(small, [], "tappable things under 64 px");
}
