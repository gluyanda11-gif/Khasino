# Clarified by Luyanda, 8 October 2026

These decisions supersede the provisional optional-augmentation and opponent-only-raise choices in the original architecture plan.

- A matching hand card can be drifted onto a loose table card or group of that rank, forming a compound build of that rank, not their combined physical sum. Retain another matching hand card.
- A loose 4 plus hand 4 can alternatively form a simple 8 if an 8 remains in hand. Chow of the 4 remains available.
- A matching hand card can be drifted onto an existing owned/team build (previously labelled Stash).
- A player can raise their own or an opponent’s simple build by adding one hand card, but cannot raise their partner’s build. The player must retain the new capture rank. Compounds cannot be raised: every constituent group equals their fixed value.
- Builds compulsorily absorb available loose matching cards, disjoint table sum groups, and eligible opponent exposed tops (including tops combined with table cards). Complete one group before using a newly exposed top. No own/team captured cards. Cards cannot be reused. If overlapping groups compete, the deterministic descending-rank grouping exhausts legal available groups; it does not promise every mutually incompatible grouping simultaneously.
- Saved hands retain their dealt cards and adopt these clarified rules. Room state is authoritative and applies the same logic.
- Still unresolved/unimplemented: the PDF's special cross-pile revisit ordering, Shiya interception, and optional opponent claim arbitration for partial captures. The app discloses these limits.

Regression scenarios cover matching tens, the three choices with fours, own simple 8 to 9/10, locked compound 8, compulsory equal/sum groups, exposed top chains, buried-top exclusion and disjoint overlapping groups. Full-hand simulations and server concurrency/privacy tests remain in the suite.

## Exposed-top creation and stack display (22:24 clarification)

New builds may use an opponent's exposed top together with the one played hand card, even with no loose table card. The new rank must still be retained in hand. Own/team piles remain excluded; duplicate pile references cannot reach buried cards. Matching tops may also form a compound Drift when another matching capture card is retained.

Build groups are stored oldest to newest; each group is sorted largest to smallest. The displayed top is the smallest card of the newest group, rather than the smallest card of the first or entire historical stack. The card tooltip lists the latest group. Selecting the opponent's top and the hand card enables Build/Drift according to these same shared-engine rules.

## Base requirement (22:37 clarification; supersedes pile-only creation above)

An opponent's capture top cannot create a target value from scratch. Before taking it, that value must have an established base on the table: an eligible existing build or a matching loose card. Forming a base first from loose table cards plus the played hand card is allowed; compulsory augmentation then uses eligible exposed tops. When a matching loose card serves as base, it is placed first, below the newly added group. The restriction applies to humans, computer players and server-validated online moves alike. Rejected moves leave captured piles, hand cards and table unchanged.

## Build controls (22:47)

The main Build button displays its intended result, such as Build 8 for selected loose 4 + hand 4. It also routes a selected simple 4-build + hand 4 through the legal raise action under the same Build 8 label. A same-value group added to an existing build uses the same Build control; Drift remains a separate matching-card move. Rule failures are shown inline and on click rather than silently hiding or disabling Build. Compound locks, retained capture rank and the normal one-owned-build limit are still enforced.

## Partnership raising (23:25)

A partner cannot change the value of your build. Matching augmentation remains legal; a partner cannot chow the build. This restriction is enforced in the shared engine used by offline AI, UI previews and the online server. Raising your own simple build remains allowed under the earlier clarification.

## Loose base chow and drift (23:36)

A loose table 8 plus an exposed opponent 8 can be augmented and chowed with one hand 8, without keeping another 8. Alternatively, drift that hand 8 onto the compound base while retaining another 8. The selected table 8 is a separate base group, not summed with the opponent 8 into 16. Capture tops still require a table base.

### Building for a partner
A player can explicitly assign a new build to their opposite-seat partner without holding the capture rank themselves. Public evidence is not required for this human choice; the partner must actually retain the matching capture card, checked by the authoritative engine. Hidden-hand UI previews offer the choice without revealing whether the partner has that card. Bots continue to use public evidence when choosing partner builds. A partner’s existing build still cannot be raised.

Team build ownership is inferred: matching existing builds keep their owner, new builds are for the actor when they retain the rank and otherwise for their partner. Ask only when the actor retains the rank and public evidence shows the partner’s chowed build rank remains unplayed. No duplicate same-value builds are created.

A partner cannot chow a build owned by their teammate. The whole capture move is rejected if its rank matches the partner’s build, including when other matching loose cards or opponent tops are present. The owner and opponents can still chow it.

### Leave it interception
When a team player attempts to chow their own existing build, a fixed six-second request opens for their partner regardless of the partner’s cards. The partner privately answers Yes or No. No answer defaults to chow. Yes requires the partner to retain the capture rank and have no other owned build; it transfers ownership publicly and leaves the acting player’s matching hand card as a new group instead of capturing, completing their turn. The request never resolves early. Online answers and proposed actions are stripped from other seats’ views; deadline resolution uses conditional room writes and reconnect polling. Offline bots request a transfer when they can legally retain the capture rank.
