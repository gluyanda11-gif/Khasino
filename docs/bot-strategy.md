# Offline Khasino strategy

The bot enumerates legal plays, including loose-group Drift, compound augmentation, opponent-top capture from an established base and builds for a partner whose rank is publicly proven. Shared rules validate every candidate.

The evaluator values captured point cards, majority-card and spade prospects, future captures, build control and exposure to opponents. It estimates the strongest likely opponent capture and then the best available recapture of the remaining floor. This is bounded probabilistic response analysis, not an exhaustive minimax engine.

All decisions sanitize input to `playerView`, even if a caller passes full server state. Other hands and deck identities are excluded. Unseen rank counts come from the 40-card deck minus public table/pile cards and the bot’s own hand. Opponents’ hand sizes inform approximate hypergeometric probabilities. Public retained-rank proof allocates at least one matching card to the indicated player; when every card of a rank is accounted for, its probability in other hands becomes zero. Builds and preserved public evidence establish partner capture ranks; spending that rank invalidates the proof. A partner’s self-capture does not falsely announce another copy. Inferred strategy clues never authorize building for a partner without the required rule evidence.

Weights are optimized through evolutionary self-play. Candidate policies compete with the incumbent on solo and partnership deals. A challenger must improve point margins in each mode and win more than half of training games. Final validation uses fresh paired deals against the old policy and the untuned strategic policy. Failed policies are recorded but not promoted. This is a small trainable evaluation function, not a neural network.

Limitations: hidden-card probabilities are approximations; response search mostly models captures, not all possible multi-turn plans. It does not understand verbal hints. Shiya interception remains unimplemented, so the bot cannot use that move yet. Development training is reproducible and runs locally; live play uses a fixed validated policy rather than learning unpredictably during human games.
