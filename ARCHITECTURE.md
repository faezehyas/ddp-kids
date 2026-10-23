# Architecture

ddp-kids is a set of word-free board games for children aged 3 to 6. One
small Node server on Wasmer Edge only serves files; everything else runs in
the browser, on one device. Progress stays on the device (`localStorage`).
There are no accounts, analytics, cookies or third-party requests.

## Layers

```text
server/          the static file server
public/
  index.html     the home shelf (home.css, home.js), one box per game in games.json
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
- **Home** (`public/index.html`, `home.css`, `home.js`): a bookcase with one
  lidded box per game in `public/games.json`. Each entry is `slug`, `label`
  (the box's `aria-label`), `art` (SVG markup for the lid, in a 40x40 view
  box, coloured by the classes `clay` and `clay-dark`) and `path`. Tapping a
  box, or Enter or Space on it, lifts the lid with the `land` tok and opens
  `path` once the lid is up; the game picks up where the child left off.
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
| `theme.css` | The tokens (Paper and clay's colours, radii, the 64 px `--target`, motion durations and eases), the base page (paper, no scroll bounce, no selection or callouts outside `[data-parent]`), the board, marks, pieces and hand, the parent area, and reduced motion. Light only. Every colour, size and timing comes from its tokens; `token(name)` in `board.js` reads one from JavaScript |
| `prefs.js` | `getPrefs()` and `setPrefs(patch)`: this device's settings and progress under one `localStorage` key, `KEY` (`ddp-kids`), with a version number: `sound`, and `progress`, each game's progress under its slug (`{}` starts every game afresh). Blocked storage, a corrupt value or another version reads as the defaults. `resetProgress()` keeps the settings in `SETTINGS` (`sound`) and puts everything else in `DEFAULTS` back, so a game's progress belongs in `progress` |
| `sound.js` | `play(name)`: sounds made in code with WebAudio, started on the first touch or key, muted by `sound` in prefs. `land` (a wooden tok), `fit` (a soft chime as a piece fills its shadow), `arrive` (a new piece) and `nope` (a very soft tap for a wrong square). All stay under one loudness limit, `LIMIT` |
| `board.js` | `createBoard(host, { cols, rows, label })`: squares that fit `host` (a CSS grid with an aspect ratio), marks under the pieces, and the pieces. See below |
| `input.js` | `listen(board, onInput)`: touch, mouse and keyboard as one callback. `{ type: "tap", square, id }` for a tapped square (`id` is the piece on it, or `null`); `{ type: "drop", id, from, to }` for a piece dragged and let go (`to` is `null` off the board). For a drop, `onInput` returns `true` and moves the piece, or the piece snaps back to where the board has it (a game may have moved it mid-drag). Arrow keys move a focus ring; Enter or Space picks up and puts down |
| `hand.js` | `createHand(board).show(steps)`: the ghost hand plays `press`, `drag`, `release` and `return` steps over the board, and resolves `true` when done or `false` when a touch or key cancelled it. With reduced motion, the target square pulses instead |
| `parent.js` | `addParentCorner()`: the parent area, the only place with words. Every page calls it once. See below |

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

The parent area: a faint button, `--target` square, fixed in the top right
corner of every page (keep that corner free). A tap gives one small pulse
(one at a time) and nothing else. Holding it for `--hold` (3 s), by touch,
mouse or Space, fills a ring and opens a modal `<dialog data-parent>` in
plain English: sound on or off, reset progress (a second tap confirms),
about, and privacy, which shows the prefs key and what it holds now. Focus
moves into the dialog; Escape and Close shut it and give the focus back to
the button. After a reset, closing it reloads the page, so a game only reads
its progress on load. With reduced motion the ring fades in instead.

The board makes no sounds: a game plays `land` when a piece lands, `fit`,
`arrive` and `nope` itself. The ghost hand plays `land` when it lets go.

## Chess

`public/chess/` is the first game. `/chess/` opens the playground, which
teaches one piece at a time.

| File | What it holds |
|---|---|
| `rules.js` | Where pieces can go: `moves()`, `play()`, `distance()` and `attacked()`. Pure, unit-tested in `rules.test.js` |
| `lessons.js` | `LESSONS`: the pieces in the order a child meets them (rook, bishop, queen, king, knight, pawn), each with its start square and its steps: `free` moves before the first shadow, `shadows` to fill and the `distance` in moves a shadow needs in round 1 and round 2. `shadowSquares()` lists where the next shadow can go. Unit-tested in `lessons.test.js` |
| `pieces.js` | `art(type, side)`: each piece as SVG markup in Paper and clay, for `"you"` (clay) and `"ink"`; `DEFS`, the gradients and wobble the art uses, once per page; `NAMES` for screen readers. `style.css` gives the colours |
| `playground.js` | The page's script, built on the engine |
| `index.html`, `style.css` | The page: the home button (a small house, 64 px, top left, back to `/`), the parent corner (top right), the board below them, or beside them in landscape, and the tray under the board, or beside it in landscape |

The playground's toy stage puts one piece on an empty board: the rook at
first, the piece the child was on after that, or the one `?piece=B` (or `Q`,
`K`, `N`, `P`) brings in. Sage dots ripple out to every square `moves()`
allows. A tap on a dot, or a drag there, moves the piece (the knight hops); it lands with a squash and `land`, and the dots
ripple out again. Any other square wiggles it once, with `nope`; wiggles
never overlap, so fast taps can't make it flicker. While the piece moves,
taps and drops do nothing. When a piece comes in, the ghost hand shows one
move 2 or 3 squares away and the piece's shadow stays there until the child
moves; any touch stops the hand. A pawn on the far row waits `--walk-wait`
and walks back to its start, so the toy never gets stuck.

After `free` moves, a dashed honey shadow of the piece waits on a square
`shadowSquares()` picks: `distance` moves away (1 in round 1), 2 or more
squares off when it can be, not on a filled square. Landing there fits the
piece into it with `fit`: the square stays honey and a pip fills on the
tray. A shadow a pawn can no longer reach moves. If the child does nothing
for `--idle` while a shadow waits, the ghost hand shows the way there, one
drag per move; any touch or key starts the wait again. After `shadows`
filled shadows, the next piece bobs on the tray, and after `--next-wait`
the piece walks to its slot and the next rolls out to its start square
with `arrive` (with reduced motion it fades in there), and its toy stage
begins.

The tray has a 64 px slot for every piece: the ones met in colour, the one
on the board as an empty well, the next as an outline and the rest faint.
Tapping a piece met before brings it back; any other slot wiggles. Once all
six are met, the next piece is the next in order again, and a piece that
comes back then plays round 2. Progress is saved in prefs as
`progress.chess`: `met`, `piece`, `round` (0 or 1) and `filled`, so `/chess/`
opens where the child left it.

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
| No visible words outside the parent area (`[data-parent]`); screen-reader text goes in `aria-label` | `assertNoWords(page)`; `test/browser/parent.test.js` checks a tap on the corner never opens it, only a 3 s hold |
| Same origin only | The CSP; `openPage()` fails the test on any request to another origin, and blocks it |
| No errors | `openPage()` fails the test on any console error or page error, which includes CSP violations and missing files |
| No sideways scroll | `assertNoSideScroll(page)`, which also reads the body's width, since `theme.css` hides its overflow |
| Big targets: every tappable thing is at least 64 px (board squares on phones excepted; dragging works there too) | `assertBigTargets(page)` |
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
