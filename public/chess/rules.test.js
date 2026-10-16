import test from "node:test";
import assert from "node:assert/strict";
import { RuleError, attacked, distance, key, moves, play } from "./rules.js";

const keys = (squares) => squares.map(key).sort();

// One piece, id "a", on an empty n x n board.
const alone = (type, side, at, n) => ({ cols: n, rows: n, pieces: [{ id: "a", type, side, at }] });

// A board drawn as text, top row first: "." is an empty square, "x" an empty
// square the piece under test can go to, a capital letter a "you" piece and a
// small letter an "ink" piece. A piece's id is its letter, with 2, 3, … added
// for later pieces with the same letter.
function board(text) {
  const rows = text.trim().split("\n").map((line) => line.trim().split(/\s+/));
  const pieces = [];
  const dots = [];
  const count = {};
  rows.forEach((cells, r) => cells.forEach((ch, c) => {
    if (ch === "x") dots.push({ c, r });
    if (ch === "x" || ch === ".") return;
    count[ch] = (count[ch] ?? 0) + 1;
    pieces.push({ id: count[ch] > 1 ? ch + count[ch] : ch, type: ch.toUpperCase(), side: ch === ch.toUpperCase() ? "you" : "ink", at: { c, r } });
  }));
  return { position: { cols: rows[0].length, rows: rows.length, pieces }, dots };
}

// Piece id can go to exactly the x squares and capture the pieces in takes.
function assertDots(text, id, ...takes) {
  const { position, dots } = board(text);
  const taken = takes.map((t) => position.pieces.find((p) => p.id === t).at);
  assert.deepEqual(keys(moves(position, id)), keys([...dots, ...taken]));
}

// Where each piece goes on an empty board, by its shape (dc, dr from the piece).
const SHAPES = {
  R: (dc, dr) => dc === 0 || dr === 0,
  B: (dc, dr) => Math.abs(dc) === Math.abs(dr),
  Q: (dc, dr) => dc === 0 || dr === 0 || Math.abs(dc) === Math.abs(dr),
  K: (dc, dr) => Math.max(Math.abs(dc), Math.abs(dr)) === 1,
  N: (dc, dr) => Math.abs(dc * dr) === 2,
};

test("rooks, bishops, queens, kings and knights in the centre, a corner and on an edge, on 8x8 and 5x5", () => {
  for (const n of [8, 5]) {
    const mid = Math.floor(n / 2);
    for (const at of [{ c: mid, r: mid }, { c: n - 1, r: n - 1 }, { c: 0, r: mid }]) {
      for (const [type, shape] of Object.entries(SHAPES)) {
        const want = [];
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if ((c !== at.c || r !== at.r) && shape(c - at.c, r - at.r)) want.push({ c, r });
        for (const side of ["you", "ink"]) assert.deepEqual(keys(moves(alone(type, side, at, n), "a")), keys(want), `${type} ${side} at ${key(at)} on ${n}x${n}`);
      }
    }
  }
});

test("pawns in the centre, a corner and on an edge, on 8x8 and 5x5", () => {
  for (const n of [8, 5]) {
    const mid = Math.floor(n / 2);
    for (const [side, at, want] of [
      ["you", { c: mid, r: mid }, [{ c: mid, r: mid - 1 }]],
      ["you", { c: n - 1, r: n - 1 }, [{ c: n - 1, r: n - 2 }]],
      ["you", { c: 0, r: n - 2 }, [{ c: 0, r: n - 3 }, { c: 0, r: n - 4 }]],
      ["ink", { c: mid, r: mid }, [{ c: mid, r: mid + 1 }]],
      ["ink", { c: 0, r: 0 }, [{ c: 0, r: 1 }]],
      ["ink", { c: n - 1, r: 1 }, [{ c: n - 1, r: 2 }, { c: n - 1, r: 3 }]],
    ]) assert.deepEqual(keys(moves(alone("P", side, at, n), "a")), keys(want), `${side} at ${key(at)} on ${n}x${n}`);
  }
});

test("a rook stops before its own side and on the other side", () => {
  assertDots(`
    . . P . .
    . . x . .
    . p r x N
    . . x . .
    . . x . .
  `, "r", "P", "N");
});

test("a bishop stops before its own side and on the other side", () => {
  assertDots(`
    p . . . P
    . x . x .
    . . B . .
    . x . x .
    x . . . N
  `, "B", "p");
});

test("a queen stops before its own side and on the other side", () => {
  assertDots(`
    p . p . x .
    . x x x . .
    x x Q n r .
    . P x x . .
    . . x . x .
    . . x . . x
  `, "Q", "p", "p2", "n");
});

test("a knight jumps over pieces", () => {
  assertDots(`
    . P . n .
    x P p P x
    . p N p .
    x P p P x
    . x . x .
  `, "N", "n");
});

test("a pawn steps two from its start row and one after that, both sides", () => {
  assertDots(`
    . . . . .
    . x . . .
    . x . . .
    . P . . .
    . . . . .
  `, "P");
  assertDots(`
    . . . . .
    . x . . .
    . P . . .
    . . . . .
    . . . . .
  `, "P");
  assertDots(`
    . . . . .
    . p . . .
    . x . . .
    . x . . .
    . . . . .
  `, "p");
  assertDots(`
    . . . . .
    . . . . .
    . p . . .
    . x . . .
    . . . . .
  `, "p");
});

test("a pawn's double step is blocked halfway and at the end, both sides", () => {
  assertDots(`
    . . . . .
    . . . . .
    . n . . .
    . P . . .
    . . . . .
  `, "P");
  assertDots(`
    . . . . .
    . N . . .
    . x . . .
    . P . . .
    . . . . .
  `, "P");
  assertDots(`
    . . . . .
    . p . . .
    . N . . .
    . . . . .
    . . . . .
  `, "p");
  assertDots(`
    . . . . .
    . p . . .
    . x . . .
    . n . . .
    . . . . .
  `, "p");
});

test("a pawn captures diagonally forward, never straight ahead, both sides", () => {
  assertDots(`
    . . . . .
    . . . . .
    n r N . .
    . P . . .
    n . n . .
  `, "P", "n");
  assertDots(`
    N . N . .
    . p . . .
    n R N . .
    . . . . .
    . . . . .
  `, "p", "N3");
});

test("a pawn on the far row stays, both sides", () => {
  const { position } = board(`
    . p P n .
    . . . . .
    . . . . .
    . . . . .
    . N p P .
  `);
  assert.deepEqual(moves(position, "P"), []);
  assert.deepEqual(moves(position, "p2"), []);
});

test("moves() throws RuleError for an unknown id or type", () => {
  assert.throws(() => moves(alone("R", "you", { c: 0, r: 0 }, 5), "b"), RuleError);
  assert.throws(() => moves(alone("X", "you", { c: 0, r: 0 }, 5), "a"), RuleError);
});

test("play() moves and captures without changing the old position", () => {
  const { position } = board(`
    . . . . .
    . . n . .
    . . . . .
    . . R . .
    . . . . .
  `);
  const before = structuredClone(position);
  const take = play(position, "R", { c: 2, r: 1 });
  assert.equal(take.captured, "n");
  assert.deepEqual(take.position, { cols: 5, rows: 5, pieces: [{ id: "R", type: "R", side: "you", at: { c: 2, r: 1 } }] });
  const step = play(position, "R", { c: 0, r: 3 });
  assert.equal(step.captured, null);
  assert.deepEqual(step.position.pieces.map((p) => [p.id, key(p.at)]), [["n", "2,1"], ["R", "0,3"]]);
  assert.deepEqual(position, before);
});

test("play() throws RuleError for an unknown id or a square moves() doesn't allow", () => {
  const { position } = board(`
    . . n . .
    . . . . .
    . . R . .
    . . P . .
    . . . . .
  `);
  assert.throws(() => play(position, "Q", { c: 2, r: 1 }), RuleError);
  for (const to of [{ c: 3, r: 1 }, { c: 2, r: 3 }, { c: 2, r: 2 }, { c: 5, r: 2 }, undefined]) {
    assert.throws(() => play(position, "R", to), RuleError, JSON.stringify(to));
  }
});

test("distance() is 1 and 2 for each piece", () => {
  for (const [type, side, at, one, two] of [
    ["R", "you", { c: 0, r: 4 }, { c: 0, r: 0 }, { c: 4, r: 0 }],
    ["B", "you", { c: 0, r: 4 }, { c: 4, r: 0 }, { c: 2, r: 4 }],
    ["Q", "you", { c: 0, r: 4 }, { c: 4, r: 0 }, { c: 1, r: 2 }],
    ["K", "you", { c: 2, r: 2 }, { c: 3, r: 3 }, { c: 4, r: 4 }],
    ["N", "you", { c: 0, r: 4 }, { c: 1, r: 2 }, { c: 2, r: 4 }],
    ["P", "you", { c: 2, r: 3 }, { c: 2, r: 1 }, { c: 2, r: 0 }],
    ["P", "ink", { c: 2, r: 1 }, { c: 2, r: 3 }, { c: 2, r: 4 }],
  ]) {
    const position = alone(type, side, at, 5);
    assert.equal(distance(position, "a", at), 0, `${type} ${side} stays`);
    assert.equal(distance(position, "a", one), 1, `${type} ${side} to ${key(one)}`);
    assert.equal(distance(position, "a", two), 2, `${type} ${side} to ${key(two)}`);
  }
});

test("distance() is Infinity for a bishop's other colour and a pawn going backwards", () => {
  assert.equal(distance(alone("B", "you", { c: 0, r: 4 }, 5), "a", { c: 1, r: 4 }), Infinity);
  assert.equal(distance(alone("P", "you", { c: 2, r: 3 }, 5), "a", { c: 2, r: 4 }), Infinity);
  assert.equal(distance(alone("P", "ink", { c: 2, r: 1 }, 5), "a", { c: 2, r: 0 }), Infinity);
  assert.equal(distance(alone("P", "you", { c: 2, r: 3 }, 5), "a", { c: 3, r: 2 }), Infinity);
});

test("distance() goes around pieces and only captures on the last move", () => {
  const { position } = board(`
    . . . . .
    . . . . .
    n . . . .
    . . . . .
    R . . . .
  `);
  assert.equal(distance(position, "R", { c: 0, r: 0 }), 3);
  assert.equal(distance(position, "R", { c: 0, r: 2 }), 1);
  const pawn = board(`
    . . . . .
    . . . . .
    . . n . .
    . P . . .
    . . . . .
  `).position;
  assert.equal(distance(pawn, "P", { c: 2, r: 2 }), 1);
  const boxed = board(`
    . . . . .
    . . . . .
    . . . . .
    P . . . .
    R P . . .
  `).position;
  assert.equal(distance(boxed, "R", { c: 4, r: 4 }), Infinity);
  assert.throws(() => distance(boxed, "Q", { c: 4, r: 4 }), RuleError);
});

test("attacked(): pawns attack diagonally only, sliders up to the first piece", () => {
  const { position } = board(`
    . . . . .
    . . p . .
    n . P . .
    . . . . .
    R . P . .
  `);
  assert.deepEqual([...attacked(position, "you")].sort(), ["0,2", "0,3", "1,1", "1,3", "1,4", "2,4", "3,1", "3,3"]);
  assert.deepEqual([...attacked(position, "ink")].sort(), ["1,0", "1,2", "1,4", "2,1", "2,3", "3,2"]);
});
