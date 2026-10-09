# Khasino: independent accounts and hosting

This package contains the complete current game (AI, teams, rooms, rated matches, tournaments, animations and online timers) plus independent Firebase accounts. Its account screens have no ChatGPT login links. Cloudflare Workers hosts the app and D1 replaces the Sites R2 object store with atomic conditional writes.

Status: built and locally tested with mocked Firebase/Google responses and a real SQLite database. Not yet connected to real provider projects, not deployed to Cloudflare, and not browser-tested. The existing public Khasino remains available at its current URL.

## 1. Create the free projects

- Cloudflare: create a free account at https://dash.cloudflare.com, select a Workers subdomain. Use the Workers Free plan.
- Firebase: https://console.firebase.google.com — create a project on Spark (no billing upgrade). Add a Web app to obtain its Web API key. Authentication → Sign-in method: enable Email/Password and Google. Set the support email. Do not enable phone authentication.
- Google Cloud: use the same project's OAuth web client. Set the consent-screen brand to Khasino. Add the exact redirect URI `https://khasino.YOUR-SUBDOMAIN.workers.dev/api/auth/callback`. Configure only `openid email profile` scopes. Publish the OAuth app for external users when ready; while in Testing, add your testers.
- In Firebase Authentication Settings → Authorized domains, add the new Workers hostname. In the email verification and password reset templates, customize the action URL to `https://khasino.YOUR-SUBDOMAIN.workers.dev/`. The game handles the `mode` and `oobCode` parameters. Set the sender/display branding to Khasino where Firebase supports it.

Do not paste OAuth client secrets into chat or commit them. The Firebase Web API key is not a service-account private key. Restrict it to the Firebase auth APIs required by this server implementation; browser referrer restrictions do not work for these server requests.

## 2. Deploy from this package

Unzip the package. In a terminal opened inside its `khasino-cloudflare` folder, run:

```sh
npx wrangler login
npx wrangler d1 create khasino
```

Copy the database ID from the second command. Then replace the two placeholders below with that ID and your real Workers hostname:

```sh
node configure.mjs DATABASE_ID https://khasino.YOUR-SUBDOMAIN.workers.dev
npx wrangler d1 execute khasino --remote --file schema.sql
npx wrangler secret put FIREBASE_API_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler deploy
```

Each `secret put` command prompts for its value. The client ID and secret must belong to the OAuth web client configured above. The JSON configuration must contain `DB` as its D1 binding and `APP_ORIGIN` as the exact new origin. Do not use Sites `.openai/hosting.json` for this deployment.

## 3. Verify before switching links

1. Open the new URL in a private window. Check guest computer play.
2. Create an email account, open its verification email, verify, then log in. Save the display name.
3. Log out and sign in with Google. Check the profile remains attached to the same Firebase identity when linked by the provider. Accounts that use different identities are separate.
4. Test password reset and expired/used links. Confirm the email links return to Khasino.
5. Use two distinct accounts/browsers to play a room, reconnect, let a timer expire, finish a ranked match, and check ratings. Use four accounts to verify team play and tournaments.
6. Check mobile and desktop stack labels, animations, and timer layout before public announcement.

## Data and costs

Free tiers have quotas; this is a small-launch target, not an unlimited hosting guarantee. Keep Cloudflare and Firebase on their no-cost plans. This implementation uses no paid R2 bucket and does not need custom SMTP. Google/email auth is supplied by Firebase. Consult the current official quotas before a larger launch:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/auth/limits

New-host accounts and ratings start fresh. Existing Sites records are keyed by ChatGPT identity and cannot safely be reassigned by matching names. No production records have been deleted or exported. If preserving them is required, implement an explicit verified account-linking migration before moving. Guest local saves are origin-specific and will not automatically appear on the new domain.

A custom domain is optional and requires ownership of that domain. The default external address is a `workers.dev` subdomain, whose availability is determined by Cloudflare. A future custom domain must be reflected in APP_ORIGIN, OAuth redirect URIs, Firebase domains, and email action links.

## Security and implementation

Passwords go only to Firebase over HTTPS through the game server and are not stored in game records. Opaque 30-day HttpOnly/Secure/SameSite cookies identify server-side sessions. Firebase validates identities; the public wrapper strips caller-provided identity headers. Provider tokens are stored server-side in D1, never returned to browser JavaScript. Google OAuth uses single-use, browser-bound state. Auth actions require same-origin JSON POST, with a 20-attempt/IP/ten-minute throttle. Sign-out deletes the local session. Firebase's own provider quotas also apply.

Email verification is required before a session can be created. OAuth identities are prefixed with `firebase:`. Session reads verify the current Firebase user and refresh expired tokens. Configure project access carefully: provider tokens in D1 require restricting administrative database access. Expired sessions and OAuth flow records are rejected, but periodic storage cleanup remains useful for larger launches.

Source files: entry.js public request boundary; auth.js provider/session endpoints; storage.js D1 adapter; account-ui.js browser forms. build/game.js is the complete generated game. The original repository's `node migration/cloudflare/build.mjs` regenerates it from the current source. The package contains the built Worker, so this standalone deployment does not need a game build step.
