// Touch, mouse and keyboard on a board, all as one callback, onInput(event):
//   { type: "tap", square, id }      a square was tapped; id is the piece on
//                                    it, or null
//   { type: "drop", id, from, to }   a piece was dragged and let go over `to`
//                                    (null when off the board)
// A still piece (board.place()) can't be picked up or dragged; a tap on it
// still reports its id.
// For a drop, onInput returns true when the move is allowed, and the game
// moves the piece there with board.move(); otherwise it snaps back to its
// square (where the board has it now, which a game may have changed mid-drag).
// The keyboard: the arrow keys move a focus ring, and Enter or Space picks up
// the piece under it (a tap) and puts it down on another square (a drop).
// Escape puts it back.
import { token } from "./board.js";

const STEPS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const same = (a, b) => a.c === b.c && a.r === b.r;

export function listen(board, onInput) {
  const { el } = board;

  // ---- Touch and mouse ----
  let press = null;

  el.addEventListener("pointerdown", (e) => {
    if (press || e.button !== 0) return;
    const on = e.target.closest(".piece")?.dataset.id ?? null;
    const square = on === null ? board.squareAt(e.clientX, e.clientY) : board.where(on);
    if (!square) return;
    // A still piece stays put: pressing it is pressing its square.
    const id = on !== null && !board.still(on) ? on : null;
    press = { pointer: e.pointerId, id, on, square, x: e.clientX, y: e.clientY, moved: false };
    el.setPointerCapture(e.pointerId);
    if (id !== null) board.lift(id, true);
  });

  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== press?.pointer) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.moved && Math.hypot(dx, dy) < token("drag-start")) return;
    press.moved = true;
    if (press.id !== null) board.drag(press.id, dx, dy);
  });

  function end(e, cancelled) {
    if (e.pointerId !== press?.pointer) return;
    const { id, on, square, moved } = press;
    press = null;
    if (id !== null) board.lift(id, false);
    if (!moved) {
      if (!cancelled) onInput({ type: "tap", square: { ...square }, id: on });
      return;
    }
    if (id === null) return;
    // Where the middle of the piece is, not the finger.
    const r = el.querySelector(`.piece[data-id="${CSS.escape(id)}"]`).getBoundingClientRect();
    const to = cancelled ? null : board.squareAt(r.left + r.width / 2, r.top + r.height / 2);
    if (cancelled || onInput({ type: "drop", id, from: { ...square }, to }) !== true) board.move(id, board.where(id));
  }
  el.addEventListener("pointerup", (e) => end(e, false));
  el.addEventListener("pointercancel", (e) => end(e, true));

  // ---- Keyboard ----
  const ring = document.createElement("div");
  ring.className = "ring";
  el.append(ring);
  let focus = { c: 0, r: 0 };
  let held = null;
  const show = () => {
    ring.style.gridArea = `${focus.r + 1} / ${focus.c + 1}`;
  };
  show();

  el.addEventListener("keydown", (e) => {
    const step = STEPS[e.key];
    if (step) {
      e.preventDefault();
      focus = { c: Math.min(board.cols - 1, Math.max(0, focus.c + step[0])), r: Math.min(board.rows - 1, Math.max(0, focus.r + step[1])) };
      show();
      return;
    }
    if (e.key === "Escape" && held) {
      board.lift(held.id, false);
      held = null;
      return;
    }
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (e.repeat) return;
    const square = { ...focus };
    if (held) {
      const { id, from } = held;
      held = null;
      board.lift(id, false);
      if (!same(from, square)) onInput({ type: "drop", id, from, to: square });
      return;
    }
    const id = board.pieceAt(square);
    if (id !== null && !board.still(id)) {
      held = { id, from: square };
      board.lift(id, true);
    }
    onInput({ type: "tap", square, id });
  });
}
