import test from "node:test";
import assert from "node:assert/strict";
import { LESSONS, shadowSquares } from "./lessons.js";
import { distance, key, moves } from "./rules.js";

const position = (type, at) => ({ cols: 8, rows: 8, pieces: [{ id: "a", type, side: "you", at }] });
const far = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
const SQUARES = Array.from({ length: 64 }, (_, i) => ({ c: i % 8, r: Math.floor(i / 8) }));

test("every piece's stage has free moves, shadows and a distance for both rounds", () => {
  assert.deepEqual(LESSONS.map((l) => l.type), ["R", "B", "Q", "K", "N", "P"]);
  for (const l of LESSONS) {
    assert.ok(l.free > 0 && l.shadows > 0, l.type);
    assert.deepEqual(l.distance, [1, 2], l.type);
  }
});

test("from its start, every shadow is exactly the round's distance away", () => {
  for (const lesson of LESSONS) {
    for (const round of [0, 1]) {
      const squares = shadowSquares(lesson, lesson.start, round);
      assert.ok(squares.length, `${lesson.type} round ${round + 1}`);
      for (const sq of squares) {
        assert.equal(distance(position(lesson.type, lesson.start), "a", sq), lesson.distance[round], `${lesson.type} round ${round + 1} ${key(sq)}`);
      }
    }
  }
});

test("from every square, every shadow is the round's distance away, or the farthest there is", () => {
  for (const lesson of LESSONS) {
    for (const at of SQUARES) {
      const p = position(lesson.type, at);
      if (!moves(p, "a").length) {
        assert.deepEqual(shadowSquares(lesson, at, 0), [], `${lesson.type} on ${key(at)} can't move`);
        continue;
      }
      const away = SQUARES.map((sq) => distance(p, "a", sq)).filter((d) => d > 0 && d < Infinity);
      for (const round of [0, 1]) {
        const want = Math.max(...away.filter((d) => d <= lesson.distance[round]));
        const squares = shadowSquares(lesson, at, round);
        assert.ok(squares.length, `${lesson.type} on ${key(at)}, round ${round + 1}`);
        for (const sq of squares) assert.equal(distance(p, "a", sq), want, `${lesson.type} on ${key(at)}, round ${round + 1}: ${key(sq)}`);
        // 2 or more squares off when any square that far is.
        const could = SQUARES.some((sq) => distance(p, "a", sq) === want && far(sq, at) >= 2);
        if (could) for (const sq of squares) assert.ok(far(sq, at) >= 2, `${lesson.type} on ${key(at)}, round ${round + 1}: ${key(sq)} is near`);
      }
    }
  }
});

test("a shadow skips filled squares while there are others", () => {
  const rook = LESSONS[0];
  const all = shadowSquares(rook, rook.start, 0);
  const filled = all.slice(0, 3);
  const left = shadowSquares(rook, rook.start, 0, filled);
  assert.ok(left.length);
  for (const sq of left) assert.ok(!filled.some((f) => key(f) === key(sq)), key(sq));

  // A pawn on its start has one square 2 rows up; filled, it goes 1 row up.
  const pawn = LESSONS.find((l) => l.type === "P");
  const [two] = shadowSquares(pawn, pawn.start, 0);
  assert.deepEqual(two, { c: pawn.start.c, r: pawn.start.r - 2 });
  assert.deepEqual(shadowSquares(pawn, pawn.start, 0, [two]), [{ c: pawn.start.c, r: pawn.start.r - 1 }]);
  // With every square filled, it still finds one.
  assert.deepEqual(shadowSquares(pawn, pawn.start, 0, [two, { c: pawn.start.c, r: pawn.start.r - 1 }]), [two]);
});
