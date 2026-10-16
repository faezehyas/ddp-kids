## Summary

<!-- What changes and why. -->

## Screenshots

<!-- Only the pages this change touches. Delete if nothing visible changed. -->

| 1024x768 | 768x1024 | 390x844 |
|---|---|---|
| | | |

## Known limitations

<!-- What doesn't work yet, or "None". -->

## Tests run

<!-- The tests you ran and their results, and what you checked by hand with touch. -->

## Checklist

<!-- Tick what applies and delete the rest. The rules are in ARCHITECTURE.md. -->

- [ ] No visible words outside `[data-parent]`; screen-reader text in `aria-label`
- [ ] No voice, timers, countdowns, scores, streaks or "you lose"
- [ ] Every tappable thing is at least 64 px
- [ ] Nothing flashes more than 3 times a second; `prefers-reduced-motion` turns motion into fades
- [ ] Every sound goes through `engine/sound.js` and stays quiet
- [ ] Every screen has a way home; a wrong tap wiggles and never blocks
- [ ] Same origin only: no requests to other origins, no inline styles or scripts
- [ ] Checked with touch at 1024x768, 768x1024 and 390x844, with no sideways scroll
- [ ] `npm test` and `npm run test:browser` pass, and the browser tests really ran
- [ ] No dependencies, no build step, no secrets
- [ ] Every commit message follows Conventional Commits
