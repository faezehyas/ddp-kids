// The board view: cols x rows squares that fit the box the game gives them,
// with marks under the pieces. It knows nothing about any game: a game places
// its own art and says where it goes. The board is a CSS grid with an aspect
// ratio (theme.css), so it follows its box with no pixel sizes; pieces and
// marks sit in its cells. Squares are { c, r }: the column from the left and
// the row from the top, from 0.

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A token from theme.css as a number: ms for timings, px for sizes.
export const token = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--${name}`));

// The kinds of mark, bottom to top: a filled square (a goal reached), an
// outline, a dot (where a piece can go), a shadow (a piece's dashed outline:
// a goal, or "now you") and a pulse.
const KINDS = ["fill", "outline", "dot", "shadow", "pulse"];

const same = (a, b) => a.c === b.c && a.r === b.r;
const ring = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));

function div(cls) {
  const el = document.createElement("div");
  el.className = cls;
  return el;
}
function put(el, { c, r }) {
  el.style.gridArea = `${r + 1} / ${c + 1}`;
  el.dataset.c = c;
  el.dataset.r = r;
}
// Restarts a CSS animation.
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// host: an element the game sizes; the board fits inside it, centred.
// label: what a screen reader calls the board.
export function createBoard(host, { cols = 8, rows = 8, label } = {}) {
  const el = div("board");
  el.tabIndex = 0;
  el.setAttribute("role", "application");
  if (label) el.setAttribute("aria-label", label);
  el.style.setProperty("--cols", cols);
  el.style.setProperty("--rows", rows);
  const squares = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sq = div(`sq${(c + r) % 2 ? " dark" : ""}`);
      put(sq, { c, r });
      squares.push(sq);
    }
  }
  el.append(...squares);
  host.classList.add("board-host");
  host.append(el);

  const pieces = new Map();
  const get = (id) => {
    const p = pieces.get(String(id));
    if (!p) throw new Error(`no piece ${id}`);
    return p;
  };
  const inside = ({ c, r }) => c >= 0 && c < cols && r >= 0 && r < rows;

  // Puts art (SVG markup) on a square as piece `id`, replacing one with that
  // id. Ids come back from input.js as strings. label: what a screen reader
  // calls the piece.
  function place(id, art, square, label) {
    id = String(id);
    pieces.get(id)?.el.remove();
    const p = div("piece");
    const pin = div("pin");
    pin.innerHTML = art;
    p.append(pin);
    p.dataset.id = id;
    if (label) {
      p.setAttribute("role", "img");
      p.setAttribute("aria-label", label);
    }
    put(p, square);
    el.append(p);
    pieces.set(id, { el: p, pin, square: { ...square } });
  }

  // Moves a piece to a square from wherever it shows now (mid-drag or
  // mid-move), and resolves when it's there. how: "slide", "hop" to jump
  // over the pieces in between, or "walk", slower and softer. With reduced
  // motion it fades out and in.
  async function move(id, square, how = "slide") {
    const p = get(id);
    const from = p.el.getBoundingClientRect();
    p.square = { ...square };
    p.el.classList.remove("moving", "walk");
    p.el.style.transition = "none";
    p.el.style.translate = "";
    p.el.style.transform = "";
    p.el.style.opacity = "";
    put(p.el, square);
    const to = p.el.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      p.el.style.transition = "";
      return;
    }
    if (reducedMotion()) {
      p.el.style.transform = `translate(${dx}px, ${dy}px)`;
      p.el.style.transition = "";
      p.el.style.opacity = "0";
      await sleep(token("fade"));
      if (!same(p.square, square)) return;
      p.el.style.transition = "none";
      p.el.style.transform = "";
      void p.el.offsetWidth;
      p.el.style.transition = "";
      p.el.style.opacity = "";
      await sleep(token("fade"));
      return;
    }
    p.el.style.transform = `translate(${dx}px, ${dy}px)`;
    void p.el.offsetWidth;
    p.el.style.transition = "";
    p.el.classList.add("moving");
    p.el.classList.toggle("walk", how === "walk");
    p.el.style.transform = "";
    if (how === "hop") replay(p.pin, "hop");
    await sleep(token(how === "walk" ? "walk" : "move"));
    if (same(p.square, square)) p.el.classList.remove("moving", "walk");
  }

  // Shows a piece away from its square by x, y px, as a finger drags it;
  // over ms when given. move() puts it back on a square.
  function drag(id, x, y, ms = 0) {
    const p = get(id);
    p.el.style.transition = ms ? `translate ${ms}ms ease-in-out` : "none";
    p.el.style.translate = `${x}px ${y}px`;
  }

  // Marks a square: kind is one of KINDS; a shadow takes the piece's art.
  // Filling a square with a shadow on it fits the shadow: it fills with
  // honey and fades.
  function mark(kind, square, art) {
    if (!KINDS.includes(kind)) throw new Error(`no mark "${kind}"`);
    const m = div(`mark ${kind}`);
    put(m, square);
    if (kind === "shadow") {
      const inner = div("art");
      inner.innerHTML = art;
      m.append(inner);
    }
    if (kind === "fill") {
      for (const s of marks("shadow")) {
        if (!same(at(s), square)) continue;
        s.classList.add("fit");
        setTimeout(() => s.remove(), token("fit"));
      }
    }
    el.append(m);
    return m;
  }
  const marks = (kind) => el.querySelectorAll(kind ? `.mark.${kind}` : ".mark");
  const at = (node) => ({ c: Number(node.dataset.c), r: Number(node.dataset.r) });

  return {
    el,
    cols,
    rows,
    place,
    move,
    drag,
    // A piece lands: a small squash.
    land: (id) => replay(get(id).pin, "land"),
    // A wrong square: the piece wiggles (with reduced motion, it dips).
    wiggle: (id) => replay(get(id).pin, "wiggle"),
    // A piece lifts under a finger, or puts itself down.
    lift: (id, up) => get(id).el.classList.toggle("up", up),
    // Dots on squares, rippling out from `from` one ring at a time; they
    // replace the dots before.
    dots(list, from) {
      for (const d of marks("dot")) d.remove();
      for (const sq of list) mark("dot", sq).style.setProperty("--ring-n", from ? ring(sq, from) : 0);
    },
    mark,
    // Takes away the marks of one kind, or every mark.
    clear(kind) {
      for (const m of marks(kind)) m.remove();
    },
    where: (id) => ({ ...get(id).square }),
    pieceAt(square) {
      for (const [id, p] of pieces) if (same(p.square, square)) return id;
      return null;
    },
    // The square under a point on the screen (client px), or null off the board.
    squareAt(x, y) {
      const first = squares[0].getBoundingClientRect();
      const last = squares.at(-1).getBoundingClientRect();
      const w = (last.right - first.left) / cols;
      const h = (last.bottom - first.top) / rows;
      const square = { c: Math.floor((x - first.left) / w), r: Math.floor((y - first.top) / h) };
      return inside(square) ? square : null;
    },
    // A square's box on the screen.
    rect: ({ c, r }) => squares[r * cols + c].getBoundingClientRect(),
  };
}
