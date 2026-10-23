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
import { createBoard, reducedMotion, sleep, token } from "/engine/board.js";
import { createHand } from "/engine/hand.js";
import { listen } from "/engine/input.js";
import { getPrefs, setPrefs } from "/engine/prefs.js";
import { play } from "/engine/sound.js";
import { LESSONS, shadowSquares } from "./lessons.js";
import { DEFS, NAMES, art } from "./pieces.js";
import { distance, moves } from "./rules.js";

const ID = "you";
const TYPES = LESSONS.map((l) => l.type);
const same = (a, b) => a?.c === b?.c && a?.r === b?.r;
const onBoard = (sq) => [sq?.c, sq?.r].every((n) => Number.isInteger(n) && n >= 0 && n < 8);

// The saved progress: the pieces met, the one on the board, its round (0, or
// 1 once all six were met) and the squares it filled. Anything else is a
// fresh start with the rook.
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
    p.filled.every(onBoard);
  return ok ? p : { met: [TYPES[0]], piece: TYPES[0], round: 0, filled: [] };
}
let { met, piece: type, round, filled } = load();
const lesson = () => LESSONS.find((l) => l.type === type);
const save = () => setPrefs({ progress: { ...getPrefs().progress, chess: { met, piece: type, round, filled } } });

// Free moves so far, before the first shadow.
let free = 0;
// Piece t comes to the board: in round 2 when all six were met before.
function meet(t) {
  round = met.length === TYPES.length ? 1 : 0;
  if (!met.includes(t)) met = [...met, t];
  type = t;
  filled = [];
  free = 0;
  save();
}
const wanted = new URLSearchParams(location.search).get("piece");
if (TYPES.includes(wanted) && wanted !== type) meet(wanted);

document.body.insertAdjacentHTML("afterbegin", DEFS);
const board = createBoard(document.getElementById("field"), { label: "Chess board" });
const hand = createHand(board);
const tray = document.getElementById("tray");
const pips = document.getElementById("pips");
// Where the hand left the piece's shadow, until the child moves.
let shadow = null;
// The shadow to fill.
let goal = null;
let busy = false;
// When the piece last wiggled: one wiggle at a time, so fast taps never make
// it flicker. Slots on the tray share it.
let wiggled = -Infinity;
let idle = 0;

const position = (at = board.where(ID)) => ({ cols: board.cols, rows: board.rows, pieces: [{ id: ID, type, side: "you", at }] });
const reach = () => moves(position(), ID);
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
}

// The only hint: when the child does nothing for a while with a shadow
// waiting, the hand shows the way there. One at a time; any touch or key
// starts the wait again.
function rest() {
  clearTimeout(idle);
  if (goal) idle = setTimeout(hint, token("idle"));
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
  if (busy || !goal) return rest();
  await hand.show([{ type: "press", square: board.where(ID) }, ...route(goal), { type: "release" }, { type: "return" }]);
  rest();
}

// A new shadow to fill, on a square lessons.js picks.
function aim() {
  const squares = shadowSquares(lesson(), board.where(ID), round, filled);
  goal = squares[Math.floor(Math.random() * squares.length)] ?? null;
  if (goal) board.mark("shadow", goal, art(type));
  showTray();
  rest();
}

// When a piece comes in, the hand shows a move 3 squares away, else 2, else
// the nearest there is, and leaves the piece's shadow there. With a shadow
// to fill, it shows the way there instead.
async function welcome() {
  if (goal) return hint();
  const at = board.where(ID);
  const far = (sq) => Math.max(Math.abs(sq.c - at.c), Math.abs(sq.r - at.r));
  const demo = [3, 2, 1].map((n) => reach().find((sq) => far(sq) === n)).find(Boolean);
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
  await board.move(ID, to, type === "N" ? "hop" : "slide");
  board.land(ID);
  play("land");
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
  // A pawn can't go on from the far row: after a moment it walks back.
  if (type === "P" && to.r === 0) {
    await sleep(token("walk-wait"));
    await board.move(ID, lesson().start, "walk");
  }
  if (filled.length === lesson().shadows) return done();
  // A shadow the piece can no longer reach (one a pawn passed) moves.
  if (goal && distance(position(), ID, goal) === Infinity) {
    goal = null;
    board.clear("shadow");
  }
  if (!goal && (filled.length > 0 || free >= lesson().free)) aim();
  busy = false;
  dots();
  rest();
}

// Every shadow is filled: the next piece bobs on the tray, and then comes.
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
  const motion = !reducedMotion();
  if (motion) {
    board.drag(ID, ...toSlot(type), token("walk"));
    await sleep(token("walk"));
  }
  board.clear();
  meet(t);
  showTray();
  board.place(ID, art(t), lesson().start, NAMES[t]);
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
  if ((e.type === "tap" ? e.id === null : !same(e.to, e.from)) && performance.now() - wiggled >= token("wiggle")) {
    wiggled = performance.now();
    board.wiggle(ID);
    play("nope");
  }
});

board.place(ID, art(type), lesson().start, NAMES[type]);
for (const sq of filled) board.mark("fill", sq);
showTray();
if (filled.length === lesson().shadows) {
  done();
} else {
  if (filled.length) aim();
  dots();
  await welcome();
}
