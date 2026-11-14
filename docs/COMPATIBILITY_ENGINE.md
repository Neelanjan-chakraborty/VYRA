# Compatibility engine

Status: **implemented** (Milestone 4) in `packages/compatibility-engine`, engine version
`compat-1`. Pure TypeScript: no I/O, no framework, no AI. The API loads data, the engine
decides.

An LLM is never asked whether two people are compatible. Outputs are **estimated
alignment**, not predictions of relationship success, and the UI must say so. The weights are
product hypotheses, not validated science. Only **approved** persona versions are read;
drafts never influence matching.

## 1. Eligibility gates (`eligibility.ts`)

Checked in **both** directions; failing any one means the pair is never scored or shown.

| Gate          | Rule                                                                                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self          | never                                                                                                                                                                                                                              |
| Age           | each person's age is inside the other's `minAge…maxAge`                                                                                                                                                                            |
| Gender        | each person's "interested in" is empty, or contains the other's gender category. Free-text gender maps to `woman` / `man` / `nonbinary` (`genderCategory`); anything unrecognised matches **no** filter — the engine never guesses |
| Distance      | only when both have a location and a limit is set                                                                                                                                                                                  |
| Intention     | best fit between the two people's intentions ≥ 0.5. Serious ↔ casual is 0 (a deal-breaker); "exploring" or a second intention can bridge it                                                                                        |
| Deal-breakers | the person's own rules (`{attribute, exclude[]}` on `lifestylePace`, `weekendRhythm`, `communicationStyle`); fire only on a value known with confidence ≥ 0.6                                                                      |
| Blocked       | either has blocked the other (checked by the API)                                                                                                                                                                                  |

## 2. Features (`features.ts`)

Each feature compares one thing about two people and yields a similarity in [0, 1] and a
confidence `c = min(conf_A, conf_B)`. **If either side is unknown the feature is absent** — it
is not treated as agreement.

| Feature                               | Similarity                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| scale attributes                      | `1 −                                                                                                              | a − b | `   |
| `communicationStyle`, `weekendRhythm` | identical = 1, otherwise a fixed symmetric table (e.g. concise/expansive 0.4, expansive/reflective 0.8)           |
| `lifestylePace`                       | ordinal: one step apart 0.5, two steps 0                                                                          |
| `values`                              | overlap ÷ the shorter list                                                                                        |
| `intents`                             | best pair from a fixed table (stated, confidence 0.95)                                                            |
| `sharedInterests`                     | shared ÷ 3, capped at 1; only if both chose ≥ 3 interests (stated, 0.95)                                          |
| `preferenceFit`                       | how centrally each sits in the other's age (and distance) range: 1 at the middle, 0.6 at the edges (stated, 0.95) |

## 3. Dimensions, weights and the overall estimate (`score.ts`)

| Dimension (weight)            | Features (relative weight)                               |
| ----------------------------- | -------------------------------------------------------- |
| Emotional (0.25)              | emotional expression 1, affection 1, conflict approach 1 |
| Communication (0.20)          | communication style 2, conflict approach 1               |
| Relationship alignment (0.20) | intentions 2, values 1                                   |
| Lifestyle (0.15)              | social energy 1, pace 1, weekend 1, planning 1           |
| Intellectual (0.10)           | curiosity 1, adventure 1, shared interests 1             |
| Mutual preferences (0.10)     | preference fit 1                                         |

Weights live in `compatibility_weight_sets` (versioned, one active, validated to sum to 1);
the version is recorded on every result.

Per dimension, over the features known for both people:

```
sᵢ        = Σ fw·c·sim / Σ fw·c
coverageᵢ = Σ fw(known) / Σ fw(all)
confᵢ     = (Σ fw·c / Σ fw(known)) · coverageᵢ
```

Overall:

```
raw          = Σ wᵢ·sᵢ / Σ wᵢ                over dimensions with any data
dataCoverage = Σ wᵢ·coverageᵢ
confidence   = Σ wᵢ·confᵢ
overall      = 0.5 + (raw − 0.5) · dataCoverage
```

**Missing data never inflates a score.** The last line pulls an estimate towards neutral in
proportion to what is unknown, so two sparse people who agree on three things score lower
than two fully described people who agree on everything. Sufficiency comes from
`dataCoverage`: below 0.4 **INSUFFICIENT** (no number at all — the database forbids one), below
0.7 **PARTIAL**, else **SUFFICIENT**. Two people without personas are always insufficient.

Sample outputs (synthetic, default weights): identical full profiles 0.97 · opposite full
profiles 0.38 · two sparse profiles that agree 0.80 (partial) · no personas: none.

## 4. Scenarios

Ten fixed feature mixes, run through the same confidence-weighted mean. A scenario needs at
least half its weight known, else its alignment is `null`. Nothing is simulated.

| Scenario                                       | Features                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| A first date                                   | communication style .4, social energy .3, shared interests .3        |
| A weekend together                             | weekend .4, pace .3, social energy .3                                |
| Time apart                                     | communication .3, emotional expression .3, affection .2, planning .2 |
| Working through a disagreement                 | conflict approach .6, emotional expression .4                        |
| Social life                                    | social energy .5, pace .5                                            |
| Priorities and planning (`financialAttitudes`) | planning .5, values .5 — **no financial data exists or is used**     |
| Planning a future                              | intentions .5, planning .3, values .2                                |
| A last-minute trip                             | adventure .5, planning .3, shared interests .2                       |
| Respecting each other's space                  | conflict approach .5, emotional expression .5                        |
| Everyday routines                              | planning .4, pace .3, social energy .3                               |

## 5. Explanations

Every feature that fits well (≥ 0.75) or poorly (≤ 0.5) produces a sentence from the catalogue
labels, e.g. "You both lean towards “talks it through right away”" or "Pace of life: “mostly
out and about” and “mostly at home”". `highlights()` picks up to three, one per dimension
before any repeats.

## 6. Ranking pipeline (API, `CompatibilityService.recommendations`)

1. **SQL pool**: active, discoverable, not self, not blocked either way, age within the
   viewer's range, the viewer within the candidate's age range.
2. **Embedding similarity** (pgvector HNSW, cosine) orders that pool and keeps the nearest
   200; people without an embedding follow by recent activity. The embedding only decides
   who is scored, never the score.
3. **All gates** re-checked by the engine.
4. **Score** each candidate.
5. **Rank** by `overall × (0.5 + 0.5 × confidence)` — a confident 0.7 beats an unsure 0.8 —
   with insufficient results last.
6. **Diversity**: −0.05 for having the same strongest dimension as the previous pick.
7. **Explain** with highlights and shared interests.

Reciprocal _interest_ (has the other person shown interest?) arrives with connection
requests in Milestone 5.

## 7. Caching and invalidation

Results for pairs where both have an approved persona are stored in `compatibility_scores`
(+ `compatibility_scenarios`) with `user_a_id < user_b_id`, keyed by both persona version ids,
the weights version and the engine version. A new approval, weight set or engine version
changes the key, so stale rows are never read again. Scores are currently recomputed on every
request (they take microseconds); the table serves analytics and the learning system.

## 8. Learning

`discovery_events` records `IMPRESSION` (with rank and versions) and `COMPATIBILITY_VIEWED`.
Requests, mutual connections and conversations are added in Milestones 5–6. Future weight
sets will be judged against those outcomes — never time in app or volume of activity — and
no accuracy is claimed without outcome data.

## 9. Tests

`packages/compatibility-engine/src/engine.spec.ts` (synthetic people): every gate in both
directions; identical vs opposite; no persona → no number; sparse agreement scores below full
agreement; rich-vs-sparse is insufficient; low confidence counts for less; symmetry and
determinism; weight changes; scenario feature isolation and nulls; explanations; 500 random
pairs stay in range; ranking order and tie-breaking. `apps/api/test/compatibility.e2e-spec.ts`
runs the same ideas through the real API and database.
