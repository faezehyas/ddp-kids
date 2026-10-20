// The playground's stages, as data: the pieces in the order a child meets
// them, each with its start square on the 8x8 board. Squares are { c, r }
// from the top left; the child's pawn starts on its start row and walks up.
export const LESSONS = [
  { type: "R", start: { c: 3, r: 4 } },
  { type: "B", start: { c: 3, r: 4 } },
  { type: "Q", start: { c: 3, r: 4 } },
  { type: "K", start: { c: 3, r: 4 } },
  { type: "N", start: { c: 3, r: 4 } },
  { type: "P", start: { c: 3, r: 6 } },
];
