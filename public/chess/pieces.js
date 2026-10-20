// The chess pieces' art in Paper and clay: chunky shapes on a round base,
// with a slight hand-made wobble. Clay for the child's side ("you"), ink for
// the other ("ink"). Colours come from style.css through classes; the board
// draws the same art as a piece's dashed shadow.

const SHAPES = {
  R: '<rect x="12" y="15" width="16" height="17" rx="2.5"/><path d="M10 8.5a1.5 1.5 0 0 1 1.5-1.5h3a1 1 0 0 1 1 1v2h2.5v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2h2.5v-2a1 1 0 0 1 1-1h3a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-17a1.5 1.5 0 0 1-1.5-1.5z"/>',
  B: '<path d="M14 32L16.5 20h7L26 32z"/><ellipse cx="20" cy="15" rx="7" ry="8"/><circle cx="20" cy="5.5" r="2.5"/>',
  Q: '<path d="M13 32L15.5 17h9L27 32z"/><path d="M11 11L15 17h10L29 11l-4.5 2.5L20 8l-4.5 5.5z"/><circle cx="11" cy="10" r="2.2"/><circle cx="20" cy="6.5" r="2.4"/><circle cx="29" cy="10" r="2.2"/>',
  K: '<path d="M13 32L15.5 18h9L27 32z"/><path d="M13 13Q20 8 27 13l-2 5.5H15z"/><rect x="18.6" y="2.5" width="2.8" height="9" rx="1.4"/><rect x="16" y="5" width="8" height="2.8" rx="1.4"/>',
  N: '<path d="M13 32l2-10c-4-1-5.5-3.5-4-6 1.5-3 5-6 8-8.5L20.5 4 23 7.5c5.5 2 7.5 7.5 6.5 13.5L28 32z"/>',
  P: '<circle cx="20" cy="13" r="6.5"/><path d="M14 32c0-7 2-11 6-13 4 2 6 6 6 13z"/>',
};
const BASE = '<rect x="8" y="31" width="24" height="6" rx="3"/>';
// The bishop's slit.
const SLIT = '<path d="M22.6 10.6L18.2 16"/>';

// What a screen reader calls each piece.
export const NAMES = { R: "Rook", B: "Bishop", Q: "Queen", K: "King", N: "Knight", P: "Pawn" };

// The gradients and the wobble the art uses, once per page.
export const DEFS = `<svg class="defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="clay" x1="0" y1="0" x2=".6" y2="1"><stop class="clay-light" offset="0"/><stop class="clay" offset=".55"/></linearGradient>
  <linearGradient id="ink" x1="0" y1="0" x2=".6" y2="1"><stop class="ink-light" offset="0"/><stop class="ink" offset=".55"/></linearGradient>
  <filter id="wobble" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="1" seed="4"/><feDisplacementMap in="SourceGraphic" scale="0.9" xChannelSelector="R" yChannelSelector="G"/></filter>
</defs></svg>`;

// A piece as SVG markup: type is R, B, Q, K, N or P; side is "you" or "ink".
export function art(type, side = "you") {
  const body = side === "ink" ? "ink" : "clay";
  return `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><g class="${side}" filter="url(#wobble)"><g fill="url(#${body})">${SHAPES[type]}</g><g class="base">${BASE}</g>${type === "B" ? `<g class="slit">${SLIT}</g>` : ""}</g></svg>`;
}
