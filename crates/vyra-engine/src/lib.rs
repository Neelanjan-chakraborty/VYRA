//! VYRA's compatibility engine in Rust: hard gates, feature comparisons,
//! dimension scores, scenarios, explanations and ranking — bit-for-bit the same
//! results as the TypeScript reference in `packages/compatibility-engine`,
//! proven by the parity fixtures in `tests/`. Pure: no I/O, no clocks, no randomness.

mod catalogue;
pub mod eligibility;
pub mod features;
pub mod geo;
pub mod rank;
pub mod score;
pub mod types;

pub use eligibility::{accepts_gender, ineligibility};
pub use features::{compare_all, fails_must_haves, intent_fit, shared_interest_labels};
pub use geo::distance_km;
pub use rank::{rank_score, rank_with_diversity};
pub use score::{ENGINE_VERSION, highlights, score};
pub use types::*;

/// One candidate's outcome when scoring many at once.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Scored {
    /// Why the pair can't be shown, or None when eligible.
    pub ineligible: Option<&'static str>,
    /// Present only for eligible candidates.
    pub result: Option<CompatibilityResult>,
    pub highlights: Vec<String>,
}

/// Gates and scores every candidate against one viewer. The hot path of
/// recommendations: one call instead of one per candidate.
pub fn score_many(
    viewer: &Person,
    candidates: &[Person],
    weights: &Weights,
    weights_version: &str,
) -> Vec<Scored> {
    candidates
        .iter()
        .map(|candidate| match ineligibility(viewer, candidate) {
            Some(reason) => Scored {
                ineligible: Some(reason),
                result: None,
                highlights: Vec::new(),
            },
            None => {
                let result = score(viewer, candidate, weights, weights_version);
                let highlights = highlights(&result, weights, 3);
                Scored {
                    ineligible: None,
                    result: Some(result),
                    highlights,
                }
            }
        })
        .collect()
}

/// One recommended candidate, in ranked order.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recommended {
    /// Index into the candidates passed in.
    pub index: usize,
    pub result: CompatibilityResult,
    pub highlights: Vec<String>,
}

/// The whole recommendation step in one call: gate both ways, score, rank with
/// diversity and explain, returning only the top `limit` — so callers across a
/// language boundary never ship results they will throw away.
pub fn recommend(
    viewer: &Person,
    candidates: &[Person],
    weights: &Weights,
    weights_version: &str,
    limit: usize,
) -> Vec<Recommended> {
    let mut eligible: Vec<(usize, CompatibilityResult)> = Vec::new();
    for (index, candidate) in candidates.iter().enumerate() {
        if ineligibility(viewer, candidate).is_none() {
            eligible.push((index, score(viewer, candidate, weights, weights_version)));
        }
    }
    let keyed: Vec<(String, CompatibilityResult)> = eligible
        .iter()
        .map(|(index, result)| (candidates[*index].id.clone(), result.clone()))
        .collect();
    rank_with_diversity(&keyed, weights)
        .into_iter()
        .take(limit)
        .map(|position| {
            let (index, result) = eligible[position].clone();
            let highlights = highlights(&result, weights, 3);
            Recommended {
                index,
                result,
                highlights,
            }
        })
        .collect()
}

/// Gate reasons for many candidates at once (None = eligible).
pub fn ineligibility_many(viewer: &Person, candidates: &[Person]) -> Vec<Option<&'static str>> {
    candidates
        .iter()
        .map(|candidate| ineligibility(viewer, candidate))
        .collect()
}
