// The service worker: keeps every file of the site on this device once it
// has been opened, so it works offline, and serves them from there first.
// Only same-origin GET requests for the files below; anything else goes to
// the network. A deploy that changes a file changes VERSION (sw.test.js
// says what to), so the browser fetches the new files into a new cache and
// switches to them on the next visit, when no page uses the old ones.
const VERSION = "fc526cc954b0";
const CACHE = `ddp-kids-${VERSION}`;

// Every file under public/ but this one and the tests; a folder's index.html
// as the folder. sw.test.js checks the list.
const FILES = [
  "/",
  "/chess/",
  "/chess/lessons.js",
  "/chess/pieces.js",
  "/chess/playground.js",
  "/chess/rules.js",
  "/chess/style.css",
  "/engine/board.js",
  "/engine/hand.js",
  "/engine/input.js",
  "/engine/offline.js",
  "/engine/parent.js",
  "/engine/prefs.js",
  "/engine/sound.js",
  "/engine/theme.css",
  "/games.json",
  "/home.css",
  "/home.js",
  "/icon-192.png",
  "/icon-512.png",
  "/icon.svg",
  "/manifest.webmanifest",
  "/rook.svg",
];

// cache: "reload" skips the browser's HTTP cache, which may still hold files
// from before the deploy.
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: "reload" })))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)))));
});

// ignoreSearch: /chess/?piece=B is /chess/.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(caches.match(request, { cacheName: CACHE, ignoreSearch: true }).then((hit) => hit || fetch(request)));
});
