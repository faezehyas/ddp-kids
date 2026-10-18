// The engine kit through a small fixture page (fixtures/engine/): the board
// fits every device, dots ripple out, taps and drags report the right square,
// a drop off the board snaps back, and the ghost hand plays, stops at a touch
// and turns into a pulse with reduced motion. Leaves screenshots of a board
// with dots, a drag halfway and the hand mid-way in test-artifacts/. Skips
// without Playwright.
//
//   node --test test/browser/engine.test.js
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { ARTIFACTS, DEVICES, assertNoSideScroll, assertNoWords, openPage, skipWithoutPlaywright } from "./helpers.js";

const skip = skipWithoutPlaywright();
const START = { c: 3, r: 4 };
const DEMO = [{ type: "press", square: START }, { type: "drag", square: { c: 3, r: 1 } }, { type: "release" }, { type: "return" }];

async function open(t, device = "phone") {
  const page = await openPage(t, "/fixtures/engine/", device);
  await page.waitForFunction(() => window.engine);
  return page;
}

const center = (page, square) =>
  page.evaluate((sq) => {
    const r = window.engine.board.rect(sq);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, square);
const where = (page) => page.evaluate(() => window.engine.board.where("a"));
const lastEvent = (page) => page.evaluate(() => window.engine.events.at(-1));
const handOpacity = (page) => page.evaluate(() => getComputedStyle(document.querySelector(".hand")).opacity);

// Where the piece shows, and how far that is from its square's middle.
async function offSquare(page) {
  return page.evaluate(() => {
    const { board } = window.engine;
    const p = document.querySelector('.piece[data-id="a"]').getBoundingClientRect();
    const s = board.rect(board.where("a"));
    return Math.hypot(p.left + p.width / 2 - (s.left + s.width / 2), p.top + p.height / 2 - (s.top + s.height / 2));
  });
}

// One finger on the touch screen, through the DevTools protocol (Playwright's
// touchscreen only taps).
async function finger(page) {
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

for (const device of Object.keys(DEVICES)) {
  test(`the board fits the screen on ${device}, with dots, a drag and the hand`, { skip }, async (t) => {
    const page = await open(t, device);
    const { width, height } = DEVICES[device];
    const fit = await page.evaluate(() => {
      const b = document.querySelector(".board").getBoundingClientRect();
      const squares = [...document.querySelectorAll(".sq")].map((s) => s.getBoundingClientRect());
      return { b: { left: b.left, right: b.right, top: b.top, bottom: b.bottom }, n: squares.length, w: squares[0].width, h: squares[0].height };
    });
    assert.equal(fit.n, 64);
    assert.ok(fit.b.left >= 0 && fit.b.right <= width && fit.b.top >= 0 && fit.b.bottom <= height, `the board is on the screen: ${JSON.stringify(fit.b)}`);
    assert.ok(Math.abs(fit.w - fit.h) < 1, `squares are square: ${fit.w} x ${fit.h}`);
    assert.ok(fit.w >= 40, `squares are ${fit.w} px`);
    if (device === "phone") assert.ok(fit.b.right - fit.b.left >= width - 30, "the board fills a phone's width");
    await assertNoWords(page);
    await assertNoSideScroll(page);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(ARTIFACTS, `engine-dots-${device}.png`) });

    const f = await finger(page);
    const from = await center(page, START);
    const to = await center(page, { c: 3, r: 1 });
    await f.down(from);
    await f.move({ x: from.x, y: (from.y + to.y) / 2 });
    await page.screenshot({ path: path.join(ARTIFACTS, `engine-drag-${device}.png`) });
    await f.up();
    await page.waitForTimeout(700);

    await page.evaluate(() => {
      const { board, hand } = window.engine;
      const at = board.where("a");
      window.shown = hand.show([{ type: "press", square: at }, { type: "drag", square: { c: 0, r: at.r } }, { type: "release" }, { type: "return" }]);
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ARTIFACTS, `engine-hand-${device}.png`) });
    assert.equal(await page.evaluate(() => window.shown), true);
  });
}

test("dots ripple out from a square, one ring at a time", { skip }, async (t) => {
  const page = await open(t);
  const dots = await page.evaluate(() => {
    window.engine.board.dots([{ c: 3, r: 3 }, { c: 3, r: 1 }, { c: 7, r: 4 }, { c: 5, r: 2 }], { c: 3, r: 4 });
    return [...document.querySelectorAll(".mark.dot")].map((d) => ({ c: +d.dataset.c, r: +d.dataset.r, delay: parseFloat(getComputedStyle(d).animationDelay) * 1000, opacity: +getComputedStyle(d).opacity }));
  });
  assert.deepEqual(dots.map((d) => d.delay), [60, 180, 240, 120]);
  assert.ok(dots.every((d) => d.opacity === 0), "they start hidden");
  await page.waitForTimeout(800);
  const shown = await page.evaluate(() => [...document.querySelectorAll(".mark.dot")].map((d) => +getComputedStyle(d).opacity));
  assert.deepEqual(shown, [0.85, 0.85, 0.85, 0.85]);
});

test("a tap and a drag both report the right square", { skip }, async (t) => {
  const page = await open(t);
  await page.touchscreen.tap(...Object.values(await center(page, START)));
  assert.deepEqual(await lastEvent(page), { type: "tap", square: START, id: "a" });

  const target = { c: 3, r: 1 };
  await page.touchscreen.tap(...Object.values(await center(page, target)));
  assert.deepEqual(await lastEvent(page), { type: "tap", square: target, id: null });
  await page.waitForTimeout(700);
  assert.deepEqual(await where(page), target);

  const f = await finger(page);
  await f.down(await center(page, target));
  await f.move(await center(page, { c: 6, r: 1 }));
  await f.up();
  assert.deepEqual(await lastEvent(page), { type: "drop", id: "a", from: target, to: { c: 6, r: 1 } });
  await page.waitForTimeout(700);
  assert.deepEqual(await where(page), { c: 6, r: 1 });
  assert.ok((await offSquare(page)) < 1, "the piece sits on its new square");
});

test("a drop off the board or on a wrong square snaps back", { skip }, async (t) => {
  const page = await open(t);
  const f = await finger(page);
  const from = await center(page, START);
  await f.down(from);
  await f.move({ x: from.x, y: DEVICES.phone.height - 4 }, 12);
  await f.up();
  assert.deepEqual(await lastEvent(page), { type: "drop", id: "a", from: START, to: null });
  await page.waitForTimeout(700);
  assert.deepEqual(await where(page), START);
  assert.ok((await offSquare(page)) < 1, "the piece is back on its square");

  await f.down(from);
  await f.move(await center(page, { c: 5, r: 2 }));
  await f.up();
  assert.deepEqual(await lastEvent(page), { type: "drop", id: "a", from: START, to: { c: 5, r: 2 } });
  await page.waitForTimeout(700);
  assert.deepEqual(await where(page), START);
  assert.ok((await offSquare(page)) < 1, "the piece is back on its square");
});

test("the keyboard moves a focus ring, picks a piece up and puts it down", { skip }, async (t) => {
  const page = await open(t, "tablet-landscape");
  await page.keyboard.press("Tab");
  for (const key of ["ArrowRight", "ArrowRight", "ArrowRight", ...Array(4).fill("ArrowDown")]) await page.keyboard.press(key);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".ring")).opacity), "1");
  await page.keyboard.press("Enter");
  assert.deepEqual(await lastEvent(page), { type: "tap", square: START, id: "a" });
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  assert.deepEqual(await lastEvent(page), { type: "drop", id: "a", from: START, to: { c: 3, r: 2 } });
  await page.waitForTimeout(700);
  assert.deepEqual(await where(page), { c: 3, r: 2 });
});

test("the hand plays a move, and a touch cancels it at once", { skip }, async (t) => {
  const page = await open(t);
  assert.equal(await page.evaluate((demo) => window.engine.hand.show(demo), DEMO), true);
  assert.equal(await handOpacity(page), "0");
  assert.deepEqual(await where(page), START);
  assert.ok((await offSquare(page)) < 1, "the piece went back");

  await page.evaluate((demo) => void (window.shown = window.engine.hand.show(demo)), DEMO);
  await page.waitForTimeout(1400);
  assert.ok(+(await handOpacity(page)) > 0.9, "the hand shows");
  assert.ok((await offSquare(page)) > 10, "the piece goes with the hand");
  await page.touchscreen.tap(DEVICES.phone.width - 10, 10);
  assert.equal(await page.evaluate(() => window.shown), false);
  assert.equal(await handOpacity(page), "0");
  assert.deepEqual(await where(page), START);
  assert.ok((await offSquare(page)) < 1, "the piece is back on its square at once");
});

test("with reduced motion the hand stays away and the target square pulses", { skip }, async (t) => {
  const page = await open(t);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate((demo) => void (window.shown = window.engine.hand.show(demo)), DEMO);
  await page.waitForTimeout(600);
  assert.equal(await handOpacity(page), "0");
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".mark.pulse")].map((m) => ({ c: +m.dataset.c, r: +m.dataset.r }))), [{ c: 3, r: 1 }]);
  assert.ok((await offSquare(page)) < 1, "the piece stays put");
  assert.equal(await page.evaluate(() => window.shown), true);
  assert.equal(await page.evaluate(() => document.querySelectorAll(".mark.pulse").length), 0);
});
