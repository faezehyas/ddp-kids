// Every sound stays under the shared loudness limit. Each one is rendered
// here the way WebAudio plays it (the same envelopes, glides and filters),
// then measured as the ear hears it: K-weighted as in ITU-R BS.1770, over the
// loudest 100 ms.
import test from "node:test";
import assert from "node:assert/strict";
import { ATTACK, GLIDE, LIMIT, SOUNDS } from "./sound.js";

const SR = 48000;

// A biquad filter as WebAudio and BS.1770 define them (RBJ's cookbook).
function biquad(x, { b, a }) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    y[i] = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    [x2, x1, y2, y1] = [x1, x[i], y1, y[i]];
  }
  return y;
}
function filter(type, f, q) {
  const w = (2 * Math.PI * f) / SR;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b = type === "lowpass" ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [alpha, 0, -alpha];
  return { b: b.map((v) => v / a0), a: [(-2 * cos) / a0, (1 - alpha) / a0] };
}

// mulberry32: seeded noise, so every run measures the same.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function render(voices) {
  const end = Math.max(...voices.map((v) => (v.at ?? 0) + v.dur + 0.05));
  const out = new Float64Array(Math.ceil(end * SR) + SR / 10);
  const random = seeded(1);
  for (const v of voices) {
    const start = Math.round((v.at ?? 0) * SR);
    const n = Math.round((v.dur + 0.05) * SR);
    let wave = new Float64Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      if (v.noise) {
        wave[i] = random() * 2 - 1;
        continue;
      }
      const f = v.f2 ? v.f * (v.f2 / v.f) ** Math.min(1, t / (v.dur * GLIDE)) : v.f;
      phase = (phase + f / SR) % 1;
      wave[i] = v.type === "triangle" ? 1 - 4 * Math.abs(phase - 0.5) : Math.sin(2 * Math.PI * phase);
    }
    // WebAudio reads a lowpass filter's Q in dB, and its default is 1.
    if (v.noise) wave = biquad(wave, filter(v.noise, v.f, v.noise === "lowpass" ? 10 ** (1 / 20) : 1));
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const gain = t < ATTACK ? 0.0001 + (v.gain - 0.0001) * (t / ATTACK) : t < v.dur ? v.gain * (0.0001 / v.gain) ** ((t - ATTACK) / (v.dur - ATTACK)) : 0.0001;
      out[start + i] += wave[i] * gain;
    }
  }
  return out;
}

// BS.1770's K-weighting at 48 kHz (a high shelf for the head, then a
// high-pass), and the mean square of the loudest 100 ms.
const SHELF = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] };
const HIGHPASS = { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] };
function loudness(x) {
  const k = biquad(biquad(x, SHELF), HIGHPASS);
  const w = SR / 10;
  let sum = 0;
  let best = 0;
  for (let i = 0; i < k.length; i++) {
    sum += k[i] * k[i] - (i >= w ? k[i - w] * k[i - w] : 0);
    best = Math.max(best, sum);
  }
  return -0.691 + 10 * Math.log10(best / w);
}

test("the meter reads a 1 kHz sine at -20 dBFS as -23 LUFS", () => {
  const sine = Float64Array.from({ length: SR }, (_, i) => 0.1 * Math.sin((2 * Math.PI * 1000 * i) / SR));
  assert.ok(Math.abs(loudness(sine) + 23) < 0.1, loudness(sine).toFixed(2));
});

test("every sound stays under the shared loudness limit", () => {
  assert.deepEqual(Object.keys(SOUNDS).sort(), ["arrive", "fit", "land", "nope", "take"]);
  for (const [name, voices] of Object.entries(SOUNDS)) {
    const lufs = loudness(render(voices));
    assert.ok(lufs <= LIMIT, `${name} is ${lufs.toFixed(1)} LUFS, over the limit of ${LIMIT}`);
    assert.ok(lufs > LIMIT - 20, `${name} is ${lufs.toFixed(1)} LUFS, too quiet to hear`);
  }
});

test("a wrong square is the softest sound", () => {
  const levels = Object.fromEntries(Object.entries(SOUNDS).map(([name, voices]) => [name, loudness(render(voices))]));
  for (const name of Object.keys(SOUNDS)) if (name !== "nope") assert.ok(levels.nope < levels[name], `nope (${levels.nope.toFixed(1)}) is softer than ${name} (${levels[name].toFixed(1)})`);
});
