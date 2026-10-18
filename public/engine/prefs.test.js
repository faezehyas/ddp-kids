import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, VERSION, getPrefs, setPrefs } from "./prefs.js";

// localStorage's interface over a Map.
function storage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}
const saved = (s) => JSON.parse(s.map.get("ddp-kids"));

test("nothing saved reads as the defaults", () => {
  assert.deepEqual(getPrefs(storage()), DEFAULTS);
});

test("a change is saved under one key with the version, and read back", () => {
  const s = storage();
  assert.deepEqual(setPrefs({ sound: false }, s), { sound: false });
  assert.deepEqual([...s.map.keys()], ["ddp-kids"]);
  assert.deepEqual(saved(s), { version: VERSION, sound: false });
  assert.deepEqual(getPrefs(s), { sound: false });
});

test("blocked storage reads as the defaults and drops writes, without throwing", () => {
  const blocked = {
    getItem() {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem() {
      throw new DOMException("blocked", "SecurityError");
    },
  };
  assert.deepEqual(getPrefs(blocked), DEFAULTS);
  assert.deepEqual(setPrefs({ sound: false }, blocked), { sound: false });

  // Some browsers throw on reading window.localStorage itself.
  const own = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("blocked", "SecurityError");
    },
  });
  try {
    assert.deepEqual(getPrefs(), DEFAULTS);
    assert.deepEqual(setPrefs({ sound: false }), { sound: false });
  } finally {
    if (own) Object.defineProperty(globalThis, "localStorage", own);
    else delete globalThis.localStorage;
  }
});

test("a corrupt value resets to the defaults, and the next change replaces it", () => {
  for (const value of ["{not json", "null", "42", '"on"', "[]", JSON.stringify({ version: VERSION, sound: "no" })]) {
    assert.deepEqual(getPrefs(storage({ "ddp-kids": value })), DEFAULTS, value);
  }
  const s = storage({ "ddp-kids": "{not json" });
  setPrefs({}, s);
  assert.deepEqual(saved(s), { version: VERSION, ...DEFAULTS });
});

test("a value from another version reads as the defaults", () => {
  for (const version of [undefined, 0, VERSION + 1, String(VERSION)]) {
    assert.deepEqual(getPrefs(storage({ "ddp-kids": JSON.stringify({ version, sound: false }) })), DEFAULTS, String(version));
  }
});
