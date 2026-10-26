// The chess playground (/chess/): every piece's dots match its rules, taps
// and drags move it, wrong squares wiggle, the ghost hand plays once and
// stops at a touch, fast taps never break it, and a pawn on the far row walks
// back. Then the goals: shadows at the right distance fill with their pips,
// the next piece comes, the tray brings one back, progress survives a
// reload, the idle hint, round 2 and reduced motion. Leaves screenshots of
// the hand mid-way, the shadows, the board with dots and the tray in
// test-artifacts/. Skips without Playwright.
//
//   node --test test/browser/playground.test.js
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { LESSONS } from "../../public/chess/lessons.js";
import { NAMES } from "../../public/chess/pieces.js";
import { distance, key, moves } from "../../public/chess/rules.js";
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

// The piece rests on `square` with the dots of `type` around it, but none
// under a shadow.
async function assertRests(page, type, square) {
  const s = await state(page);
  assert.equal(s.pieces, 1, "one piece");
  assert.deepEqual(s.at, square);
  assert.ok(s.off < 1, `the piece sits on its square, ${s.off} px off`);
  assert.equal(s.busy, false, "the piece isn't moving or lifted");
  assert.deepEqual(s.dots, expected(type, square).filter((sq) => !s.shadows.includes(sq)));
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

// ---- Goals and the next piece ----

const BISHOP = LESSONS[1].start;
const position = (type, at) => ({ cols: 8, rows: 8, pieces: [{ id: "a", type, side: "you", at }] });
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("ddp-kids"))?.progress.chess);
const label = (page) => page.locator('.piece[data-id="you"]').getAttribute("aria-label");
const pipsOn = (page) => page.locator(".pips i.on").count();
// Each slot on the tray as type:classes, e.g. "R:met" or "B:met+here".
const trayState = (page) =>
  page.evaluate(() => [...document.querySelectorAll(".slot")].map((s) => `${s.dataset.type}:${["met", "here", "next", "bob"].filter((c) => s.classList.contains(c)).join("+")}`));

// A tap on a slot of the tray, the way a finger does it.
async function tapSlot(page, type) {
  const b = await page.locator(`.slot[data-type="${type}"]`).boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

// Opens /chess/ with this progress saved, and stops the hand.
async function openWith(t, chess, device = "phone") {
  const page = await open(t, "", device);
  await page.evaluate((chess) => localStorage.setItem("ddp-kids", JSON.stringify({ version: 1, sound: true, progress: { chess } })), chess);
  await page.reload();
  await page.locator('.piece[data-id="you"]').waitFor();
  await quiet(page);
  return page;
}

// The shadow waiting to be filled, once there is one.
async function goal(page) {
  const m = page.locator(".mark.shadow:not(.fit)");
  await m.waitFor();
  return m.evaluate((el) => ({ c: Number(el.dataset.c), r: Number(el.dataset.r) }));
}

// Free moves: each to the first square the rules allow.
async function freePlay(page, type, n = LESSONS[0].free) {
  for (let i = 0; i < n; i++) {
    const [c, r] = expected(type, (await state(page)).at)[0].split(",").map(Number);
    await tap(page, { c, r });
    await page.waitForTimeout(700);
  }
}

// Lands on the shadow; resolves with its square.
async function fill(page) {
  const sq = await goal(page);
  await tap(page, sq);
  await page.waitForTimeout(800);
  return sq;
}

test("after 3 free moves a shadow waits one move away, and landing on it fills it and a pip", { skip }, async (t) => {
  const page = await open(t);
  await quiet(page);
  await freePlay(page, "R", 2);
  assert.equal(await page.locator(".mark.shadow").count(), 0, "no shadow yet");
  assert.equal(await page.locator(".pips.on").count(), 0, "no pips yet");
  await freePlay(page, "R", 1);
  const sq = await goal(page);
  const { at } = await state(page);
  assert.equal(distance(position("R", at), "a", sq), 1, "one move away");
  assert.ok(Math.max(Math.abs(sq.c - at.c), Math.abs(sq.r - at.r)) >= 2, "2 or more squares away");
  assert.equal(await page.locator(".pips.on").count(), 1, "the pips show");
  assert.equal(await pipsOn(page), 0);
  await assertRests(page, "R", at);
  await page.screenshot({ path: path.join(ARTIFACTS, "chess-goal-shadow-phone.png") });

  await tap(page, sq);
  await page.waitForTimeout(600);
  assert.equal(await page.locator(`.mark.shadow.fit[data-c="${sq.c}"][data-r="${sq.r}"]`).count(), 1, "the shadow fills");
  await page.waitForTimeout(600);
  assert.equal(await page.locator(`.mark.fill[data-c="${sq.c}"][data-r="${sq.r}"]`).count(), 1, "the square stays honey");
  assert.equal(await pipsOn(page), 1, "one pip fills");
  assert.deepEqual((await saved(page)).filled, [sq]);
  const again = await goal(page);
  assert.equal(distance(position("R", sq), "a", again), 1, "the next shadow is one move away too");
  await page.screenshot({ path: path.join(ARTIFACTS, "chess-goal-filled-phone.png") });
  await assertNoWords(page);
});

test("three filled shadows bring the bishop, and the rook on the tray brings the rook back", { skip }, async (t) => {
  const page = await openWith(t, { met: ["R"], piece: "R", round: 0, filled: [{ c: 0, r: 4 }] });
  assert.deepEqual(await trayState(page), ["R:met+here", "B:next", "Q:", "K:", "N:", "P:"]);
  await fill(page);
  const last = await goal(page);
  await tap(page, last);
  await page.waitForTimeout(500);
  assert.equal(await pipsOn(page), 3);
  assert.deepEqual(await trayState(page), ["R:met+here", "B:next+bob", "Q:", "K:", "N:", "P:"], "the bishop bobs");
  await page.screenshot({ path: path.join(ARTIFACTS, "chess-next-bob-phone.png") });
  assert.equal(await label(page), "Rook", "a moment before it comes");

  await page.locator('.piece[aria-label="Bishop"]').waitFor({ timeout: 5000 });
  await quiet(page);
  await page.waitForTimeout(900);
  await assertRests(page, "B", BISHOP);
  assert.deepEqual(await trayState(page), ["R:met", "B:met+here", "Q:next", "K:", "N:", "P:"]);
  assert.equal(await page.locator(".mark.fill").count(), 0, "a fresh board");
  assert.equal(await pipsOn(page), 0);
  assert.deepEqual(await saved(page), { met: ["R", "B"], piece: "B", round: 0, filled: [], cleared: 0 });

  await tapSlot(page, "Q");
  assert.equal(await page.locator('.slot[data-type="Q"].wiggle').count(), 1, "a piece not met yet wiggles");
  await page.waitForTimeout(500);
  assert.equal(await label(page), "Bishop", "and doesn't come");
  await tapSlot(page, "R");
  await page.waitForTimeout(2200);
  await quiet(page);
  assert.equal(await label(page), "Rook");
  await assertRests(page, "R", ROOK);
  assert.deepEqual(await trayState(page), ["R:met+here", "B:met", "Q:next", "K:", "N:", "P:"]);
  assert.deepEqual(await saved(page), { met: ["R", "B"], piece: "R", round: 0, filled: [], cleared: 0 });
});

test("a reload continues with the same piece and its filled squares", { skip }, async (t) => {
  const page = await open(t, "?piece=B");
  await quiet(page);
  await freePlay(page, "B");
  const sq = await fill(page);
  await page.goto(page.url().replace("?piece=B", ""));
  await page.locator(".piece").waitFor();
  await quiet(page);
  assert.equal(await label(page), "Bishop");
  assert.equal(await page.locator(`.mark.fill[data-c="${sq.c}"][data-r="${sq.r}"]`).count(), 1, "the filled square is still honey");
  assert.equal(await pipsOn(page), 1);
  const next = await goal(page);
  assert.equal(distance(position("B", BISHOP), "a", next), 1, "a shadow waits at once");
  await assertRests(page, "B", BISHOP);
});

test("the idle hint shows the way to the shadow after 8 s, once at a time, and stops at a touch", { skip }, async (t) => {
  const page = await openWith(t, { met: ["R"], piece: "R", round: 0, filled: [{ c: 0, r: 4 }] });
  await goal(page);
  await page.waitForTimeout(7000);
  assert.equal(await handOpacity(page), "0", "no hint before 8 s");
  await page.waitForTimeout(2200);
  assert.ok(+(await handOpacity(page)) > 0.9, "the hand shows the way");
  assert.equal(await page.locator(".hand").count(), 1, "one hand");
  await quiet(page);
  assert.equal(await handOpacity(page), "0", "a touch stops it");
  await page.waitForTimeout(3000);
  assert.equal(await handOpacity(page), "0", "and it waits again");
  await assertRests(page, "R", ROOK);
});

test("once all six are met, the next piece comes round again and its shadows need 2 moves", { skip }, async (t) => {
  const page = await openWith(t, { met: ["R", "B", "Q", "K", "N", "P"], piece: "P", round: 0, filled: [{ c: 3, r: 4 }, { c: 3, r: 3 }, { c: 3, r: 2 }] });
  assert.deepEqual(await trayState(page), ["R:met+bob", "B:met", "Q:met", "K:met", "N:met", "P:met+here"], "the rook bobs");
  await page.locator('.piece[aria-label="Rook"]').waitFor({ timeout: 5000 });
  await quiet(page);
  await page.waitForTimeout(900);
  assert.deepEqual(await trayState(page), ["R:met+here", "B:met", "Q:met", "K:met", "N:met", "P:met"]);
  await page.screenshot({ path: path.join(ARTIFACTS, "chess-tray-all-phone.png") });
  assert.equal((await saved(page)).round, 1);
  await freePlay(page, "R");
  const sq = await goal(page);
  const { at } = await state(page);
  assert.equal(distance(position("R", at), "a", sq), 2, "two moves away");
});

test("with reduced motion the next piece bobs as a glow and fades in", { skip }, async (t) => {
  const page = await open(t);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const chess = { met: ["R"], piece: "R", round: 0, filled: [{ c: 0, r: 4 }, { c: 3, r: 1 }] };
  await page.evaluate((chess) => localStorage.setItem("ddp-kids", JSON.stringify({ version: 1, sound: true, progress: { chess } })), chess);
  await page.reload();
  await page.locator(".piece").waitFor();
  await quiet(page);
  await fill(page);
  assert.equal(await page.locator('.slot[data-type="B"] svg').evaluate((el) => getComputedStyle(el).animationName), "glow");
  await page.locator('.piece[aria-label="Bishop"]').waitFor({ timeout: 5000 });
  assert.equal(await page.locator(".piece").evaluate((el) => getComputedStyle(el).translate), "none", "it doesn't travel");
  await quiet(page);
  await page.waitForTimeout(600);
  await assertRests(page, "B", BISHOP);
});

for (const device of Object.keys(DEVICES)) {
  test(`the tray passes every guard on ${device}, with a shadow and filled squares`, { skip }, async (t) => {
    const page = await openWith(t, { met: ["R", "B", "Q", "K", "N", "P"], piece: "Q", round: 1, filled: [{ c: 0, r: 0 }, { c: 6, r: 6 }] }, device);
    await goal(page);
    await page.waitForTimeout(500);
    await assertNoWords(page);
    await assertNoSideScroll(page);
    await assertBigTargets(page);
    const { width, height } = DEVICES[device];
    const [home, board, dock] = await Promise.all([".home", ".board", ".dock"].map((s) => page.locator(s).evaluate((el) => el.getBoundingClientRect().toJSON())));
    const apart = (a, b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
    assert.ok(dock.left >= 0 && dock.right <= width && dock.top >= 0 && dock.bottom <= height, `the tray is on the screen: ${JSON.stringify(dock)}`);
    assert.ok(apart(dock, board) && apart(dock, home) && apart(board, home), "the tray, the board and the home button don't overlap");
    await page.screenshot({ path: path.join(ARTIFACTS, `chess-tray-${device}.png`) });
  });
}
