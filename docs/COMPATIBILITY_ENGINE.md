# Compatibility engine

Status: **designed, not implemented** (Milestone 4). Constants, the weight schema and the
database tables exist; the scoring package does not.

The engine is deterministic code. An LLM is never asked whether two people are compatible.
Outputs are **estimated alignment**, not predictions of relationship success, and the UI must
say so. The weights are product hypotheses, not validated science.

## Dimensions and initial weights (`2026-11-v1`)

| Dimension              | Weight |
| ---------------------- | ------ |
| Emotional              | 0.25   |
| Communication          | 0.20   |
| Relationship alignment | 0.20   |
| Lifestyle              | 0.15   |
| Intellectual           | 0.10   |
| Mutual preferences     | 0.10   |

Weights live in `compatibility_weight_sets` (versioned, exactly one active) and are validated
by `compatibilityWeightsSchema` (each in `[0,1]`, sum = 1).

## Scoring

For each dimension _i_, a similarity `s_i ∈ [0,1]` is computed from specific persona attributes
with an explicit function per attribute (closeness for scales, overlap for sets, a lookup
table where complementary values fit better than identical ones).

Each attribute comparison carries a confidence `c = min(conf_A, conf_B)` and is skipped when
either side is unknown. Per dimension:

```
s_i        = Σ_k (c_k · sim_k) / Σ_k c_k          over comparable attributes k
coverage_i = comparable attributes / attributes defined for the dimension
conf_i     = mean(c_k) · coverage_i
```

Overall, re-normalised over dimensions that have any data:

```
C(A,B)     = Σ_i (w_i · s_i) / Σ_i w_i            over dimensions with coverage_i > 0
confidence = Σ_i (w_i · conf_i)                    over all dimensions
```

### Missing data never inflates a score

- Unknown attributes contribute nothing — they are not treated as agreement.
- Sufficiency is derived from weighted coverage: below a threshold the result is
  `INSUFFICIENT` and **no overall number is produced** (the database enforces this); a middle
  band is `PARTIAL` and is shown with its uncertainty.
- Two sparse profiles therefore yield "not enough to say", never a high match.

### Gates applied before scoring

Eligibility (active, discoverable, adult, not blocked either way), age and distance
preferences in **both** directions, compatible relationship intentions, and hard
deal-breakers. A failed gate yields `blockedReason` and no score.

## Scenarios

Ten scenario alignments — first date, weekend together, long distance, communication during
conflict, social lifestyle, financial attitudes, future planning, spontaneous travel, personal
boundaries, daily routines. Each is a fixed, documented list of attributes and weights run
through the same confidence-aware formula, and each returns the features that drove it.
Nothing is simulated.

## Ranking pipeline

1. Eligibility filtering
2. Geographic and preference filtering
3. Mutual relationship-intention filtering
4. Embedding similarity (pgvector HNSW) — candidate generation only, never the score
5. Structured attribute compatibility
6. Scenario compatibility
7. Reciprocal preference evaluation
8. Ranking with diversity
9. Recommendation explanation

## Learning

`discovery_events` records outcomes (requests, mutual connections, sustained conversations,
voluntary feedback). Future weight sets are evaluated against these, never against time in
app or volume of activity. No accuracy claims without outcome data.

## Testing

Pure functions in `@vyra/compatibility-engine`, tested with synthetic profiles: identical,
opposite, sparse-vs-sparse, sparse-vs-rich, deal-breaker, asymmetric preferences, symmetry
(`C(A,B) = C(B,A)`), and determinism.
