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

An outline for now; the first game fills in the details.

1. **Folder:** `public/<game>/` with `index.html`, `style.css`, `rules.js`,
   `lessons.js`, `pieces.js` and the page's script.
2. **Rules:** pure functions in `rules.js`, unit-tested in `rules.test.js`
   next to it; bad input throws `RuleError`.
3. **Stages:** data in `lessons.js`, read by the game's page.
4. **Page:** `index.html` links `/engine/theme.css` before its own
   `style.css` and loads its script with `<script type="module">`. The
   script builds the screen from the [engine](ARCHITECTURE.md#engine):
   `createBoard()` in a box the page sizes (phone portrait first),
   `listen()` for taps, drags and keys, and `createHand()` to show a move.
   Colours, sizes and timings come only from the tokens in `theme.css`.
5. **Art and sound:** each piece is SVG markup in `pieces.js`, which the
   board also draws as the piece's shadow. Sounds are the engine's: `play()`
   from `engine/sound.js` with `land`, `fit`, `arrive` or `nope`. A new
   sound goes into `SOUNDS` in `engine/sound.js`, where its test keeps it
   under the loudness limit.
6. **Browser test:** `test/browser/<game>.test.js` opens the game with
   `openPage()` on all three devices and calls `assertNoWords()` and
   `assertNoSideScroll()`.
7. **Check by hand:** play it with touch at 1024x768 and 390x844 the way a
   4-year-old would: tap fast, tap wrong squares, drag off the board, and
   leave it alone for a while.
8. **Docs:** move the game in [GAMES.md](GAMES.md) and open the PR with the
   template's checklist.
