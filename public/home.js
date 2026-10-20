// The home shelf: one lidded box per game in games.json. Tapping a box (or
// Enter or Space on it) lifts its lid with a wooden tok, then opens the game,
// which picks up where the child left off.
import { reducedMotion, token } from "./engine/board.js";
import { addParentCorner } from "./engine/parent.js";
import { play } from "./engine/sound.js";

const svg = (inner, box = "0 0 200 200") => `<svg viewBox="${box}" aria-hidden="true" focusable="false">${inner}</svg>`;

// A box seen from the front, with the game's picture on its lid. The lid is
// drawn on its own so it can lift.
function boxArt(art) {
  const base = svg(`
    <rect class="inside" x="20" y="104" width="160" height="16" rx="6"/>
    <rect class="front" x="16" y="112" width="168" height="84" rx="12"/>
    <rect class="crease" x="16" y="168" width="168" height="5"/>
    <rect class="front-edge" x="16" y="182" width="168" height="14" rx="7"/>`);
  const lid = svg(`
    <rect class="lid" x="10" y="16" width="180" height="152" rx="14"/>
    <rect class="lid-top" x="10" y="16" width="180" height="12" rx="6"/>
    <rect class="lid-edge" x="10" y="156" width="180" height="12" rx="6"/>
    <rect class="label" x="28" y="36" width="144" height="110" rx="12"/>
    <svg x="44" y="35" width="112" height="112" viewBox="0 0 40 40">${art}</svg>`);
  return `<span class="box-floor"></span><span class="box-base">${base}</span><span class="box-lid">${lid}</span>`;
}

function shelve(game) {
  const box = document.createElement("button");
  box.type = "button";
  box.className = "box";
  box.dataset.game = game.slug;
  box.setAttribute("aria-label", game.label);
  box.innerHTML = boxArt(game.art);
  // Pressed, the box dips; let go, the lid lifts.
  box.addEventListener("pointerdown", () => box.classList.add("down"));
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) box.addEventListener(type, () => box.classList.remove("down"));
  box.addEventListener("click", () => {
    if (document.querySelector(".box.open")) return;
    box.classList.add("open");
    play("land");
    setTimeout(() => location.assign(game.path), token(reducedMotion() ? "fade" : "move"));
  });
  return box;
}

addParentCorner();
const games = await (await fetch("/games.json")).json();
document.querySelector(".case").append(...games.map(shelve));

// Back from a game, the browser may show this page as it was left: lid up.
addEventListener("pageshow", () => document.querySelector(".box.open")?.classList.remove("open"));
