// Where chess pieces can go, for the playground and the tiny games. Pure: no
// DOM, randomness, clock or storage. A board is cols x rows, 8x8 or smaller;
// squares are { c, r } with r = 0 at the top. "you" moves up, toward r = 0,
// and "ink" moves down. No check, castling, en passant or promotion yet: a
// pawn on the far row just stays.

export class RuleError extends Error {
  name = "RuleError";
}

const STRAIGHT = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAGONAL = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const SLIDES = { R: STRAIGHT, B: DIAGONAL, Q: [...STRAIGHT, ...DIAGONAL] };
const STEPS = {
  K: [...STRAIGHT, ...DIAGONAL],
  N: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
};

// A square as a string, for sets: attacked() returns these.
export const key = ({ c, r }) => `${c},${r}`;

const same = (a, b) => a.c === b?.c && a.r === b?.r;
const onBoard = (position, { c, r }) => c >= 0 && c < position.cols && r >= 0 && r < position.rows;
const pieceAt = (position, sq) => position.pieces.find((p) => same(p.at, sq));
const ahead = (side) => (side === "you" ? -1 : 1);
const startRow = (position, side) => (side === "you" ? position.rows - 2 : 1);

function find(position, id) {
  const piece = position.pieces.find((p) => p.id === id);
  if (!piece) throw new RuleError(`no piece ${id}`);
  return piece;
}

// The squares the piece could capture on, own pieces included: a slide ends
// on the first piece it meets.
function reach(position, piece) {
  const { c, r } = piece.at;
  if (piece.type === "P") {
    const dr = ahead(piece.side);
    return [{ c: c - 1, r: r + dr }, { c: c + 1, r: r + dr }].filter((sq) => onBoard(position, sq));
  }
  if (STEPS[piece.type]) return STEPS[piece.type].map(([dc, dr]) => ({ c: c + dc, r: r + dr })).filter((sq) => onBoard(position, sq));
  if (!SLIDES[piece.type]) throw new RuleError(`unknown type ${piece.type}`);
  const squares = [];
  for (const [dc, dr] of SLIDES[piece.type]) {
    for (let sq = { c: c + dc, r: r + dr }; onBoard(position, sq); sq = { c: sq.c + dc, r: sq.r + dr }) {
      squares.push(sq);
      if (pieceAt(position, sq)) break;
    }
  }
  return squares;
}

// Every square the piece can go to.
export function moves(position, id) {
  const piece = find(position, id);
  const captures = reach(position, piece).filter((sq) => pieceAt(position, sq)?.side !== piece.side);
  if (piece.type !== "P") return captures;
  const steps = [];
  const dr = ahead(piece.side);
  const one = { c: piece.at.c, r: piece.at.r + dr };
  const two = { c: piece.at.c, r: piece.at.r + 2 * dr };
  if (onBoard(position, one) && !pieceAt(position, one)) {
    steps.push(one);
    if (piece.at.r === startRow(position, piece.side) && onBoard(position, two) && !pieceAt(position, two)) steps.push(two);
  }
  return [...steps, ...captures.filter((sq) => pieceAt(position, sq))];
}

// Moves the piece to a square moves() allows. Returns the new position and
// the captured piece's id or null; the old position stays as it was.
export function play(position, id, to) {
  const piece = find(position, id);
  if (!moves(position, id).some((sq) => same(sq, to))) throw new RuleError(`${id} can't go to ${JSON.stringify(to)}`);
  const target = pieceAt(position, to);
  const pieces = position.pieces.filter((p) => p !== target).map((p) => (p === piece ? { ...p, at: { c: to.c, r: to.r } } : p));
  return { position: { ...position, pieces }, captured: target ? target.id : null };
}

// The fewest moves for the piece to reach a square if nothing else moves, or
// Infinity. It never captures on the way; the last move may capture.
export function distance(position, id, to) {
  const piece = find(position, id);
  if (same(piece.at, to)) return 0;
  const seen = new Set([key(piece.at)]);
  let ring = [piece.at];
  for (let d = 1; ring.length; d++) {
    const next = [];
    for (const at of ring) {
      const there = { ...position, pieces: position.pieces.map((p) => (p === piece ? { ...p, at } : p)) };
      for (const sq of moves(there, id)) {
        if (same(sq, to)) return d;
        if (pieceAt(position, sq) || seen.has(key(sq))) continue;
        seen.add(key(sq));
        next.push(sq);
      }
    }
    ring = next;
  }
  return Infinity;
}

// Every square the side attacks, as key()s: where its pieces could capture,
// own pieces included. Pawns attack diagonally only.
export function attacked(position, side) {
  return new Set(position.pieces.filter((p) => p.side === side).flatMap((p) => reach(position, p).map(key)));
}
