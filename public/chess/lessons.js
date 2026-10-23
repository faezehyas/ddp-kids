// The playground's stages, as data: the pieces in the order a child meets
// them, each with its start square on the 8x8 board. Squares are { c, r }
// from the top left; the child's pawn starts on its start row and walks up.
// Each piece's stage has the same steps:
//   free       moves of free play before its first shadow
//   shadows    shadows it fills before the next piece comes
//   distance   how many moves a shadow needs, in round 1 and round 2 (a
//              piece met again once all six are met)
import { distance } from "./rules.js";

const STEPS = { free: 3, shadows: 3, distance: [1, 2] };

export const LESSONS = [
  { type: "R", start: { c: 3, r: 4 }, ...STEPS },
  { type: "B", start: { c: 3, r: 4 }, ...STEPS },
  { type: "Q", start: { c: 3, r: 4 }, ...STEPS },
  { type: "K", start: { c: 3, r: 4 }, ...STEPS },
  { type: "N", start: { c: 3, r: 4 }, ...STEPS },
  { type: "P", start: { c: 3, r: 6 }, ...STEPS },
];

// Keeps the squares that pass, unless none do.
const prefer = (squares, pass) => (squares.some(pass) ? squares.filter(pass) : squares);

// The squares where the lesson's piece on `at` could get its next shadow in
// a round (0 or 1): the ones the round's distance away, or the farthest there
// are when none is (a pawn near the far row). Not on a filled square when
// there's another, and 2 or more squares away when it can be.
export function shadowSquares(lesson, at, round, filled = []) {
  const position = { cols: 8, rows: 8, pieces: [{ id: "a", type: lesson.type, side: "you", at }] };
  const squares = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) squares.push({ c, r, d: distance(position, "a", { c, r }) });
  for (let d = lesson.distance[round]; d > 0; d--) {
    const there = squares.filter((sq) => sq.d === d).map(({ c, r }) => ({ c, r }));
    if (!there.length) continue;
    const open = prefer(there, (sq) => !filled.some((f) => f.c === sq.c && f.r === sq.r));
    return prefer(open, (sq) => Math.max(Math.abs(sq.c - at.c), Math.abs(sq.r - at.r)) >= 2);
  }
  return [];
}
