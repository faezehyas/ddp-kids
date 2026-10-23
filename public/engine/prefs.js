// This device's settings, under one localStorage key with a version number.
// Storage can be blocked (private browsing, strict settings), so every read
// and write is in try/catch and the site works without it. A value that
// doesn't parse, or one from another version, reads as the defaults, and so
// does any setting of the wrong type. No DOM; runs in node too, where
// `storage` stands in for localStorage.
//   sound      true, or false for silence
//   progress   each game's progress under its slug, as the game saves it;
//              {} is a fresh start
export const KEY = "ddp-kids";
export const VERSION = 1;
export const DEFAULTS = Object.freeze({ sound: true, progress: Object.freeze({}) });
// The settings a reset keeps; everything else in DEFAULTS is progress.
export const SETTINGS = Object.freeze(["sound"]);

const kind = (value) => (Array.isArray(value) ? "array" : value === null ? "null" : typeof value);

function clean(saved) {
  const prefs = {};
  for (const [name, fallback] of Object.entries(DEFAULTS)) prefs[name] = kind(saved?.[name]) === kind(fallback) ? saved[name] : fallback;
  return prefs;
}

export function getPrefs(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(KEY));
    if (saved?.version === VERSION) return clean(saved);
  } catch {}
  return { ...DEFAULTS };
}

// Changes some settings, saves them (when storage allows) and returns them all.
export function setPrefs(patch, storage) {
  const prefs = clean({ ...getPrefs(storage), ...patch });
  try {
    (storage ?? globalThis.localStorage).setItem(KEY, JSON.stringify({ version: VERSION, ...prefs }));
  } catch {}
  return prefs;
}

// Puts all progress back to the defaults, keeps the settings, and returns
// them all.
export function resetProgress(storage) {
  const prefs = getPrefs(storage);
  return setPrefs({ ...DEFAULTS, ...Object.fromEntries(SETTINGS.map((name) => [name, prefs[name]])) }, storage);
}
