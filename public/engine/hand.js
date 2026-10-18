// The ghost hand: a faint hand that shows a move on the board, so the child
// can copy it. show(steps) plays a scripted path and resolves true when it's
// done, or false when cancelled:
//   { type: "press", square }   the hand comes in and presses there; the
//                               piece on that square lifts
//   { type: "drag", square }    the hand drags to the square, the piece with it
//   { type: "release" }         it lets go: the piece lands, and the hand fades
//   { type: "return" }          the piece slides back to where it started
// Without a return, the piece stays where the hand left it (board.where()
// says so). Any touch or key cancels the hand at once, and the piece goes
// back to its square. With reduced motion the hand doesn't travel: the
// target square pulses instead.
import { reducedMotion, sleep, token } from "./board.js";
import { play } from "./sound.js";

const ART = '<svg viewBox="0 0 40 48" aria-hidden="true" focusable="false"><g fill="currentColor"><rect x="14" y="1" width="8" height="27" rx="4"/><rect x="20.5" y="14.5" width="7" height="13" rx="3.5"/><rect x="26.5" y="17.5" width="6.5" height="12" rx="3.25"/><rect x="2.5" y="21" width="9" height="15" rx="4.5" transform="rotate(-32 7 28.5)"/><rect x="8" y="20" width="26" height="25" rx="10.5"/></g></svg>';

export function createHand(board) {
  const hand = document.createElement("div");
  hand.className = "hand";
  hand.innerHTML = `<i>${ART}</i>`;
  board.el.append(hand);
  // Counts shows: cancelling moves it on, which stops the one playing.
  let run = 0;
  let playing = null;

  // Puts the fingertip on a square, or (dx, dy) squares away from it.
  function point(square, dx = 0, dy = 0) {
    const b = board.el.getBoundingClientRect();
    const s = board.rect(square);
    hand.style.width = `${s.width}px`;
    hand.style.height = `${s.width * 1.2}px`;
    hand.style.transform = `translate(${s.left - b.left + s.width * (0.05 + dx)}px, ${s.top - b.top + s.height * (0.5 + dy)}px)`;
  }

  function cancel() {
    if (!playing) return;
    run++;
    const { piece } = playing;
    playing = null;
    hand.style.transition = "none";
    hand.classList.remove("on", "press", "drag");
    board.clear("pulse");
    if (piece !== null) {
      board.lift(piece, false);
      board.drag(piece, 0, 0);
    }
  }
  for (const type of ["pointerdown", "keydown"]) addEventListener(type, cancel, { capture: true });

  async function show(steps) {
    cancel();
    const mine = ++run;
    const wait = async (name, times = 1) => {
      await sleep(token(name) * times);
      return mine === run;
    };
    playing = { piece: null };

    if (reducedMotion()) {
      board.mark("pulse", steps.findLast((s) => s.square).square);
      if (!(await wait("pulse", 2))) return false;
      board.clear("pulse");
      playing = null;
      return true;
    }

    let from = null;
    let at = null;
    for (const step of steps) {
      if (step.type === "press") {
        if (!hand.classList.contains("on")) {
          hand.style.transition = "none";
          point(step.square, 2.2, 3);
          void hand.offsetWidth;
          hand.style.transition = "";
          hand.classList.add("on");
        }
        point(step.square);
        if (!(await wait("hand"))) return false;
        hand.classList.add("press");
        from = at = step.square;
        playing.piece = board.pieceAt(from);
        if (playing.piece !== null) board.lift(playing.piece, true);
        if (!(await wait("hand-press"))) return false;
      } else if (step.type === "drag") {
        hand.classList.add("drag");
        point(step.square);
        if (playing.piece !== null) {
          const a = board.rect(from);
          const b = board.rect(step.square);
          board.drag(playing.piece, b.left - a.left, b.top - a.top, token("hand-drag"));
        }
        at = step.square;
        if (!(await wait("hand-drag"))) return false;
        hand.classList.remove("drag");
      } else if (step.type === "release") {
        hand.classList.remove("press");
        if (playing.piece !== null) {
          board.lift(playing.piece, false);
          board.land(playing.piece);
          play("land");
        }
        if (!(await wait("hand-rest"))) return false;
        hand.classList.remove("on");
        if (!(await wait("hand-fade"))) return false;
      } else if (step.type === "return") {
        at = from;
        if (playing.piece !== null) await board.move(playing.piece, from);
        if (mine !== run) return false;
      } else {
        throw new Error(`no hand step "${step.type}"`);
      }
    }
    hand.classList.remove("on", "press");
    const { piece } = playing;
    playing = null;
    if (piece !== null && at) await board.move(piece, at);
    return true;
  }

  return { show, cancel };
}
