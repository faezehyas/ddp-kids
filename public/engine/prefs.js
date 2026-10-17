// This device's settings, under one localStorage key with a version number.
// Storage can be blocked (private browsing, strict settings), so every read
// and write is in try/catch and the site works without it. A value that
// doesn't parse, or one from another version, reads as the defaults, and so
// does any setting of the wrong type. No DOM; runs in node too, where
// `storage` stands in for localStorage.
const KEY = "ddp-kids";
export const VERSION = 1;
export const DEFAULTS = Object.freeze({ sound: true });

function clean(saved) {
  const prefs = {};
  for (const [name, fallback] of Object.entries(DEFAULTS)) prefs[name] = typeof saved?.[name] === typeof fallback ? saved[name] : fallback;
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
