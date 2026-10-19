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
  <game>/        one folder per game: chess/ for now
test/            server tests; test/browser/ for Playwright
```

- **Server** (`server/`): `app.js` serves `public/` with the security headers
  below and answers `GET /healthz` with `{"ok":true}`. GET and HEAD only.
  It refuses `..`, dotfiles, test files and anything but plain path
  characters, and redirects `/<folder>` to `/<folder>/`. It uses only
  `node:http`, `node:fs` and `node:path`, which Wasmer's Edge.js runs, and
  logs nothing about visitors.
- **Engine** (`public/engine/`): behaviour every game shares; see
  [Engine](#engine).
- **Game** (`public/<game>/`): rules in a pure `rules.js` (unit-tested,
  throws `RuleError` on bad input), stages as data in `lessons.js`, art in
  `pieces.js`.

## Engine

The engine knows nothing about any game. It shows a board with marks and
pieces, takes taps and drags, plays the ghost hand and makes sounds; a game
gives it rules and art. Plain ES modules, loaded with
`<script type="module">`. Squares are `{ c, r }`: the column from the left
and the row from the top, from 0.

| File | What it does |
|---|---|
| `theme.css` | The tokens (Paper and clay's colours, radii, the 64 px `--target`, motion durations and eases), the base page (paper, no scroll bounce, no selection or callouts outside `[data-parent]`), the board, marks, pieces and hand, and reduced motion. Light only. Every colour, size and timing comes from its tokens; `token(name)` in `board.js` reads one from JavaScript |
| `prefs.js` | `getPrefs()` and `setPrefs(patch)`: this device's settings (`sound` for now) under one `localStorage` key, `ddp-kids`, with a version number. Blocked storage, a corrupt value or another version reads as the defaults |
| `sound.js` | `play(name)`: sounds made in code with WebAudio, started on the first touch or key, muted by `sound` in prefs. `land` (a wooden tok), `fit` (a soft chime as a piece fills its shadow), `arrive` (a new piece) and `nope` (a very soft tap for a wrong square). All stay under one loudness limit, `LIMIT` |
| `board.js` | `createBoard(host, { cols, rows, label })`: squares that fit `host` (a CSS grid with an aspect ratio), marks under the pieces, and the pieces. See below |
| `input.js` | `listen(board, onInput)`: touch, mouse and keyboard as one callback. `{ type: "tap", square, id }` for a tapped square (`id` is the piece on it, or `null`); `{ type: "drop", id, from, to }` for a piece dragged and let go (`to` is `null` off the board). For a drop, `onInput` returns `true` and moves the piece, or the piece snaps back to where the board has it (a game may have moved it mid-drag). Arrow keys move a focus ring; Enter or Space picks up and puts down |
| `hand.js` | `createHand(board).show(steps)`: the ghost hand plays `press`, `drag`, `release` and `return` steps over the board, and resolves `true` when done or `false` when a touch or key cancelled it. With reduced motion, the target square pulses instead |

The board's methods:

| Method | Does |
|---|---|
| `place(id, art, square, label)` | Puts the art (SVG markup) on a square as piece `id` |
| `move(id, square, how)` | Slides (`how` is `"slide"`, the default), hops (`"hop"`) or walks (`"walk"`, slower and softer) the piece there from wherever it shows; resolves when it's there. Fades with reduced motion |
| `land(id)`, `wiggle(id)` | A small squash as a piece lands; a wiggle for a wrong square |
| `dots(squares, from)` | Dots on the squares, rippling out from `from` one ring at a time; they replace the dots before |
| `mark(kind, square, art)`, `clear(kind)` | Marks under the pieces: `fill` (a honey square), `outline`, `dot`, `shadow` (the art as a dashed honey outline) and `pulse`. Filling a square with a shadow on it fits the shadow. `clear()` with no kind clears them all |
| `where(id)`, `pieceAt(square)`, `squareAt(x, y)`, `rect(square)` | Where a piece is, which piece is on a square, the square under a point on the screen, and a square's box on the screen |
| `lift(id, up)`, `drag(id, x, y)` | Used by `input.js` and `hand.js`: a piece lifts, and shows away from its square |

The board makes no sounds: a game plays `land` when a piece lands, `fit`,
`arrive` and `nope` itself. The ghost hand plays `land` when it lets go.

## Chess

`public/chess/` is the first game. `/chess/` opens the playground, which
teaches one piece at a time.

| File | What it holds |
|---|---|
| `rules.js` | Where pieces can go: `moves()`, `play()`, `distance()` and `attacked()`. Pure, unit-tested in `rules.test.js` |
| `lessons.js` | `LESSONS`: the pieces in the order a child meets them (rook, bishop, queen, king, knight, pawn), each with its start square |
| `pieces.js` | `art(type, side)`: each piece as SVG markup in Paper and clay, for `"you"` (clay) and `"ink"`; `DEFS`, the gradients and wobble the art uses, once per page; `NAMES` for screen readers. `style.css` gives the colours |
| `playground.js` | The page's script, built on the engine |
| `index.html`, `style.css` | The page: the home button (a small house, 64 px, top left, back to `/`) and the board below it, or beside it in landscape |

The playground's toy stage puts one piece on an empty board: the rook,
or the piece `?piece=B` (or `Q`, `K`, `N`, `P`) names. Sage dots ripple out
to every square `moves()` allows. A tap on a dot, or a drag there, moves the
piece (the knight hops); it lands with a squash and `land`, and the dots
ripple out again. Any other square wiggles it once, with `nope`; wiggles
never overlap, so fast taps can't make it flicker. While the piece moves,
taps and drops do nothing. When the page opens, the ghost hand shows one
move 2 or 3 squares away and the piece's shadow stays there until the child
moves; any touch stops the hand. A pawn on the far row waits `--walk-wait`
and walks back to its start, so the toy never gets stuck.

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
| Big targets: every tappable thing is at least 64 px (board squares on phones are smaller; dragging works there too) | `test/browser/playground.test.js` measures the home button |
| Nothing flashes more than 3 times a second; `prefers-reduced-motion` turns motion into fades | The engine's motion is in `theme.css`; `test/browser/engine.test.js` checks the hand turns into a slow pulse; `test/browser/playground.test.js` checks fast wrong taps wiggle at most 3 times a second |
| Quiet sound: every sound goes through `engine/sound.js` and stays under its loudness limit | `public/engine/sound.test.js` measures every sound against `LIMIT` |
| No dead ends: every screen has a way home; a wrong tap wiggles, it never blocks | `test/browser/playground.test.js`: the home button, wrong taps and drops, fast taps, and the pawn's walk back |
| No pressure: no voice, timers, scores, streaks or "you lose" | Review (the PR checklist) |

## Tests

- `npm test` runs `public/**/*.test.js` (unit tests next to the code they
  test) and `test/*.test.js` (the server) with Node's test runner.
- `npm run test:browser` runs `test/browser/*.test.js` with Playwright in
  Chromium. `openPage(t, path, device)` opens a page on one of three touch
  devices: `tablet-landscape` (1024x768), `tablet-portrait` (768x1024) and
  `phone` (390x844). The test server also serves the test pages in
  `test/browser/fixtures/` under `/fixtures/`; the site never does.
  `engine.test.js` drives the engine through `fixtures/engine/`.
  Playwright stays out of `package.json`; the helpers
  find it through `PLAYWRIGHT_MODULE`, a local install or the global one,
  and skip without it. CI installs it and fails if it doesn't load.
