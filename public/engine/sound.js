// Every sound on the site plays through here. They are made in code with
// WebAudio, so there is nothing to download, and every one stays under the
// same loudness limit, which sound.test.js checks. Browsers block sound until
// the first touch or key, so the audio starts then. The sound setting in
// prefs.js mutes everything.
import { getPrefs } from "./prefs.js";

// The loudest any sound may be: LUFS over its loudest 100 ms, as the ear
// hears it. Daily Dose of Play puts a move at -24; these stay softer.
export const LIMIT = -30;

// A voice's attack in seconds, and how much of it a glide takes.
export const ATTACK = 0.004;
export const GLIDE = 0.6;

// Each sound is a few voices: a tone (sine unless `type` says triangle) that
// glides from f to f2 Hz, or a burst of noise through a `noise` filter at f
// Hz. `gain` is its peak, `dur` how long it rings and `at` when it starts, in
// seconds.
export const SOUNDS = {
  // A piece lands: a wooden tok, a low knock falling in pitch with a puff of noise.
  land: [
    { f: 380, f2: 170, type: "triangle", gain: 0.12, dur: 0.12 },
    { noise: "lowpass", f: 700, gain: 0.05, dur: 0.06 },
  ],
  // A piece fills its shadow: a soft chime, two warm notes a fifth apart.
  fit: [
    { f: 660, gain: 0.05, dur: 0.7 },
    { f: 990, gain: 0.04, dur: 0.8, at: 0.12 },
  ],
  // A new piece rolls in: four small taps, each a little lower.
  arrive: [0, 0.12, 0.22, 0.3].map((at, i) => ({ f: 320 - i * 30, f2: 220, type: "triangle", gain: 0.05, dur: 0.06, at })),
  // A taken piece rolls into the bowl: a low wooden clonk, and a softer one
  // as it settles.
  take: [
    { f: 220, f2: 110, type: "triangle", gain: 0.1, dur: 0.18 },
    { noise: "lowpass", f: 450, gain: 0.04, dur: 0.07 },
    { f: 180, f2: 100, type: "triangle", gain: 0.05, dur: 0.12, at: 0.14 },
  ],
  // A wrong square: one very soft, low tap.
  nope: [{ f: 220, f2: 180, type: "triangle", gain: 0.04, dur: 0.08 }],
};

let ac = null;
let noise = null;

function start() {
  if (!ac) {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context || !getPrefs().sound) return;
    ac = new Context();
    noise = ac.createBuffer(1, Math.floor(ac.sampleRate / 2), ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === "suspended") ac.resume().catch(() => {});
}
// On every touch, not just the first: a phone can suspend the audio later.
for (const type of ["pointerdown", "keydown"]) globalThis.addEventListener?.(type, start, { capture: true });

function voice(v, t0) {
  const t = t0 + (v.at ?? 0);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v.gain, t + ATTACK);
  g.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
  let src;
  if (v.noise) {
    src = ac.createBufferSource();
    src.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = v.noise;
    f.frequency.value = v.f;
    src.connect(f).connect(g);
  } else {
    src = ac.createOscillator();
    src.type = v.type ?? "sine";
    src.frequency.setValueAtTime(v.f, t);
    if (v.f2) src.frequency.exponentialRampToValueAtTime(v.f2, t + v.dur * GLIDE);
    src.connect(g);
  }
  g.connect(ac.destination);
  src.start(t);
  src.stop(t + v.dur + 0.05);
}

// Plays one of SOUNDS by name, unless muted or before the first touch.
export function play(name) {
  const voices = SOUNDS[name];
  if (!voices) throw new Error(`no sound "${name}"`);
  if (!ac || ac.state !== "running" || !getPrefs().sound) return;
  const t = ac.currentTime + 0.005;
  for (const v of voices) voice(v, t);
}
