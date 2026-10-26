// The playground's stages, as data: the pieces in the order a child meets
// them, each with its start square on the 8x8 board. Squares are { c, r }
// from the top left; the child's pawn starts on its start row and walks up.
// Each piece's stage has the same steps:
//   free       moves of free play before its first shadow
//   shadows    shadows it fills before the next piece comes
//   distance   how many moves a shadow needs, in round 1 and round 2 (a
//              piece met again once all six are met)
// Round 2 brings still ink pawns (INK), which never move:
//   blockers   stand in the way while the shadows wait
//   captures   stages after the shadows, of 1, 2 and 3 pawns to take from
//              the start square; each taken pawn rolls into the bowl, which
//              empties when the board is clear
import { distance } from "./rules.js";

export const INK = "P";

const STEPS = { free: 3, shadows: 3, distance: [1, 2] };
const on = (...squares) => squares.map(([c, r]) => ({ c, r }));

export const LESSONS = [
  { type: "R", start: { c: 3, r: 4 }, ...STEPS, blockers: on([3, 2], [5, 4]), captures: [on([3, 1]), on([6, 4], [6, 1]), on([3, 1], [1, 1], [1, 6])] },
  { type: "B", start: { c: 3, r: 4 }, ...STEPS, blockers: on([5, 2], [1, 6]), captures: [on([5, 2]), on([1, 2], [5, 6]), on([1, 2], [5, 2], [6, 5])] },
  { type: "Q", start: { c: 3, r: 4 }, ...STEPS, blockers: on([3, 2], [5, 2]), captures: [on([6, 1]), on([3, 1], [0, 4]), on([0, 1], [6, 4], [3, 7])] },
  { type: "K", start: { c: 3, r: 4 }, ...STEPS, blockers: on([4, 3]), captures: [on([4, 3]), on([2, 3], [2, 5]), on([4, 3], [5, 2], [6, 1])] },
  // The knight jumps over the pawns next to it.
  { type: "N", start: { c: 3, r: 4 }, ...STEPS, blockers: on([3, 3], [4, 4]), captures: [on([4, 2]), on([5, 3], [1, 5]), on([4, 3], [4, 2], [2, 2])] },
  // None in a pawn's way: one straight ahead would leave it stuck.
  { type: "P", start: { c: 3, r: 6 }, ...STEPS, blockers: [], captures: [on([2, 5]), on([4, 5], [5, 4]), on([2, 5], [3, 4], [4, 3])] },
];

// Keeps the squares that pass, unless none do.
const prefer = (squares, pass) => (squares.some(pass) ? squares.filter(pass) : squares);

// The squares where the lesson's piece on `at` could get its next shadow in
// a round (0 or 1): the ones the round's distance away, or the farthest there
// are when none is (a pawn near the far row). Not on a filled square when
// there's another, and 2 or more squares away when it can be. Never on an
// ink pawn (`ink`, their squares): the piece goes round them.
export function shadowSquares(lesson, at, round, filled = [], ink = []) {
  const position = { cols: 8, rows: 8, pieces: [{ id: "a", type: lesson.type, side: "you", at }, ...ink.map((sq, i) => ({ id: i, type: INK, side: "ink", at: sq }))] };
  const squares = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (!ink.some((sq) => sq.c === c && sq.r === r)) squares.push({ c, r, d: distance(position, "a", { c, r }) });
  for (let d = lesson.distance[round]; d > 0; d--) {
    const there = squares.filter((sq) => sq.d === d).map(({ c, r }) => ({ c, r }));
    if (!there.length) continue;
    const open = prefer(there, (sq) => !filled.some((f) => f.c === sq.c && f.r === sq.r));
    return prefer(open, (sq) => Math.max(Math.abs(sq.c - at.c), Math.abs(sq.r - at.r)) >= 2);
  }
  return [];
}
