// The chess playground's toy stage: one piece on an empty board that the
// child moves freely. Sage dots ripple out to every square it can go to; a
// tap on a dot, or a drag there, moves it, and any other square makes it
// wiggle. When the page opens, the ghost hand shows one move and leaves the
// piece's dashed shadow on that square until the child moves. A pawn on the
// far row walks back to its start. ?piece=B (or Q, K, N, P) opens another
// piece; the rook is the first.
import { createBoard, sleep, token } from "/engine/board.js";
import { createHand } from "/engine/hand.js";
import { listen } from "/engine/input.js";
import { addParentCorner } from "/engine/parent.js";
import { play } from "/engine/sound.js";
import { LESSONS } from "./lessons.js";
import { DEFS, NAMES, art } from "./pieces.js";
import { moves } from "./rules.js";

const ID = "you";
const wanted = new URLSearchParams(location.search).get("piece");
const { type, start } = LESSONS.find((l) => l.type === wanted) ?? LESSONS[0];
const ART = art(type);

document.body.insertAdjacentHTML("afterbegin", DEFS);
addParentCorner();
const board = createBoard(document.getElementById("stage"), { label: "Chess board" });
const hand = createHand(board);
// Where the hand left the piece's shadow, until the child moves.
let shadow = null;
let busy = false;
// When the piece last wiggled: one wiggle at a time, so fast taps never make
// it flicker.
let wiggled = -Infinity;

const same = (a, b) => a?.c === b?.c && a?.r === b?.r;
const reach = () => moves({ cols: board.cols, rows: board.rows, pieces: [{ id: ID, type, side: "you", at: board.where(ID) }] }, ID);
// No dot where the shadow already shows the way.
const dots = () => board.dots(reach().filter((sq) => !same(sq, shadow)), board.where(ID));

async function go(to) {
  busy = true;
  shadow = null;
  board.clear("shadow");
  board.dots([]);
  await board.move(ID, to, type === "N" ? "hop" : "slide");
  board.land(ID);
  play("land");
  // A pawn can't go on from the far row: after a moment it walks back.
  if (type === "P" && to.r === 0) {
    await sleep(token("walk-wait"));
    await board.move(ID, start, "walk");
  }
  busy = false;
  dots();
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

board.place(ID, ART, start, NAMES[type]);
dots();

// The hand shows a move 3 squares away, else 2, else the nearest there is.
const far = (sq) => Math.max(Math.abs(sq.c - start.c), Math.abs(sq.r - start.r));
const demo = [3, 2, 1].map((n) => reach().find((sq) => far(sq) === n)).find(Boolean);
if (await hand.show([{ type: "press", square: start }, { type: "drag", square: demo }, { type: "release" }, { type: "return" }])) {
  shadow = demo;
  board.mark("shadow", demo, ART);
  dots();
}
