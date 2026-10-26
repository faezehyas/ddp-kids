// Capturing in the chess playground (/chess/, round 2): ink pawns stop the
// dots and get a dot on top when the piece can take them, landing on one
// rolls it into the bowl, a clear board brings the next stage and after the
// last the next piece, the knight jumps over them, a pawn that went past them
// walks back, and progress survives a reload. Leaves screenshots of blocked
// dots, a pawn rolling into the bowl and a cleared board in test-artifacts/.
// Skips without Playwright.
//
//   node --test test/browser/capture.test.js
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { INK, LESSONS } from "../../public/chess/lessons.js";
import { key, moves } from "../../public/chess/rules.js";
import { ARTIFACTS, DEVICES, assertBigTargets, assertNoSideScroll, assertNoWords, finger, openPage, skipWithoutPlaywright } from "./helpers.js";

const skip = skipWithoutPlaywright();
const YOU = '.piece[data-id="you"]';
const ALL = LESSONS.map((l) => l.type);
const lesson = (type) => LESSONS.find((l) => l.type === type);
const FILLED = [{ c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }];
// Round 2 progress: the shadows waiting, or capture stage n (1, 2 or 3).
const shadows = (piece) => ({ met: ALL, piece, round: 1, filled: [], cleared: 0 });
const stage = (piece, n) => ({ met: ALL, piece, round: 1, filled: FILLED, cleared: n - 1 });

// The squares the piece can go to with these ink pawns, as sorted key()s.
const expected = (type, at, ink) =>
  moves({ cols: 8, rows: 8, pieces: [{ id: "a", type, side: "you", at }, ...ink.map((sq, i) => ({ id: i, type: INK, side: "ink", at: sq }))] }, "a").map(key).sort();

// Opens /chess/ with this progress saved, and stops the hand.
async function openWith(t, chess, device = "phone") {
  const page = await openPage(t, "/chess/", device);
  await page.locator(YOU).waitFor();
  await page.evaluate((chess) => localStorage.setItem("ddp-kids", JSON.stringify({ version: 1, sound: true, progress: { chess } })), chess);
  await page.reload();
  await page.locator(YOU).waitFor();
  await quiet(page, device);
  return page;
}
const quiet = (page, device = "phone") => page.touchscreen.tap(DEVICES[device].width - 10, DEVICES[device].height - 10);
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("ddp-kids"))?.progress.chess);

const center = (page, { c, r }) =>
  page.evaluate(({ c, r }) => {
    const b = document.querySelector(`.sq[data-c="${c}"][data-r="${r}"]`).getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, { c, r });
const tap = async (page, square) => {
  const { x, y } = await center(page, square);
  await page.touchscreen.tap(x, y);
};

// What the board shows: the child's piece, the ink pawns standing, the dots
// (and the ones on a pawn) and the pawns in the bowl.
function state(page) {
  return page.evaluate(() => {
    const squares = (sel) => [...document.querySelectorAll(sel)].map((el) => `${el.dataset.c},${el.dataset.r}`).sort();
    const you = document.querySelector('.piece[data-id="you"]');
    return {
      at: `${you.dataset.c},${you.dataset.r}`,
      busy: you.classList.contains("moving"),
      ink: squares(".piece.still:not(.gone)"),
      dots: squares(".mark.dot"),
      take: squares(".mark.dot.take"),
      bowl: document.querySelectorAll(".bowl i.in").length,
    };
  });
}

// The piece rests on `at` among the ink pawns on `ink`, with its dots.
async function assertRests(page, type, at, ink) {
  const s = await state(page);
  assert.equal(s.at, key(at));
  assert.equal(s.busy, false, "the piece isn't moving");
  assert.deepEqual(s.ink, ink.map(key).sort());
  assert.deepEqual(s.dots, expected(type, at, ink));
  assert.deepEqual(s.take, s.dots.filter((sq) => s.ink.includes(sq)), "a dot on top of each pawn to take");
}

// Waits for a stage's pawns to stand, then stops the hand that shows the way.
async function settle(page, ink) {
  await page.waitForFunction((n) => document.querySelectorAll(".piece.still:not(.gone)").length === n && !document.querySelector(".piece.moving"), ink.length, { timeout: 6000 });
  await quiet(page);
  await page.waitForTimeout(500);
}

for (const device of Object.keys(DEVICES)) {
  test(`capturing passes every guard on ${device}: blocked dots, a pawn rolling into the bowl, a cleared board`, { skip }, async (t) => {
    const rook = lesson("R");
    let page = await openWith(t, shadows("R"), device);
    await page.waitForTimeout(600);
    await assertRests(page, "R", rook.start, rook.blockers);
    assert.ok(+(await page.locator(".bowl").evaluate((el) => getComputedStyle(el).opacity)) > 0.9, "the bowl shows in round 2");
    await assertNoWords(page);
    await assertNoSideScroll(page);
    await assertBigTargets(page);
    await page.screenshot({ path: path.join(ARTIFACTS, `capture-blocked-${device}.png`) });

    page = await openWith(t, stage("R", 1), device);
    await page.waitForTimeout(500);
    const [pawn] = rook.captures[0];
    await tap(page, pawn);
    await page.waitForSelector(".pin.roll");
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(ARTIFACTS, `capture-rolling-${device}.png`) });
    await page.waitForFunction(() => document.querySelector(".bowl i.in"));
    await page.waitForTimeout(150);
    const s = await state(page);
    assert.deepEqual(s.ink, [], "the board is clear");
    assert.equal(s.bowl, 1, "the pawn lies in the bowl");
    await page.screenshot({ path: path.join(ARTIFACTS, `capture-cleared-${device}.png`) });
    await assertNoWords(page);
    await assertNoSideScroll(page);
    const [board, bowl] = await Promise.all([".board", ".bowl"].map((s) => page.locator(s).evaluate((el) => el.getBoundingClientRect().toJSON())));
    const { width, height } = DEVICES[device];
    assert.ok(bowl.left >= 0 && bowl.right <= width && bowl.bottom <= height, `the bowl is on the screen: ${JSON.stringify(bowl)}`);
    assert.ok(bowl.top >= board.bottom || bowl.left >= board.right, "the bowl is beside the board");
  });
}

test("in round 2 the ink pawns stand in the way of the shadows, and dots stop at them", { skip }, async (t) => {
  for (const type of ["R", "B", "Q"]) {
    const l = lesson(type);
    const page = await openWith(t, shadows(type));
    await page.waitForTimeout(600);
    await assertRests(page, type, l.start, l.blockers);
    assert.ok((await state(page)).take.length > 0, `${type}: a dot on a pawn`);
  }
});

test("landing on an ink pawn rolls it into the bowl, and a clear board brings the next stage", { skip }, async (t) => {
  const rook = lesson("R");
  const [first, second] = rook.captures[1];
  const page = await openWith(t, stage("R", 2));
  await page.waitForTimeout(500);
  await assertRests(page, "R", rook.start, rook.captures[1]);

  // A pawn can't be dragged, and one the rook can't reach wiggles it.
  const f = await finger(page);
  await f.down(await center(page, second));
  await f.move(await center(page, { c: 0, r: 0 }));
  await f.up();
  await tap(page, second);
  assert.equal(await page.locator('.piece[data-id="you"] .pin.wiggle').count(), 1, "a pawn out of reach wiggles the rook");
  await page.waitForTimeout(600);
  await assertRests(page, "R", rook.start, rook.captures[1]);

  await tap(page, first);
  await page.waitForFunction(() => document.querySelector(".bowl i.in"));
  await page.waitForTimeout(200);
  await assertRests(page, "R", first, [second]);
  assert.equal((await state(page)).bowl, 1, "one pawn in the bowl");

  // The last one by dragging: the board is clear.
  await f.down(await center(page, first));
  await f.move(await center(page, second));
  await f.up();
  await page.waitForFunction(() => document.querySelectorAll(".bowl i.in").length === 2);
  assert.deepEqual((await state(page)).ink, []);
  assert.equal((await saved(page)).cleared, 2);

  await settle(page, rook.captures[2]);
  assert.equal((await state(page)).bowl, 0, "the bowl is empty again");
  await assertRests(page, "R", rook.start, rook.captures[2]);
  await assertNoWords(page);
});

test("after the last stage the next piece comes, with its blockers", { skip }, async (t) => {
  const rook = lesson("R");
  const page = await openWith(t, stage("R", 3));
  await page.waitForTimeout(500);
  for (const sq of rook.captures[2]) {
    await tap(page, sq);
    await page.waitForFunction(({ c, r }) => !document.querySelector(`.piece.still[data-c="${c}"][data-r="${r}"]:not(.gone)`) && !document.querySelector(".piece.rolling"), sq);
    await page.waitForTimeout(300);
  }
  assert.equal((await saved(page)).cleared, 3);
  await page.locator('.piece[aria-label="Bishop"]').waitFor({ timeout: 6000 });
  const bishop = lesson("B");
  await settle(page, bishop.blockers);
  await page.waitForTimeout(600);
  await assertRests(page, "B", bishop.start, bishop.blockers);
  assert.deepEqual(await saved(page), { met: ALL, piece: "B", round: 1, filled: [], cleared: 0 });
});

test("the knight jumps over the ink pawns", { skip }, async (t) => {
  const knight = lesson("N");
  let page = await openWith(t, shadows("N"));
  await page.waitForTimeout(600);
  await assertRests(page, "N", knight.start, knight.blockers);
  assert.deepEqual((await state(page)).dots, expected("N", knight.start, []), "the pawns next to it change nothing");

  page = await openWith(t, stage("N", 3));
  await page.waitForTimeout(500);
  const [near, far] = knight.captures[2];
  await page.evaluate(() => {
    window.hops = 0;
    new MutationObserver(() => (window.hops += document.querySelector('.piece[data-id="you"] .pin').classList.contains("hop"))).observe(document.querySelector('.piece[data-id="you"] .pin'), { attributeFilter: ["class"] });
  });
  await tap(page, far);
  await page.waitForFunction(() => document.querySelector(".bowl i.in"));
  assert.ok(await page.evaluate(() => window.hops > 0), "it hops");
  await page.waitForTimeout(200);
  await assertRests(page, "N", far, knight.captures[2].filter((sq) => sq !== far));
  assert.ok(knight.captures[2].includes(near));
});

test("a pawn that went past the ink pawns walks back to its start", { skip }, async (t) => {
  const pawn = lesson("P");
  const page = await openWith(t, stage("P", 1));
  await page.waitForTimeout(500);
  await tap(page, { c: pawn.start.c, r: pawn.start.r - 2 });
  await page.waitForTimeout(700);
  assert.deepEqual((await state(page)).dots, [], "no dots while it can't reach one");
  await page.waitForTimeout(2000);
  await assertRests(page, "P", pawn.start, pawn.captures[0]);
});

test("a reload starts the capture stage again, and keeps the stages cleared", { skip }, async (t) => {
  const rook = lesson("R");
  const page = await openWith(t, stage("R", 2));
  await page.waitForTimeout(500);
  await tap(page, rook.captures[1][0]);
  await page.waitForFunction(() => document.querySelector(".bowl i.in"));
  await page.reload();
  await page.locator(YOU).waitFor();
  await quiet(page);
  await page.waitForTimeout(600);
  await assertRests(page, "R", rook.start, rook.captures[1]);
  assert.equal((await state(page)).bowl, 0);
  assert.deepEqual(await saved(page), stage("R", 2));
});

test("with reduced motion a taken pawn fades into the bowl", { skip }, async (t) => {
  const rook = lesson("R");
  const page = await openWith(t, stage("R", 2));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(500);
  await tap(page, rook.captures[1][0]);
  await page.waitForFunction(() => document.querySelector(".bowl i.in"));
  assert.equal(await page.locator(".pin.tip, .pin.roll").count(), 0, "it doesn't tip or roll");
  await page.waitForTimeout(200);
  await assertRests(page, "R", rook.captures[1][0], [rook.captures[1][1]]);
});
