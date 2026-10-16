# Architecture

ddp-kids is a set of word-free board games for children aged 3 to 6. One
small Node server on Wasmer Edge only serves files; everything else runs in
the browser, on one device. Progress stays on the device (`localStorage`).
There are no accounts, analytics, cookies or third-party requests.

## Layers

```text
server/          the static file server
public/
  index.html     the home page (a placeholder for now)
  engine/        shared by every game: theme, sound, board, input, ghost hand, prefs, parent area
  <game>/        one folder per game
test/            server tests; test/browser/ for Playwright
```

- **Server** (`server/`): `app.js` serves `public/` with the security headers
  below and answers `GET /healthz` with `{"ok":true}`. GET and HEAD only.
  It refuses `..`, dotfiles, test files and anything but plain path
  characters, and redirects `/<folder>` to `/<folder>/`. It uses only
  `node:http`, `node:fs` and `node:path`, which Wasmer's Edge.js runs, and
  logs nothing about visitors.
- **Engine** (`public/engine/`): behaviour every game shares. Every sound
  goes through `engine/sound.js`.
- **Game** (`public/<game>/`): rules in a pure `rules.js` (unit-tested,
  throws `RuleError` on bad input), stages as data in `lessons.js`, art in
  `pieces.js`.

## Security headers

On every response, including redirects and errors:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

The CSP has no `'unsafe-inline'`: styles go in files, and scripts set styles
through the CSSOM (`el.style.width = …`), never through `style` attributes.
HTML is `no-cache`; other files are cached for 5 minutes.

## Safety rules for the child

Every screen keeps these. The helpers in `test/browser/helpers.js` check
them, so a browser test that opens a page with `openPage()` gets the
automatic guards for free.

| Rule | Guarded by |
|---|---|
| No visible words outside the parent area (`[data-parent]`); screen-reader text goes in `aria-label` | `assertNoWords(page)` |
| Same origin only | The CSP; `openPage()` fails the test on any request to another origin, and blocks it |
| No errors | `openPage()` fails the test on any console error or page error, which includes CSP violations and missing files |
| No sideways scroll | `assertNoSideScroll(page)` |
| Big targets: every tappable thing is at least 64 px | Not yet: added with the first tappable thing |
| Nothing flashes more than 3 times a second; `prefers-reduced-motion` turns motion into fades | Not yet: added with the first motion |
| Quiet sound: every sound goes through `engine/sound.js` and stays under its loudness limit | Not yet: added with `engine/sound.js` |
| No dead ends: every screen has a way home; a wrong tap wiggles, it never blocks | Not yet: added with the first game screen |
| No pressure: no voice, timers, scores, streaks or "you lose" | Review (the PR checklist) |

## Tests

- `npm test` runs `public/**/*.test.js` (unit tests next to the code they
  test) and `test/*.test.js` (the server) with Node's test runner.
- `npm run test:browser` runs `test/browser/*.test.js` with Playwright in
  Chromium. `openPage(t, path, device)` opens a page on one of three touch
  devices: `tablet-landscape` (1024x768), `tablet-portrait` (768x1024) and
  `phone` (390x844). Playwright stays out of `package.json`; the helpers
  find it through `PLAYWRIGHT_MODULE`, a local install or the global one,
  and skip without it. CI installs it and fails if it doesn't load.
