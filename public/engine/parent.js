// The parent area: the only place with words. A faint button in the top
// right corner of every page; a tap gives one small pulse and nothing else.
// Holding it for --hold (3 s), or holding Space on it, fills a ring and opens
// a dialog for grown-ups: sound on or off, reset progress, about and privacy.
// Escape or Close shuts it and gives the focus back to the button. After a
// reset, closing it reloads the page, so the game starts again from prefs.
import { token } from "./board.js";
import { KEY, getPrefs, resetProgress, setPrefs } from "./prefs.js";

// Two sliders.
const ICON = `<svg class="corner-icon" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M10 15h20M10 25h20"/><circle cx="16" cy="15" r="3"/><circle cx="24" cy="25" r="3"/></svg>`;
// The ring that fills while the button is held. pathLength lets theme.css
// draw it from 0 to 1.
const RING = `<svg class="corner-ring" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="21" pathLength="1"/></svg>`;

const PANEL = `
  <h2 id="parent-title">For grown-ups</h2>
  <div class="parent-row">
    <span id="parent-sound">Sound</span>
    <button type="button" data-act="sound" aria-labelledby="parent-sound"></button>
  </div>
  <div class="parent-row">
    <span>Progress</span>
    <button type="button" data-act="reset">Reset</button>
  </div>
  <p class="parent-note" hidden>Progress cleared. It starts again when you close this.</p>
  <h3>About</h3>
  <p>Free board games for children who can't read yet. No ads, no sign-up, and nothing leaves this device.</p>
  <h3>Privacy</h3>
  <p>This site saves one thing, in this browser's local storage: <code>${KEY}</code>. It holds the sound setting and your child's progress. No cookies, accounts or analytics. Right now it holds:</p>
  <pre class="parent-saved"></pre>
  <button type="button" data-act="close">Close</button>`;

function saved() {
  try {
    return globalThis.localStorage.getItem(KEY) ?? "Nothing yet.";
  } catch {
    return "Nothing: this browser blocks local storage.";
  }
}

export function addParentCorner() {
  const corner = document.createElement("button");
  corner.type = "button";
  corner.className = "corner";
  corner.setAttribute("aria-label", "For grown-ups: hold for 3 seconds");
  corner.innerHTML = RING + ICON;

  const dialog = document.createElement("dialog");
  dialog.className = "parent";
  dialog.dataset.parent = "";
  dialog.setAttribute("aria-labelledby", "parent-title");
  dialog.innerHTML = PANEL;
  document.body.append(corner, dialog);

  const sound = dialog.querySelector('[data-act="sound"]');
  const reset = dialog.querySelector('[data-act="reset"]');
  const note = dialog.querySelector(".parent-note");
  // Reset asks for a second tap; after one, closing reloads the page.
  let armed = false;
  let cleared = false;

  function show() {
    const on = getPrefs().sound;
    sound.setAttribute("aria-pressed", String(on));
    sound.textContent = on ? "On" : "Off";
    reset.textContent = armed ? "Tap again to reset" : "Reset";
    note.hidden = !cleared;
    dialog.querySelector(".parent-saved").textContent = saved();
  }
  function open() {
    armed = false;
    show();
    dialog.showModal();
  }
  dialog.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "close") return dialog.close();
    if (act === "sound") setPrefs({ sound: !getPrefs().sound });
    if (act === "reset" && armed) {
      resetProgress();
      cleared = true;
    }
    armed = act === "reset" && !armed;
    show();
  });
  dialog.addEventListener("close", () => {
    corner.focus();
    if (cleared) location.reload();
  });

  // ---- Holding the button ----
  let held = null;

  function stop() {
    clearTimeout(held);
    held = null;
    corner.classList.remove("holding");
  }
  function begin() {
    if (held || dialog.open) return;
    corner.classList.add("holding");
    held = setTimeout(() => {
      stop();
      open();
    }, token("hold"));
  }
  // Let go too soon: one small pulse, never more than one at a time.
  function end() {
    if (!held) return;
    stop();
    corner.classList.add("nudge");
  }
  corner.addEventListener("animationend", (e) => e.animationName.startsWith("nudge") && corner.classList.remove("nudge"));

  corner.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    corner.setPointerCapture(e.pointerId);
    begin();
  });
  for (const type of ["pointerup", "pointercancel"]) corner.addEventListener(type, end);
  corner.addEventListener("contextmenu", (e) => e.preventDefault());
  corner.addEventListener("keydown", (e) => {
    if (e.key !== " ") return;
    e.preventDefault();
    if (!e.repeat) begin();
  });
  corner.addEventListener("keyup", (e) => {
    if (e.key !== " ") return;
    e.preventDefault();
    end();
  });
}
