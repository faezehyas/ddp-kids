// A tiny toy on the engine, for test/browser/engine.test.js: one piece that
// moves along its row or column, dots where it can go and one shadow to fill.
// window.engine lets the test drive it; events lists what input.js reported.
import { createBoard } from "/engine/board.js";
import { createHand } from "/engine/hand.js";
import { listen } from "/engine/input.js";
import { play } from "/engine/sound.js";

const ART = '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><circle class="clay" cx="20" cy="18" r="11"/><rect class="clay-dark" x="8" y="31" width="24" height="6" rx="3"/></svg>';
const GOAL = { c: 6, r: 4 };

const board = createBoard(document.getElementById("stage"), { label: "Board" });
const hand = createHand(board);
const events = [];
let busy = false;

const moves = () => {
  const { c, r } = board.where("a");
  const out = [];
  for (let i = 0; i < 8; i++) {
    if (i !== c) out.push({ c: i, r });
    if (i !== r) out.push({ c, r: i });
  }
  return out;
};
const same = (a, b) => a?.c === b?.c && a?.r === b?.r;
const legal = (sq) => moves().some((m) => same(m, sq));
// No dot where the shadow already shows the way.
const dots = (from) => board.dots(moves().filter((m) => !same(m, GOAL)), from);

async function go(square) {
  busy = true;
  board.dots([]);
  await board.move("a", square);
  board.land("a");
  play("land");
  if (same(square, GOAL)) {
    board.mark("fill", square);
    play("fit");
  }
  busy = false;
  dots(square);
}

listen(board, (e) => {
  events.push(e);
  if (busy) return false;
  const to = e.type === "drop" ? e.to : e.square;
  if (to && legal(to)) {
    go(to);
    return true;
  }
  // A wrong square wiggles; tapping the piece, or putting it back, doesn't.
  if (e.type === "tap" ? e.id === null : !same(e.to, e.from)) {
    board.wiggle("a");
    play("nope");
  }
});

board.place("a", ART, { c: 3, r: 4 }, "A piece");
board.mark("shadow", GOAL, ART);
dots({ c: 3, r: 4 });
window.engine = { board, hand, events };
