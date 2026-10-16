# ddp-kids

Word-free board games for children aged 3 to 6, starting with chess. They run in the browser on one device, with no sign-up, no ads and no tracking.

## Run

Node 22 or newer. There are no dependencies to install.

```bash
npm start      # http://localhost:8080 (HOST and PORT to change)
npm run dev    # the same, restarting on changes
```

## Test

```bash
npm test               # server and unit tests
npm run test:browser   # Playwright, on three touch devices
```

The browser tests skip themselves without Playwright: `npm install --global playwright && npx playwright install chromium`, or set `PLAYWRIGHT_MODULE`.

## Deploy

Every push to `main` deploys to Wasmer Edge as the app `ddp-kids` (see `app.yaml`). The repo holds no secrets.

See [ARCHITECTURE.md](ARCHITECTURE.md), [CONTRIBUTING.md](CONTRIBUTING.md) and [GAMES.md](GAMES.md).
