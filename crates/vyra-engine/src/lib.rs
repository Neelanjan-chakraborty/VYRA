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
