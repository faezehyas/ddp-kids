// The chess playground's toy stage (/chess/): every piece's dots match its
// rules, taps and drags move it, wrong squares wiggle, the ghost hand plays
// once and stops at a touch, fast taps never break it, and a pawn on the far
// row walks back. Leaves screenshots of the hand mid-way, the shadow after it
// and the board with dots in test-artifacts/. Skips without Playwright.
//
//   node --test test/browser/playground.test.js
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { LESSONS } from "../../public/chess/lessons.js";
import { NAMES } from "../../public/chess/pieces.js";
import { key, moves } from "../../public/chess/rules.js";
import { ARTIFACTS, DEVICES, assertBigTargets, assertNoSideScroll, assertNoWords, finger, openPage, skipWithoutPlaywright } from "./helpers.js";

const skip = skipWithoutPlaywright();
const ROOK = LESSONS[0].start;
const PAWN = LESSONS.find((l) => l.type === "P").start;

// The squares a piece of this type can go to from a square, as sorted key()s.
const expected = (type, at) => moves({ cols: 8, rows: 8, pieces: [{ id: "a", type, side: "you", at }] }, "a").map(key).sort();

async function open(t, query = "", device = "phone") {
  const page = await openPage(t, `/chess/${query}`, device);
  await page.locator(".piece").waitFor();
  return page;
}

const center = (page, square) =>
  page.evaluate(({ c, r }) => {
    const b = document.querySelector(`.sq[data-c="${c}"][data-r="${r}"]`).getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, square);
const tap = async (page, square) => {
  const { x, y } = await center(page, square);
  await page.touchscreen.tap(x, y);
};
const handOpacity = (page) => page.evaluate(() => getComputedStyle(document.querySelector(".hand")).opacity);

// What the board shows: how many pieces, where the piece is and how far it
// shows from that square's middle, whether it's still moving or lifted, and
// the dots and shadows.
function state(page) {
  return page.evaluate(() => {
    const at = (el) => ({ c: Number(el.dataset.c), r: Number(el.dataset.r) });
    const squares = (sel) => [...document.querySelectorAll(sel)].map((el) => `${el.dataset.c},${el.dataset.r}`).sort();
    const pieces = document.querySelectorAll(".piece");
    const piece = pieces[0];
    const p = piece.getBoundingClientRect();
    const s = document.querySelector(`.sq[data-c="${piece.dataset.c}"][data-r="${piece.dataset.r}"]`).getBoundingClientRect();
    return {
      pieces: pieces.length,
      at: at(piece),
      off: Math.hypot(p.left + p.width / 2 - (s.left + s.width / 2), p.top + p.height / 2 - (s.top + s.height / 2)),
      busy: piece.classList.contains("moving") || piece.classList.contains("up"),
      dots: squares(".mark.dot"),
      shadows: squares(".mark.shadow"),
    };
  });
}

// Stops the ghost hand with a touch off the board.
async function quiet(page) {
  await page.touchscreen.tap(DEVICES.phone.width - 10, DEVICES.phone.height - 10);
}

// The piece rests on `square` with the dots of `type` around it.
async function assertRests(page, type, square) {
  const s = await state(page);
  assert.equal(s.pieces, 1, "one piece");
  assert.deepEqual(s.at, square);
  assert.ok(s.off < 1, `the piece sits on its square, ${s.off} px off`);
  assert.equal(s.busy, false, "the piece isn't moving or lifted");
  assert.deepEqual(s.dots, expected(type, square));
}

for (const device of Object.keys(DEVICES)) {
  test(`the playground passes every guard on ${device}, with the hand, its shadow and the dots`, { skip }, async (t) => {
    const page = await open(t, "", device);
    const { width, height } = DEVICES[device];
    await assertNoWords(page);
    await assertNoSideScroll(page);
    await assertBigTargets(page);
    const home = await page.locator(".home").evaluate((a) => ({ href: a.getAttribute("href"), ...a.getBoundingClientRect().toJSON() }));
    assert.equal(home.href, "/");
    const b = await page.locator(".board").evaluate((el) => el.getBoundingClientRect().toJSON());
    assert.ok(b.left >= 0 && b.right <= width && b.bottom <= height && (b.top >= home.bottom || b.left >= home.right), `the board is on the screen, clear of the home button: ${JSON.stringify(b)}`);

    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ARTIFACTS, `chess-hand-${device}.png`) });
    await page.locator(".mark.shadow").waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACTS, `chess-shadow-${device}.png`) });
    await tap(page, { c: 3, r: 1 });
    await page.waitForTimeout(900);
    await assertRests(page, "R", { c: 3, r: 1 });
    await page.screenshot({ path: path.join(ARTIFACTS, `chess-dots-${device}.png`) });
    await assertNoWords(page);
  });
}

for (const { type, start } of LESSONS) {
  test(`?piece=${type} starts on its square with a dot on every square its rules allow`, { skip }, async (t) => {
    const page = await open(t, `?piece=${type}`);
    assert.equal(await page.locator(".piece").getAttribute("aria-label"), NAMES[type]);
    await quiet(page);
    await assertRests(page, type, start);
  });
}

test("a tap on a dot moves the piece, and the dots follow it", { skip }, async (t) => {
  const page = await open(t);
  await quiet(page);
  await tap(page, { c: 3, r: 1 });
  await page.waitForTimeout(700);
  await assertRests(page, "R", { c: 3, r: 1 });
});

test("dragging the piece to a dot moves it there", { skip }, async (t) => {
  const page = await open(t);
  await quiet(page);
  const f = await finger(page);
  await f.down(await center(page, ROOK));
  await f.move(await center(page, { c: 6, r: 4 }));
  await f.up();
  await page.waitForTimeout(700);
  await assertRests(page, "R", { c: 6, r: 4 });
});

test("a drop on a wrong square or off the board snaps back and wiggles", { skip }, async (t) => {
  const page = await open(t);
  await quiet(page);
  const f = await finger(page);
  await f.down(await center(page, ROOK));
  await f.move(await center(page, { c: 5, r: 2 }));
  await f.up();
  assert.equal(await page.locator(".pin.wiggle").count(), 1);
  await page.waitForTimeout(700);
  await assertRests(page, "R", ROOK);

  await f.down(await center(page, ROOK));
  await f.move({ x: DEVICES.phone.width / 2, y: DEVICES.phone.height - 4 }, 12);
  await f.up();
  await page.waitForTimeout(700);
  await assertRests(page, "R", ROOK);
});

test("a wrong tap wiggles and doesn't move the piece", { skip }, async (t) => {
  const page = await open(t);
  await quiet(page);
  await tap(page, { c: 5, r: 2 });
  assert.equal(await page.locator(".pin.wiggle").count(), 1);
  await page.waitForTimeout(700);
  await assertRests(page, "R", ROOK);
});

test("the keyboard moves the piece too", { skip }, async (t) => {
  const page = await open(t, "", "tablet-landscape");
  await page.locator(".board").focus();
  for (const k of [...Array(3).fill("ArrowRight"), ...Array(4).fill("ArrowDown"), "Enter", "ArrowUp", "ArrowUp", "ArrowUp", "Enter"]) await page.keyboard.press(k);
  await page.waitForTimeout(700);
  await assertRests(page, "R", { c: 3, r: 1 });
});

test("the hand plays one move on load and leaves the piece's shadow until the child moves", { skip }, async (t) => {
  const page = await open(t);
  await page.waitForTimeout(1500);
  assert.ok(+(await handOpacity(page)) > 0.9, "the hand shows");
  assert.ok((await state(page)).off > 10, "the piece goes with the hand");

  await page.locator(".mark.shadow").waitFor();
  const s = await state(page);
  assert.equal(s.shadows.length, 1);
  const [c, r] = s.shadows[0].split(",").map(Number);
  assert.ok(expected("R", ROOK).includes(s.shadows[0]), "the shadow is on a square the rook can go to");
  assert.ok([2, 3].includes(Math.max(Math.abs(c - ROOK.c), Math.abs(r - ROOK.r))), "2 or 3 squares away");
  assert.deepEqual(s.at, ROOK);
  assert.ok(s.off < 1, "the piece went back");
  assert.deepEqual(s.dots, expected("R", ROOK).filter((sq) => sq !== s.shadows[0]), "no dot under the shadow");

  for (let i = 0; i < 16; i++) {
    assert.equal(await handOpacity(page), "0", "the hand plays only once");
    await page.waitForTimeout(250);
  }
  assert.equal((await state(page)).shadows.length, 1, "the shadow stays");

  await tap(page, { c: 3, r: 1 });
  await page.waitForTimeout(700);
  assert.deepEqual((await state(page)).shadows, [], "the shadow goes when the child moves");
  await assertRests(page, "R", { c: 3, r: 1 });
});

test("a touch stops the hand at once", { skip }, async (t) => {
  const page = await open(t);
  await page.waitForTimeout(1500);
  assert.ok(+(await handOpacity(page)) > 0.9, "the hand shows");
  await quiet(page);
  assert.equal(await handOpacity(page), "0");
  await assertRests(page, "R", ROOK);
  await page.waitForTimeout(3000);
  assert.equal(await handOpacity(page), "0");
  assert.deepEqual((await state(page)).shadows, [], "no shadow after a stopped hand");
});

for (const type of ["R", "N"]) {
  test(`10 fast taps leave one ${NAMES[type].toLowerCase()} on its square with the right dots`, { skip }, async (t) => {
    const page = await open(t, `?piece=${type}`);
    const squares = Array.from({ length: 10 }, (_, i) => ({ c: (i * 3 + 1) % 8, r: (i * 5 + 2) % 8 }));
    const points = [];
    for (const sq of squares) points.push(await center(page, sq));
    const t0 = Date.now();
    for (const { x, y } of points) await page.touchscreen.tap(x, y);
    assert.ok(Date.now() - t0 < 1000, `10 taps in ${Date.now() - t0} ms`);
    await page.waitForTimeout(1500);
    const { at } = await state(page);
    await assertRests(page, type, at);
  });
}

test("fast wrong taps wiggle the piece at most 3 times a second", { skip }, async (t) => {
  const page = await open(t);
  await quiet(page);
  // Counts each time the wiggle class goes on, which restarts the wiggle.
  await page.evaluate(() => {
    window.wiggles = 0;
    new MutationObserver((records) => {
      for (const m of records) window.wiggles += m.target.classList.contains("wiggle") && !m.oldValue.includes("wiggle");
    }).observe(document.querySelector(".pin"), { attributeFilter: ["class"], attributeOldValue: true });
  });
  const points = [];
  for (const c of [0, 1, 2, 4, 5, 6, 7, 0, 1, 2]) points.push(await center(page, { c, r: 2 }));
  const t0 = Date.now();
  for (const { x, y } of points) await page.touchscreen.tap(x, y);
  const ms = Date.now() - t0;
  assert.ok(ms < 1000, `10 taps in ${ms} ms`);
  const wiggles = await page.evaluate(() => window.wiggles);
  assert.ok(wiggles >= 1 && wiggles <= 3, `${wiggles} wiggles`);
  await assertRests(page, "R", ROOK);
});

test("a pawn on the far row walks back to its start", { skip }, async (t) => {
  const page = await open(t, "?piece=P");
  await quiet(page);
  for (const r of [4, 3, 2, 1, 0]) {
    await tap(page, { c: PAWN.c, r });
    await page.waitForTimeout(600);
  }
  const s = await state(page);
  assert.deepEqual(s.at, { c: PAWN.c, r: 0 });
  assert.deepEqual(s.dots, []);
  await page.waitForTimeout(1500);
  await assertRests(page, "P", PAWN);
});

test("a pawn held while it walks back ends on its start", { skip }, async (t) => {
  const page = await open(t, "?piece=P");
  await quiet(page);
  for (const r of [4, 3, 2, 1, 0]) {
    await tap(page, { c: PAWN.c, r });
    await page.waitForTimeout(600);
  }
  const f = await finger(page);
  await f.down(await center(page, { c: PAWN.c, r: 0 }));
  await page.waitForTimeout(1800);
  await f.move(await center(page, { c: 0, r: 0 }));
  await f.up();
  await page.waitForTimeout(700);
  await assertRests(page, "P", PAWN);
});
