# Khasino: architecture and first implementation plan

Prepared 8 October 2026. Scope: offline computer opponents and online private multiplayer, mobile-friendly web application, R0 budget. Voice chat is deferred. This is the project specification and implementation backlog; no playable application or deployment is claimed.

## 1. Product decisions

Build a React + TypeScript progressive web app with a pure TypeScript rules engine shared by the browser and the online server. Offline AI means an ordinary computer opponent running on the device, not a paid AI model or API. Once the application has been loaded and cached, offline mode must work without an internet connection. Online mode needs connectivity.

Deliver in increments: two-player offline first; then online two-player rooms; then three-player and four-player singles; then four-player partnerships. Both offline and online remain required final features. Do not market an initial two-player slice as the complete game.

Use guest nicknames and private invitation codes first. Defer accounts, rankings, matchmaking, paid services, voice, spectator mode, and native app-store packaging. Use original interface, card artwork, and explanations. The supplied PDF is the reference for mechanics, not an asset pack.

## 2. Rules extracted from the PDF

References below use physical PDF page numbers, including the cover as page 1. Interpretations in section 3 are explicitly provisional.

| Topic | Reference requirement | Page |
| --- | --- | --- |
| Deck | 40 cards: Ace through 10 in four suits; remove Jacks, Queens, Kings | 2 |
| Players | Two, three, or four; four can be singles or partners | 2, 6 |
| Direction | Anticlockwise | 3 |
| Dealer selection | Players draw facedown cards; highest number selects dealer; another player cuts | 3 |
| Two-player deal | Ten each, empty table, twenty undealt; another ten each after first hands finish | 3, 6 |
| Three-player deal | Thirteen each and one face-up table card | 3 |
| Four-player deal | Ten each and an empty table | 3 |
| Capture | Played rank matches loose cards, sums of disjoint loose-card sets, or a whole build's value | 4 |
| Build limit | Maximum build value 10; creator retains a matching capture card | 3-4 |
| Simple build | One group whose cards sum to its declared value | 3 |
| Compound build | At least two groups, each independently matching the declared value; value cannot change | 3, 5 |
| Ownership | Builds have owners; loose cards do not | 3 |
| Raise | Add one hand card to an opponent's simple build; retain matching new rank; ownership transfers | 4 |
| Augment | Add equal-value groups; eligible sources include loose table cards, one hand card, exposed opponent capture tops | 5-6 |
| Captured piles | Only exposed tops can enter augmentation; never directly capture them; own/team tops unavailable | 4-6 |
| Unique build value | No two separate builds of the same value; same-side matching builds merge | 6 |
| Turn | Exactly one hand card; multiple table-only build/augment actions may occur before or after | 3-4 |
| Drift | Discard restrictions apply to a two-player first deal when owning a build | 3, 5-6 |
| Obligation | Must not spend the last matching hand card elsewhere and abandon an owned build | 5 |
| Stash | Add a matching hand card to solidify an owned build while retaining a capture card | 6 |
| Partnership proof | Certain public past build events justify building for partner until partner plays that rank | 6 |
| Partner interception | Shiya/Stash can leave a partner's capture in play and transfer ownership; exceptional two-build obligation | 6 |
| End | Last capturer receives remaining table cards | 6 |
| Eleven-point mode | Two players or partnerships: most cards 2, most spades 2, 2-spades 1, 10-diamonds 2, each Ace 1 | 2 |
| Seven-point mode | Three players or four singles: omit most cards and most spades | 2-3 |
| Majority ties | In eleven-point mode, split the tied category 1-1 between the two sides | 2 |

A capture of a 6 can take a loose 6 and a 6-build. It cannot combine a build of 6 with a loose 4 to capture with 10. Builds remain indivisible. A compound 10 containing two groups of ten is captured with a 10, despite its physical cards totalling twenty.

## 3. Rule ambiguity register

These defaults support initial development. Advanced features with unresolved semantics must remain labelled experimental or disabled in public rooms until clarified. Pin the rules profile to each saved game and online room; never change it midway.

| ID | Uncertainty / conflict | Provisional implementation decision | Implementation consequence |
| --- | --- | --- | --- |
| A01 | Page 4 mentions Ace as 14, while examples use Ace as 1 and builds cap at 10 | Ace always 1 in this South African 40-card profile; treat 14 example as inconsistent text | Explicit rank-to-value function; test A+9=10 and no Ace capture of 14 |
| A02 | Highest draw ties, first seat, deal order, subsequent dealer not specified | Redraw tied highest players; first player is next anticlockwise after dealer; deal one at a time anticlockwise; rotate dealer next hand | Room rules disclose these house defaults |
| A03 | Opponents may insist on full capture or let omissions stand; overlapping sum sets can make 'all' impossible | Initial digital profile automatically takes a deterministic maximum-card legal capture from disjoint groups; tie-break by point-card value, then stable IDs. Builds and same-rank singletons are eligible separately. This removes optional opponent claims and is a house rule | Use bounded subset search; explain selected capture; test competing partitions. Later PDF claim mode needs a response phase |
| A04 | Opponents may require augmentation before turn ends | Initial simplified profile makes augmentation optional and clearly labels this deviation. PDF claim-compatible profile later adds claim/response resolution | Do not claim complete PDF fidelity for initial slice |
| A05 | Smallest-on-top requirement plus 'cannot return' capture-pile exception is incomplete | Display simple groups descending, smallest uppermost; preserve submitted augmentation source order. Do not implement the cross-pile exception by guess | Captured-pile augmentation remains behind an experimental flag until trace examples resolve revisit rules |
| A06 | Order in which newly captured cards are stacked is unspecified, but exposed top changes future play | Provisionally capturing hand card is placed on top; other captured cards ordered deterministically by selected group then card ID | Persist exact pile array, not just a set/count; disclose default; confirm whether players may choose stacking order |
| A07 | One build per player except partnership interception; last page says cannot augment both own and opponent build despite allowing several actions | Normal owner limit one; same-value owned groups merge. Exceptional Shiya grants two distinct-value builds and requires a capture on owner's next turn. Restriction on augmenting both is unresolved | Gate partnership/combined augmentation combinations until scenarios clarified |
| A08 | How to preserve a build when using a matching hand card for another move; no matching card after hand exhaustion | A player must retain a capture card for each owned build after any accepted action unless that build was captured/transferred in the action | Validate ownership obligations after every action; first-deal transition cannot legalize an abandoned build |
| A09 | Partner interruption timing and whether Augment/Full-capture claims can interrupt it | Offer a finite Shiya response window before partner capture commits. Auto-pass if disconnected. Accept only if recipient can legally capture and satisfy resulting obligations | Explicit awaiting-partner state; server uses secret hand to validate but broadcasts only public outcome |
| A10 | No target match score, tie breaker or sweeps specified | One hand with result/rematch initially; report draws; no invented sweep points or match-to-N | Keep hand scoring distinct from future match scoring |
| A11 | Nobody captures before the deck is exhausted | Represent no-last-capturer explicitly; block normal result and use a defined fallback profile if supporting this scenario. Proposed fallback: table remains unawarded and result marked exceptional | Test the state rather than silently awarding cards to dealer |
| A12 | Whether the two-player drift prohibition also forces capture when other builds/augmentations remain possible | Only loose-card discard is prohibited while owning a build in phase one; legal building/augmentation still allowed if obligations survive | Separate action type from generic word 'drift', which the PDF uses inconsistently |
| A13 | Single-card base can rely on partner's publicly proven card; invalidation after rank played | Maintain public rank evidence from qualifying past build events; remove evidence when partner plays that rank | Never grant permission using hidden partner hand alone |

Questions needed before advanced-rule release: give legal/illegal move traces for the cross-pile revisit exception; establish pile stacking choice; settle own-versus-opponent augmentation in one turn; establish compulsory-claim timing and overlapping-capture choices; confirm the first seat and no-capture fallback. These do not block deck, deal, basic capture, scoring, offline shell, or networking architecture.

Profile names: `sa40-digital-v0` for disclosed provisional defaults; `sa40-pdf-v1` reserved for the confirmed complete rules. Config fields should identify specific policy choices rather than one misleading 'strict' Boolean.

## 4. Architecture

There are four responsibilities:

1. **Engine** knows cards, legal actions, turn sequencing and scoring. It has no React, network, DOM, storage, clock or platform imports.
2. **AI** chooses legal turns from a player-visible state and public history. It cannot read opponents' hands or the undealt deck.
3. **Web app** shows the game, accepts choices, explains errors, and caches offline assets/saves.
4. **Room server** owns online truth, seat authorization, hidden state, reconnections and persistence. Clients submit intent; clients never supply the accepted next state.

The same engine functions run in the local adapter and room server. Tests can replay the same commands in either adapter and compare results. This prevents offline and online drifting into different games.

### Core contracts

- `createGame(config, shuffledDeck, dealerSeat)` returns validated initial state. Provide shuffle input for reproducible fixtures. Production online shuffle uses cryptographic randomness and unbiased Fisher-Yates; never expose the seed/deck to clients during play.
- `applyAction(state, authenticatedSeat, action)` returns `{ state, events }` or a structured rule error. It is pure and does not mutate input.
- `legalActions(playerView)` supports UI hints and computer play. Server separately validates against authoritative state. A lightweight generator may start restricted to the first implemented rule subset; it must not silently omit supported legal moves.
- `getPlayerView(state, seat)` returns own hand, opponents' hand counts, table, public capture piles, public evidence, current turn and scores. Return neither other hands nor undealt card identities.
- `scoreHand(state)` produces a point breakdown for each side, using cards physically held after any pile augmentation and final cleanup.
- `assertInvariants(state)` supports development checks and tests.

### State model

`GameState`: schema version, rules profile/version, mode, seats, teams, dealer, active seat, deal phase, status, ordered deck, per-seat hands, per-side or per-seat captured piles as chosen by confirmed team-pile policy, table items, build evidence, last capturer, turn context, state version, end result.

Captured piles in partnerships need an explicit policy: proposed one pile per player, aggregate team totals for scoring, both teammates' piles ineligible as augmentation sources. Confirm whether the traditional game instead uses one shared pile before partnership release.

`Card`: stable ID, suit and rank 1..10. A card ID occurs in exactly one zone: deck, hand, loose table card, build group or captured pile.

`TableItem`: a loose card or `Build { id, ownerSeat, captureValue, groups: CardId[][] }`. One group is simple; two or more is compound. Values are recomputed/validated from groups. Ownership is independent of visual position.

`TurnContext`: seat, number of hand cards played (0 or 1), ordered accepted actions, pending mandatory capture obligations, pending response/claim phase. Statuses: lobby, playing, awaiting-partner, hand-ended, exceptional, abandoned.

### Turn transaction

A turn is an ordered sequence, not one 'play card' message. Supported intents eventually include `CREATE_BUILD`, `RAISE_BUILD`, `AUGMENT`, `CAPTURE`, `DISCARD`, `STASH`, `END_TURN`, and partnership responses.

For offline use, preview the sequence locally with undo before confirmation. For ordinary online turns, submit the whole sequence atomically against `expectedVersion`; validate actions in order on a temporary state, then validate end-of-turn obligations and commit once. Reject the entire sequence if any step fails. This prevents partial turns leaving illegal state.

A sequence may build using table-only cards, play one hand card to augment, then perform more table-only augmentation. Creating a table-only build then capturing it with one hand card can be legal. Raising using a hand card then capturing with another is always rejected.

An action requiring partner response creates a staged transaction: reserve the proposal, pause ordinary actions, gather accept/pass, then validate and commit the resolved outcome. Reconnection resumes that pending phase. A response timeout is a server-controlled rule, not browser authority.

### Online protocol

- `POST /rooms`: create private room with fixed profile/mode; issue unguessable host/seat credential.
- `POST /rooms/:code/join`: claim a free seat; return independent credential. Invitation code is discovery, not authorization.
- `GET /rooms/:code/socket`: upgrade authorized connection to room WebSocket.
- Client command: protocol version, unique command ID, expected state version, typed turn intent.
- Server result: accepted version plus personalized snapshot, or typed error with latest version. Never broadcast full internal state.
- Store accepted command IDs with bounded retention so reconnect retries cannot double-play a card.
- Durable Object serializes room transitions. Persist state, version and accepted-command result atomically before acknowledgement/broadcast; tolerate an acknowledgement lost after commit.
- On reconnect, authenticate original seat and send its latest view. Credentials cannot transfer ownership of another seat. Close old duplicate connections or define explicit read-only secondary sessions.
- Keep disconnected seat for a disclosed grace period. Initial private-room policy pauses the game; expiry offers abandonment/rematch, not an unannounced AI takeover.
- Limit room creation, joins, message size/rate and idle retention; reject malformed schemas and unauthorized actions. Do not log hand data or credentials into public telemetry.

## 5. Offline AI

Run the bot in a Web Worker so the interface stays responsive. Start with a transparent heuristic:

1. Resolve required own-build captures.
2. Prefer legal captures of point cards, then useful card/spade quantity in eleven-point modes.
3. Choose safe builds/raises with a retained capture card.
4. Prefer sensible discards, accounting for exposed opposing builds and public information.

Tie-break with injected randomness. Keep a deterministic seed in test fixtures. Score complete legal turn candidates, not only individual actions, because table-only actions can enable the hand play. Bound the search and always return a legal fallback within the implemented profile.

Later medium/hard bots can sample plausible unknown hands from unseen cards and evaluate candidates under a time budget. Never give the bot the real hidden hand. Bot explanations can show 'Captured 10-diamonds for 2 points' without paid text generation. Initial offline feature may offer only Easy while clearly labelling other difficulties unavailable.

## 6. R0 hosting plan

| Component | Choice | Why |
| --- | --- | --- |
| Web interface | React + TypeScript + Vite | Static build; shared language with engine |
| Offline install/cache | PWA service worker + manifest | Cached app works offline after first successful install/load |
| Local save | IndexedDB | Versioned active games and preferences on device |
| Static hosting | Cloudflare Pages free tier | Provided subdomain; no purchased domain |
| HTTP routing | Cloudflare Worker free tier | Small room create/join/auth routes |
| Realtime/state | One SQLite-backed Durable Object per room | Serialized turn authority and room persistence |
| Live transport | WebSocket Hibernation API | Turn-based updates without always-active polling |
| Tests | Vitest for engine, Playwright for browser flows | Rule fixtures and meaningful integration tests |
| Repository | Local git, then a free GitHub repository when authorized/available | Version history and reproducible builds |

Do not add D1 initially: the room Durable Object already has persistent storage. Do not add Redis, an LLM API, a paid database, a purchased domain or TURN relay.

Official documentation checked 8 October 2026 confirms SQLite-backed Durable Objects on Workers Free. Workers Free has 100,000 requests per day. Durable Objects have a separate free compute/storage budget, including 100,000 requests/day, 13,000 GB-s/day, 5 GB stored data, 50 million rows read/day and 100,000 rows written/day. These are provider metrics, not a promise of a particular number of players. Measure actual usage in a room smoke test. Hibernation avoids active duration during eligible idle periods; persist state because in-memory objects can be evicted.

Stay on Free; hitting a quota may temporarily stop online play. Show a friendly temporary-unavailability message and keep offline mode usable. Do not upgrade automatically. Avoid polling, unbounded histories, abandoned room storage, and logging every card animation. Delete expired guest rooms according to a disclosed retention policy. Test local Wrangler multiplayer before deployment; deployment requires the user's Cloudflare account to be available. Internet/mobile data and existing hardware are outside the hosting budget.

Sources:
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/pages/platform/limits/

## 7. Project structure

Use a small npm workspace repository. Create files when their responsibility is implemented; the tree is a destination, not a demand to generate every file on day one.

```text
khasino/
  README.md                     # setup and run instructions
  package.json                  # workspace commands
  tsconfig.base.json            # shared TypeScript compiler settings
  docs/
    rules.md                    # confirmed rules and page references
    decisions.md                # provisional profiles and ambiguity answers
    architecture.md             # state, actions, deployment contract
  packages/
    engine/
      src/
        cards.ts                # 40-card deck, ranks and shuffle helpers
        types.ts                # state/action definitions
        game.ts                 # setup, dealing, turn/hand transitions
        moves.ts                # capture/build/augment validation
        scoring.ts              # 7/11-point breakdown
        views.ts                # remove hidden information
        index.ts                # supported engine exports
      tests/                    # scenario fixtures and invariants
      package.json
    ai/
      src/bot.ts                # visible-state legal turn selection
      tests/
      package.json
  apps/
    web/
      src/
        App.tsx                 # screens and navigation
        components/             # card, table, hand and result UI
        game/local.ts           # offline engine adapter and saves
        game/online.ts          # commands and personalized snapshots
        workers/bot.worker.ts   # local computer opponent
      public/                   # manifest, icons, original assets
      package.json
    server/
      src/
        index.ts                # room HTTP routing
        room.ts                 # Durable Object, sockets and persistence
        protocol.ts             # command schemas and responses
      tests/
      wrangler.jsonc            # SQLite DO migration/binding
      package.json
```

For a beginner: `cards.ts` describes what a card is; `moves.ts` decides what is allowed; `App.tsx` presents the game; `room.ts` keeps everyone online on the same accepted state. Separate files have distinct jobs, while the two modes share the rule decisions.

## 8. First implementation steps and acceptance gates

### Step 1: freeze baseline decisions and create engine workspace

Record A01-A13, rules profile and page references. Initialize the root workspace, strict TypeScript, engine exports and a test runner. Begin with `types.ts`, `cards.ts`, `game.ts`, `scoring.ts`, and scenario tests. Install dependencies with a generated lockfile; do not invent package versions in the plan.

Acceptance: 40 unique cards; no faces; values 1..10; injected shuffle fixture; production RNG separated from test seeds. Dealing preserves every card and produces 10/10/20/0, 13/13/13/0/1, or 10/10/10/10/0 zone counts. Anticlockwise progression is tested against seat coordinates used by UI.

### Step 2: implement complete basic two-player hand lifecycle

Implement validated discard, loose-card capture using disjoint groups, active-seat checking, exactly one hand-card consumption, last-capture tracking, second deal, cleanup and scoring. This is a testable rule slice; it does not yet constitute complete Khasino.

Acceptance: replay a full 40-card hand; reject out-of-turn play, reused cards and overlapping selections; award remainder to last capturer; handle no-capturer explicitly. Eleven-point totals equal 11 in ordinary complete hands; seven-point totals equal 7. Ties in majorities split 1-1. 2-spades and 10-diamonds score independently of majority categories. Record categories in results.

### Step 3: implement build obligations and multi-action turns

Add table-only and hand-assisted simple builds, ownership, retained capture rank, raises, compound groups, stash, same-value uniqueness and first-deal drift restriction. Add atomic turn plans. Test that builds cannot be split, summed with other table items to capture, or raised once compound.

Acceptance scenarios include: 4+5+A builds 10 while retaining a 10; opponent 9 raised with Ace to 10 while retaining 10; no raise of own/partner build; no raise then capture with a second hand card; table-only build then capture with one hand card; stash consumes one card and leaves a valid capturer; last capturer reservation cannot be spent elsewhere; first-deal owned-build discard rejected; second-deal discard accepted only if reservation survives.

### Step 4: offline playable interface and Easy bot

Add a readable responsive table, large tap targets, selectable card groups, turn preview/confirm, typed error messages and score explanation. Support keyboard interaction and labels that do not rely on suit colour alone. Use local adapter + Web Worker bot. Add IndexedDB resume and version-safe PWA caching.

Acceptance: human versus bot can finish a basic-profile game; reload restores it; after caching, airplane-mode reload and a complete AI hand work; bot only receives own hand/public state; rejected moves do not corrupt saves. Inform the player which advanced rules are still unavailable. Do not enable a game with unimplemented moves while labelling it full PDF rules.

### Step 5: private online rooms

Implement server adapter, seat credentials, room code, lobby readiness, protocol/versioning, durable state and personalized sockets. Run two browsers against local Wrangler before hosting. Start with the same implemented profile as offline.

Acceptance: two independent players finish a game; stale and duplicate commands are safe; refresh/reconnect restores the same seat; server restart/hibernation restores state; opponent hands/undealt deck absent from snapshots; malformed and forged commands rejected; interrupted acknowledgement followed by retry cannot duplicate a capture.

### Step 6: remaining player modes and advanced PDF rules

Add 3-player and 4-player singles and confirm seven-point scoring. Resolve A05-A07 and team pile policy before captured-pile augmentation and partnership release. Implement sequential top-card availability, public partner evidence, Shiya transfer and required next-turn capture. Add optional compulsory claim windows only after their semantics are decided. Verify representative traditional players' move traces.

Acceptance: no buried pile cards used prematurely; one captured card cannot be used twice; own/team tops excluded; 5+4 can expose a 2 for a later separate group with table 7, but buried 2 cannot complete the initial 5+2+2 group; partner evidence invalidates on rank play; exceptional two-build rule forces capture; team aggregation totals 11.

### Step 7: R0 pilot

Deploy static site and free-plan room Worker when account access is ready. Run a small private pilot, inspect usage and connection reliability, and verify quota-error messaging. Confirm the exact selected profile in the lobby and saved game. Full release requires complete advanced-rule acceptance, not just an attractive table.

## 9. Testing strategy

Rule correctness deserves tests because a mistaken capture changes ownership, future options and final score. Use concrete PDF examples plus negative variants. Test invariant conservation after every accepted action: all forty IDs exactly once; valid build group sums; unique build values; legal retained capture cards; valid next seat; no hidden data in public views. Generate bounded random legal games to catch late-hand deadlocks without relying solely on example fixtures.

Network tests cover seat authorization, atomic turn commit, concurrent commands, deduplication, expired rooms, reconnect and hibernation. Browser tests cover a complete offline hand and one two-client online hand. Do not spend the first sprint on cosmetic snapshot tests.

## 10. Done means

Both required modes are usable. All four player configurations are supported. Rule deviations are disclosed and advanced-rule ambiguities resolved or explicitly scoped with user agreement. AI does not cheat using hidden state. Online server controls accepted moves. Saved games and reconnect work. Responsive UI explains legal actions. R0 deployment uses free-tier resources with no automatic paid upgrade. Voice remains deferred.
