// The chess playground: one piece on an empty board that the child moves
// freely. Sage dots ripple out to every square it can go to; a tap on a dot,
// or a drag there, moves it, and any other square makes it wiggle. When a
// piece comes in, the ghost hand shows one move and leaves the piece's dashed
// shadow on that square until the child moves. A pawn on the far row walks
// back to its start.
// After a few free moves, a honey shadow of the piece waits on a square it
// can reach (lessons.js says how far): landing there fills it, and a pip on
// the tray. If the child waits a while, the hand shows the way. Once the
// shadows are filled, the next piece bobs on the tray, the piece walks to its
// slot and the next one rolls out. A tap on the tray brings back a piece met
// before. Progress is saved in prefs, so the page opens where the child left
// it. ?piece=B (or Q, K, N, P) brings in another piece; the rook is the first.
// In round 2, still ink pawns stand in the way of the shadows, and after the
// shadows come capture stages: landing on an ink pawn tips it into the bowl,
// and a clear board plays the chime, empties the bowl and brings the next.
import { createBoard, reducedMotion, sleep, token } from "/engine/board.js";
import { createHand } from "/engine/hand.js";
import { listen } from "/engine/input.js";
import { workOffline } from "/engine/offline.js";
import { addParentCorner } from "/engine/parent.js";
import { getPrefs, setPrefs } from "/engine/prefs.js";
import { play } from "/engine/sound.js";
import { INK, LESSONS, shadowSquares } from "./lessons.js";
import { DEFS, NAMES, art } from "./pieces.js";
import { distance, moves } from "./rules.js";

const ID = "you";
const TYPES = LESSONS.map((l) => l.type);
const same = (a, b) => a?.c === b?.c && a?.r === b?.r;
const onBoard = (sq) => [sq?.c, sq?.r].every((n) => Number.isInteger(n) && n >= 0 && n < 8);

// The saved progress: the pieces met, the one on the board, its round (0, or
// 1 once all six were met), the squares it filled and the capture stages it
// cleared. Anything else is a fresh start with the rook.
function load() {
  const p = getPrefs().progress.chess;
  const lesson = LESSONS.find((l) => l.type === p?.piece);
  const ok =
    lesson &&
    Array.isArray(p.met) &&
    p.met.includes(p.piece) &&
    p.met.every((t) => TYPES.includes(t)) &&
    Number.isInteger(p.round) &&
    p.round >= 0 &&
    p.round < lesson.distance.length &&
    Array.isArray(p.filled) &&
    p.filled.length <= lesson.shadows &&
    p.filled.every(onBoard) &&
    Number.isInteger(p.cleared ?? 0) &&
    (p.cleared ?? 0) >= 0 &&
    (p.cleared ?? 0) <= lesson.captures.length;
  return ok ? { cleared: 0, ...p } : { met: [TYPES[0]], piece: TYPES[0], round: 0, filled: [], cleared: 0 };
}
let { met, piece: type, round, filled, cleared } = load();
const lesson = () => LESSONS.find((l) => l.type === type);
const save = () => setPrefs({ progress: { ...getPrefs().progress, chess: { met, piece: type, round, filled, cleared } } });
// The capture stage on now, as its ink pawns' squares: in round 2, once the
// shadows are filled, until the last stage is cleared.
const capture = () => (round === 1 && filled.length === lesson().shadows ? (lesson().captures[cleared] ?? null) : null);

// Free moves so far, before the first shadow.
let free = 0;
// Piece t comes to the board: in round 2 when all six were met before.
function meet(t) {
  round = met.length === TYPES.length ? 1 : 0;
  if (!met.includes(t)) met = [...met, t];
  type = t;
  filled = [];
  cleared = 0;
  free = 0;
  save();
}
const wanted = new URLSearchParams(location.search).get("piece");
if (TYPES.includes(wanted) && wanted !== type) meet(wanted);

document.body.insertAdjacentHTML("afterbegin", DEFS);
addParentCorner();
workOffline();
const board = createBoard(document.getElementById("field"), { label: "Chess board" });
const hand = createHand(board);
const tray = document.getElementById("tray");
const pips = document.getElementById("pips");
const bowl = document.getElementById("bowl");
// Where the hand left the piece's shadow, until the child moves.
let shadow = null;
// The shadow to fill.
let goal = null;
let busy = false;
// When the piece last wiggled: one wiggle at a time, so fast taps never make
// it flicker. Slots on the tray share it.
let wiggled = -Infinity;
let idle = 0;
// The ink pawns standing on the board, by id.
let ink = [];
let inks = 0;

const position = (at = board.where(ID)) => ({
  cols: board.cols,
  rows: board.rows,
  pieces: [{ id: ID, type, side: "you", at }, ...ink.map((id) => ({ id, type: INK, side: "ink", at: board.where(id) }))],
});
const reach = () => moves(position(), ID);
const away = (sq) => distance(position(), ID, sq);
// In a capture stage, no ink pawn left that the piece can reach (a pawn that
// went past them).
const stuck = () => Boolean(capture()) && ink.length > 0 && !ink.some((id) => away(board.where(id)) < Infinity);
// No dot where a shadow already shows the way.
const dots = () => board.dots(reach().filter((sq) => !same(sq, shadow) && !same(sq, goal)), board.where(ID));
// The piece after this one: the first not met yet, or once all are met, the
// next in order.
const next = () => TYPES.find((t) => !met.includes(t)) ?? TYPES[(TYPES.indexOf(type) + 1) % TYPES.length];

for (const t of TYPES) {
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = "slot";
  slot.dataset.type = t;
  slot.setAttribute("aria-label", NAMES[t]);
  slot.innerHTML = art(t);
  slot.addEventListener("click", () => pick(t, slot));
  tray.append(slot);
}

// The tray: the pieces met in colour, the one on the board leaving its slot
// empty; the next as an outline and the rest faint. The pips under it count
// the filled shadows, once there is one to fill.
function showTray(bob = false) {
  const coming = next();
  for (const slot of tray.children) {
    const t = slot.dataset.type;
    slot.classList.toggle("met", met.includes(t));
    slot.classList.toggle("here", t === type);
    slot.classList.toggle("next", t === coming && !met.includes(t));
    slot.classList.toggle("bob", bob && t === coming);
    slot.setAttribute("aria-disabled", String(!met.includes(t) || t === type));
  }
  if (pips.children.length !== lesson().shadows) pips.replaceChildren(...Array.from({ length: lesson().shadows }, () => document.createElement("i")));
  [...pips.children].forEach((pip, i) => pip.classList.toggle("on", i < filled.length));
  pips.classList.toggle("on", Boolean(goal) || filled.length > 0);
  bowl.classList.toggle("on", round === 1);
}

// Ink pawns stand on these squares, in place of any there were.
function stand(squares) {
  for (const id of ink) board.remove(id);
  ink = squares.map((sq) => {
    const id = `ink${inks++}`;
    board.place(id, art(INK, "ink"), sq, `Ink ${NAMES[INK].toLowerCase()}`, { still: true });
    return id;
  });
}

// The piece lands on an ink pawn: it tips over and rolls into the bowl.
async function take(id) {
  ink = ink.filter((i) => i !== id);
  const spot = document.createElement("i");
  spot.innerHTML = art(INK, "ink");
  bowl.append(spot);
  await board.roll(id, spot.getBoundingClientRect());
  spot.classList.add("in");
  play("take");
}

// The bowl empties back into the box.
async function empty() {
  if (!bowl.children.length) return;
  bowl.classList.add("empty");
  await sleep(token("roll"));
  bowl.replaceChildren();
  bowl.classList.remove("empty");
}

// Where the hint shows the way: the shadow, or in a capture stage the
// nearest ink pawn.
function target() {
  if (goal || !capture()) return goal;
  const near = ink.map((id) => board.where(id)).filter((sq) => away(sq) < Infinity);
  return near.sort((a, b) => away(a) - away(b))[0] ?? null;
}

// The only hint: when the child does nothing for a while with a shadow or
// an ink pawn waiting, the hand shows the way there. One at a time; any
// touch or key starts the wait again.
function rest() {
  clearTimeout(idle);
  if (target()) idle = setTimeout(hint, token("idle"));
}
for (const name of ["pointerdown", "keydown"]) addEventListener(name, rest, { capture: true });

// The hand's way to a square, one drag for each move.
function route(to) {
  const steps = [];
  for (let at = board.where(ID), d = distance(position(at), ID, to); d > 0 && d < Infinity; d--) {
    at = moves(position(at), ID).find((sq) => distance(position(sq), ID, to) === d - 1);
    steps.push({ type: "drag", square: at });
  }
  return steps;
}

async function hint() {
  const to = target();
  if (busy || !to) return rest();
  await hand.show([{ type: "press", square: board.where(ID) }, ...route(to), { type: "release" }, { type: "return" }]);
  rest();
}

// A new shadow to fill, on a square lessons.js picks.
function aim() {
  const squares = shadowSquares(lesson(), board.where(ID), round, filled, ink.map(board.where));
  goal = squares[Math.floor(Math.random() * squares.length)] ?? null;
  if (goal) board.mark("shadow", goal, art(type));
  showTray();
  rest();
}

// When a piece comes in, the hand shows a move 3 squares away, else 2, else
// the nearest there is, onto an empty square, and leaves the piece's shadow
// there. With a shadow to fill or an ink pawn to take, it shows the way
// there instead.
async function welcome() {
  if (target()) return hint();
  const at = board.where(ID);
  const far = (sq) => Math.max(Math.abs(sq.c - at.c), Math.abs(sq.r - at.r));
  const open = reach().filter((sq) => board.pieceAt(sq) === null);
  const demo = [3, 2, 1].map((n) => open.find((sq) => far(sq) === n)).find(Boolean);
  if (await hand.show([{ type: "press", square: at }, { type: "drag", square: demo }, { type: "release" }, { type: "return" }])) {
    shadow = demo;
    board.mark("shadow", demo, art(type));
    dots();
  }
}

async function go(to) {
  busy = true;
  clearTimeout(idle);
  if (shadow) {
    shadow = null;
    board.clear("shadow");
  }
  board.dots([]);
  const taken = ink.find((id) => same(board.where(id), to));
  const stage = capture();
  await board.move(ID, to, type === "N" ? "hop" : "slide");
  board.land(ID);
  play("land");
  if (taken) await take(taken);
  if (same(to, goal)) {
    // The piece fits its shadow: it fills with honey, and so does a pip.
    goal = null;
    filled = [...filled, to];
    save();
    board.mark("fill", to);
    play("fit");
    showTray();
  } else if (!goal) {
    free++;
  }
  // A pawn can't go on from the far row, or to an ink pawn it went past:
  // after a moment it walks back.
  if (type === "P" && (to.r === 0 || stuck())) {
    await sleep(token("walk-wait"));
    await board.move(ID, lesson().start, "walk");
  }
  if (!stage && filled.length === lesson().shadows) return capture() ? capturing() : done();
  if (stage && !ink.length) return clear();
  // Still none it can reach: the stage starts again.
  if (stuck()) return capturing();
  // A shadow the piece can no longer reach (one a pawn passed) moves.
  if (goal && distance(position(), ID, goal) === Infinity) {
    goal = null;
    board.clear("shadow");
  }
  if (!stage && !goal && (filled.length > 0 || free >= lesson().free)) aim();
  busy = false;
  dots();
  rest();
}

// A capture stage: the bowl empties, the piece walks back to its start and
// the stage's ink pawns stand on the board.
async function capturing() {
  busy = true;
  clearTimeout(idle);
  goal = null;
  await sleep(token("walk-wait"));
  board.clear();
  await empty();
  await board.move(ID, lesson().start, "walk");
  stand(capture());
  play("arrive");
  busy = false;
  dots();
  await welcome();
}

// The board is clear: the chime, and the next stage, or once they are all
// cleared, the next piece.
async function clear() {
  busy = true;
  play("fit");
  cleared++;
  save();
  if (capture()) return capturing();
  await empty();
  return done();
}

// Every shadow is filled, or in round 2 every stage cleared: the next piece
// bobs on the tray, and then comes.
async function done() {
  busy = true;
  showTray(true);
  await sleep(token("next-wait"));
  await bring(next());
}

// How far piece t's slot on the tray is from the piece on the board, in px.
function toSlot(t) {
  const a = board.rect(board.where(ID));
  const b = tray.querySelector(`[data-type="${t}"]`).getBoundingClientRect();
  return [b.left + b.width / 2 - (a.left + a.width / 2), b.top + b.height / 2 - (a.top + a.height / 2)];
}

// The piece walks to its slot on the tray, and t rolls out from its slot to
// its start square. With reduced motion, t fades in there instead.
async function bring(t) {
  busy = true;
  clearTimeout(idle);
  goal = shadow = null;
  board.dots([]);
  board.clear("shadow");
  stand([]);
  bowl.replaceChildren();
  const motion = !reducedMotion();
  if (motion) {
    board.drag(ID, ...toSlot(type), token("walk"));
    await sleep(token("walk"));
  }
  board.clear();
  meet(t);
  showTray();
  board.place(ID, art(t), lesson().start, NAMES[t]);
  stand(round === 1 ? lesson().blockers : []);
  play("arrive");
  if (motion) {
    board.drag(ID, ...toSlot(t));
    await board.move(ID, lesson().start, "walk");
  }
  board.land(ID);
  busy = false;
  dots();
  await welcome();
}

// A tap on the tray: a piece met before comes back; any other slot wiggles.
function pick(t, slot) {
  if (busy) return;
  if (met.includes(t) && t !== type) return bring(t);
  if (performance.now() - wiggled < token("wiggle")) return;
  wiggled = performance.now();
  slot.classList.remove("wiggle");
  void slot.offsetWidth;
  slot.classList.add("wiggle");
  play("nope");
}

listen(board, (e) => {
  if (busy) return false;
  const to = e.type === "drop" ? e.to : e.square;
  if (to && reach().some((sq) => same(sq, to))) {
    go(to);
    return true;
  }
  // A wrong square wiggles; tapping the piece, or putting it back, doesn't.
  if ((e.type === "tap" ? e.id !== ID : !same(e.to, e.from)) && performance.now() - wiggled >= token("wiggle")) {
    wiggled = performance.now();
    board.wiggle(ID);
    play("nope");
  }
});

board.place(ID, art(type), lesson().start, NAMES[type]);
showTray();
if (capture()) {
  stand(capture());
  dots();
  await welcome();
} else if (filled.length === lesson().shadows) {
  for (const sq of filled) board.mark("fill", sq);
  done();
} else {
  for (const sq of filled) board.mark("fill", sq);
  if (round === 1) stand(lesson().blockers);
  if (filled.length) aim();
  dots();
  await welcome();
}
