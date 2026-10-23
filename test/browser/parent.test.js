// The parent area on the home page and the chess playground: the corner
// passes the guards with the panel closed, a tap only pulses, a 3 s hold by
// touch or Space opens the panel, Escape and Close shut it and give the focus
// back, sound off silences every sound, and reset clears progress after a
// second tap. Leaves screenshots of the ring half-filled and the open panel
// in test-artifacts/. Skips without Playwright.
//
//   node --test test/browser/parent.test.js
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { DEFAULTS, VERSION } from "../../public/engine/prefs.js";
import { SOUNDS } from "../../public/engine/sound.js";
import { ARTIFACTS, DEVICES, assertBigTargets, assertNoSideScroll, assertNoWords, finger, openPage, skipWithoutPlaywright } from "./helpers.js";

const skip = skipWithoutPlaywright();
const PAGES = { home: "/", chess: "/chess/" };
const HOLD = 3000;

async function open(t, pathname = "/chess/", device = "phone") {
  const page = await openPage(t, pathname, device);
  await page.locator(".corner").waitFor();
  return page;
}

const isOpen = (page) => page.evaluate(() => document.querySelector("dialog.parent").open);
const focusInPanel = (page) => page.evaluate(() => Boolean(document.activeElement.closest("dialog.parent")));
// The dialog's close event, which gives the focus back, comes a moment after it shuts.
const focusBack = (page) => page.waitForFunction(() => document.activeElement.matches(".corner"));

// Holds the corner down with one finger for ms, then lets go.
async function hold(page, ms, { shot } = {}) {
  const f = await finger(page);
  const r = await page.locator(".corner").boundingBox();
  await f.down({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  if (shot) {
    await page.waitForTimeout(ms / 2);
    await page.screenshot({ path: shot });
    await page.waitForTimeout(ms / 2);
  } else {
    await page.waitForTimeout(ms);
  }
  await f.up();
}
const openPanel = async (page) => {
  await hold(page, HOLD + 300);
  assert.ok(await isOpen(page));
};

for (const [name, pathname] of Object.entries(PAGES)) {
  for (const device of Object.keys(DEVICES)) {
    test(`the corner on ${name} passes every guard with the panel closed, and the panel opens on ${device}`, { skip }, async (t) => {
      const page = await open(t, pathname, device);
      const box = await page.locator(".corner").boundingBox();
      const width = await page.evaluate(() => innerWidth);
      assert.ok(box.y < box.height && width - (box.x + box.width) < box.width, "the corner sits in the top right");
      await assertNoWords(page);
      await assertNoSideScroll(page);
      await assertBigTargets(page);
      await hold(page, HOLD + 300, { shot: path.join(ARTIFACTS, `parent-${name}-${device}-hold.png`) });
      assert.ok(await isOpen(page));
      await assertNoSideScroll(page);
      await assertBigTargets(page);
      await page.screenshot({ path: path.join(ARTIFACTS, `parent-${name}-${device}-open.png`) });
    });
  }
}

test("a tap only pulses, and letting go before 3 s doesn't open the panel", { skip }, async (t) => {
  const page = await open(t);
  const r = await page.locator(".corner").boundingBox();
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  assert.ok(await page.locator(".corner.nudge").count());
  // Fast taps never pile up: one pulse at a time.
  for (let i = 0; i < 6; i++) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(500);
  assert.equal(await isOpen(page), false);
  await hold(page, HOLD - 800);
  await page.waitForTimeout(1000);
  assert.equal(await isOpen(page), false);
  await assertNoWords(page);
});

test("a 3 s hold opens the panel; Close shuts it and gives the focus back", { skip }, async (t) => {
  const page = await open(t);
  await openPanel(page);
  assert.ok(await focusInPanel(page));
  await page.getByRole("button", { name: "Close" }).tap();
  assert.equal(await isOpen(page), false);
  await focusBack(page);
});

test("holding Space on the corner for 3 s opens the panel; Escape shuts it", { skip }, async (t) => {
  const page = await open(t, "/");
  await page.locator(".corner").focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(HOLD - 800);
  await page.keyboard.up("Space");
  assert.equal(await isOpen(page), false);
  await page.keyboard.down("Space");
  await page.waitForTimeout(HOLD + 300);
  await page.keyboard.up("Space");
  assert.ok(await isOpen(page));
  assert.ok(await focusInPanel(page));
  // Letting go of Space in the panel changes nothing.
  assert.equal(await page.getByRole("button", { name: "Sound" }).getAttribute("aria-pressed"), "true");
  await page.keyboard.press("Escape");
  assert.equal(await isOpen(page), false);
  await focusBack(page);
});

test("sound off silences every sound", { skip }, async (t) => {
  const page = await open(t);
  // Count every voice that starts.
  await page.evaluate(() => {
    window.voices = 0;
    const start = AudioScheduledSourceNode.prototype.start;
    AudioScheduledSourceNode.prototype.start = function (...args) {
      window.voices++;
      return start.apply(this, args);
    };
  });
  const playAll = (p) =>
    p.evaluate(async (names) => {
      const { play } = await import("/engine/sound.js");
      window.voices = 0;
      for (const name of names) play(name);
      return window.voices;
    }, Object.keys(SOUNDS));

  // The first touch starts the audio.
  await page.touchscreen.tap(195, 20);
  await page.waitForTimeout(200);
  assert.ok((await playAll(page)) > 0, "sounds play before sound is off");

  await openPanel(page);
  const sound = page.getByRole("button", { name: "Sound" });
  await sound.tap();
  assert.equal(await sound.getAttribute("aria-pressed"), "false");
  assert.equal(await sound.textContent(), "Off");
  await page.getByRole("button", { name: "Close" }).tap();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("ddp-kids"))), { version: VERSION, ...DEFAULTS, sound: false });
  assert.equal(await playAll(page), 0);
});

test("reset clears progress after a second tap, and closing starts the page again", { skip }, async (t) => {
  const page = await open(t);
  const before = JSON.stringify({ version: VERSION, sound: false, progress: { chess: { met: ["R", "B"] } } });
  await page.evaluate((v) => localStorage.setItem("ddp-kids", v), before);
  await openPanel(page);
  assert.match(await page.locator(".parent-saved").textContent(), /"met"/);

  const reset = page.locator('[data-act="reset"]');
  await reset.tap();
  assert.equal(await page.evaluate(() => localStorage.getItem("ddp-kids")), before, "one tap only asks");
  assert.equal(await reset.textContent(), "Tap again to reset");
  await reset.tap();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("ddp-kids"))), { version: VERSION, ...DEFAULTS, sound: false });
  assert.ok(await page.locator(".parent-note").isVisible());

  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Close" }).tap()]);
  await page.locator(".corner").waitFor();
  assert.equal(await isOpen(page), false);
  await assertNoWords(page);
});
