# Khasino

The South African 40-card game, by Luyanda Gumede. Play offline against strategic computer opponents or online with friends, including opposing partnerships.

Live game: https://khasino.gluyanda11.workers.dev

## Features

- Two-, three- and four-player games, team scoring, builds, drift and chow.
- Builds and raises capped at 10. Matching groups can strengthen a compound build without increasing its value.
- Every team chow offers the partner a two-second **Leave it?** decision over blurred felt. Accepting requires the matching capture card; ownership changes publicly. Accepting a second build requires chowing one on the next turn while both remain owned.
- Physical card styling, felt texture, dealing and turn animations, sound effects and reduced-motion controls.
- Google and verified email/password accounts through Firebase Authentication, with server-managed sessions.
- Cloudflare Worker and D1 room persistence, hidden-hand views, atomic concurrent updates, reconnects and turn timers.
- Ratings, records, matchmaking and tournaments. No voice chat initially.

## Source layout

`src/engine.js` contains shared rules and bot strategy. `src/app.js`, `src/style.css` and `src/index.html` contain the table UI. `src/server.js` and `src/competitive-server.js` contain online rooms and competition. `tests/` contains rules, accounts and server checks. `docs/` contains architecture and design notes; some record earlier decisions.

`migration/cloudflare/` contains independent Google/email accounts, a D1 storage adapter and deployment instructions. The original Sites-compatible bundle remains under `worker/`; the live independent deployment uses the generated Cloudflare bundle instead.

## Build and test

Use Node 24 or later (the D1 adapter tests use Node's built-in SQLite module). No npm dependencies are required for the game build.

```sh
npm run check
npm test
npm run build
node migration/cloudflare/build.mjs
```

Generated `worker/index.js` embeds the shared engine and browser assets. Edit `src/` and rebuild rather than editing this generated file. The independent Worker entry point is `migration/cloudflare/build/entry.js`.

## Cloudflare deployment

See [the setup guide](migration/cloudflare/README.md) for Firebase providers, Google OAuth redirects, D1 schema and secret configuration. From a repository checkout, build with the commands above, then:

```sh
cd migration/cloudflare
node configure.mjs YOUR_D1_DATABASE_ID https://YOUR_WORKER.workers.dev
npx wrangler deploy
```

On Windows PowerShell use `npx.cmd` in place of `npx`. Configure `FIREBASE_API_KEY`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Worker secrets. Configuration and credentials are excluded from Git. Existing account data remains in Firebase and D1, not in this repository.

## Offline and rules notes

Offline play requires an initial successful load and service-worker installation. Saved offline hands and preferences belong to the current browser. Bots count public cards and evaluate likely capture replies; they cannot see other players' hands. Optional self-play tuning runs with `node scripts/train-bot.mjs`; it is not continuous live training.

Aces count as 1. Builds reserve matching capture cards, compound values stay fixed, augmentation is compulsory and partners cannot raise or chow each other's builds. Maximum build value is 10 even when physical card totals span several matching groups. Mandatory opponent claim windows and ambiguous cross-pile revisit ordering remain deferred. See [clarified rules](docs/clarified-rules.md).
