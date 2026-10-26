# Contributing

## Ground rules

- **The child comes first:** every change keeps the safety rules in
  [ARCHITECTURE.md](ARCHITECTURE.md#safety-rules-for-the-child).
- **Plain JavaScript, HTML and CSS:** no frameworks, no build step and no
  dependencies at all. Server code uses only `node:http`, `node:fs` and
  `node:path`.
- **No secrets** in the repo, and the server never logs IP addresses.
- **Where code goes:** shared behaviour in `public/engine/`, game rules in
  the game's pure `rules.js`, stages as data in `lessons.js`, art in
  `pieces.js`, server code only in `server/`.
- **Commits** follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):
  `type(scope): description`, e.g. `feat(chess): add the rook's dots`.
- **Branches** are named `<type>/<topic>`, e.g. `feat/chess-goals`.
- **No AI-tool files:** no `CLAUDE.md`, `AGENTS.md` or `.claude/` in the repo.

## Commands

```bash
npm start              # http://localhost:8080
npm run dev            # restarts on changes
npm test               # server and unit tests
npm run test:browser   # Playwright browser tests (skip without Playwright)
npm run test:all       # both
```

Rerun one browser test file with `node --test test/browser/<file>.test.js`.
Screenshots go to `test-artifacts/`, which git ignores.

## Recipe: add a game

Chess (`public/chess/`) is the example for every step.

1. **Folder:** `public/<game>/` with `index.html`, `style.css`, `rules.js`,
   `lessons.js`, `pieces.js` and the page's script (chess:
   `playground.js`). The server serves it at `/<game>/`.
2. **Rules:** pure functions in `rules.js`, unit-tested in `rules.test.js`
   next to it; bad input throws `RuleError`. No DOM, randomness, clock or
   storage. Chess: `moves(position, id)` lists the squares a piece can go
   to, and the page draws its dots from them.
3. **Stages:** data in `lessons.js`, read by the page. Chess: `LESSONS`,
   the pieces in order with their start squares and steps (free moves,
   shadows to fill, their distance per round); `?piece=B` opens one. A
   game saves its progress with `setPrefs()` under `progress.<game>` and
   checks what it reads back.
4. **Art:** each piece is SVG markup in `pieces.js` with
   `aria-hidden="true"`, drawn with classes so `style.css` gives the
   colours from the tokens (the CSP refuses `style` attributes). Gradients
   and filters go once per page (chess: `DEFS`). The board draws the same
   markup as the piece's dashed shadow. Give each piece a name for screen
   readers (chess: `NAMES`).
5. **Page:** `index.html` links `/engine/theme.css` before its own
   `style.css`, the manifest and the touch icon (copy them from
   `chess/index.html`), and loads its script with `<script type="module">`. Its
   fixed controls are the home button, an `<a href="/">` with a small house
   and `aria-label="Home"`, `--target` (64 px) square in the top left
   corner, and the parent corner in the top right (step 6). `style.css`
   sizes a `<main>` box for the board, phone portrait first (below the two
   buttons) and beside them in landscape, with `--margin` around it.
   Colours, sizes and timings come only from the tokens in `theme.css`; a
   new one goes there.
6. **Script:** builds the screen from the [engine](ARCHITECTURE.md#engine),
   with no board, input or hand code of its own:
   - `createBoard()` in the page's box, `place()` the piece with its name,
     and `dots()` from the rules.
   - `listen()`: a legal tap or drop calls `move()`, then `land()` and
     `play("land")`, and returns `true` for a drop; anything else calls
     `wiggle()` and `play("nope")`, one wiggle at a time. Ignore input
     while a piece moves, and never leave the child stuck (chess: the pawn
     walks back from the far row).
   - `createHand().show()` once when the page opens, to show a move.
   - `addParentCorner()` from `engine/parent.js` once, for the parent area.
     Its reset puts `progress` back to `{}` and reloads the page, so read
     the game's progress when the page loads.
   - `workOffline()` from `engine/offline.js` once.
7. **Sound:** only the engine's: `play()` from `engine/sound.js` with
   `land`, `fit`, `arrive`, `take` or `nope`. A new sound goes into `SOUNDS` in
   `engine/sound.js`, where its test keeps it under the loudness limit.
8. **Browser test:** `test/browser/<game>.test.js` (chess:
   `playground.test.js`) opens the page with `openPage()` on all three
   devices and calls `assertNoWords()`, `assertNoSideScroll()` and
   `assertBigTargets()`; it checks the home button, taps, drags (`finger()`
   in `helpers.js`), wrong squares, fast taps and the hand, and compares
   what the page shows with `rules.js`, which it imports.
9. **Check by hand:** play it with touch at 1024x768 and 390x844 the way a
   4-year-old would: tap fast, tap wrong squares, drag off the board, and
   leave it alone for a while. Check 360 px wide and phone landscape too.
10. **Offline:** add the game's files to `FILES` in `public/sw.js`.
    `npm test` fails until every file under `public/` is there, and gives
    the new `VERSION` to set; any change to a file under `public/` needs
    one.
11. **Shelf:** add one entry to `public/games.json`: `slug`, `label`,
    `art` (the lid's picture as SVG markup in a 40x40 view box, using the
    classes `clay` and `clay-dark`) and `path` (`/<game>/`). The home shelf
    shows a box for it.
12. **Docs:** describe the game in [ARCHITECTURE.md](ARCHITECTURE.md), move
    it in [GAMES.md](GAMES.md) and open the PR with the template's
    checklist.
