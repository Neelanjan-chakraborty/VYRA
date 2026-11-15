//! Dimensions, the overall estimate, scenarios and highlights. A port of `score.ts`.

use crate::features::{Comparison, compare_all, round3, shared_interest_labels};
use crate::types::{
    CompatibilityResult, DIMENSIONS, Dimension, DimensionResult, Dimensions, FeatureResult, Person,
    ScenarioResult, Weights,
};
use std::cmp::Ordering;

pub const ENGINE_VERSION: &str = "compat-2";
pub const INSUFFICIENT_BELOW: f64 = 0.4;
pub const PARTIAL_BELOW: f64 = 0.7;
pub const SCENARIO_MIN_COVERAGE: f64 = 0.5;

type FeatureWeights = &'static [(&'static str, f64)];

/// Features of each dimension and their weight inside it, in insertion order.
pub fn dimension_features(dimension: Dimension) -> FeatureWeights {
    match dimension {
        Dimension::Emotional => &[
            ("emotionalExpressiveness", 1.0),
            ("affectionExpression", 1.0),
            ("conflictApproach", 1.0),
        ],
        Dimension::Communication => &[("communicationStyle", 2.0), ("conflictApproach", 1.0)],
        Dimension::Lifestyle => &[
            ("socialEnergy", 1.0),
            ("lifestylePace", 1.0),
            ("weekendRhythm", 1.0),
            ("planningStyle", 1.0),
        ],
        Dimension::RelationshipAlignment => &[("intents", 2.0), ("values", 1.0)],
        Dimension::Intellectual => &[
            ("intellectualCuriosity", 1.0),
            ("adventureOrientation", 1.0),
            ("sharedInterests", 1.0),
        ],
        Dimension::MutualPreferences => &[("preferenceFit", 1.0), ("statedPreferences", 2.0)],
    }
}

/// Scenarios and their explicit features, in `COMPATIBILITY_SCENARIOS` order.
pub const SCENARIOS: [(&str, FeatureWeights); 10] = [
    (
        "firstDate",
        &[
            ("communicationStyle", 0.4),
            ("socialEnergy", 0.3),
            ("sharedInterests", 0.3),
        ],
    ),
    (
        "weekendTogether",
        &[
            ("weekendRhythm", 0.4),
            ("lifestylePace", 0.3),
            ("socialEnergy", 0.3),
        ],
    ),
    (
        "longDistance",
        &[
            ("communicationStyle", 0.3),
            ("emotionalExpressiveness", 0.3),
            ("affectionExpression", 0.2),
            ("planningStyle", 0.2),
        ],
    ),
    (
        "conflictCommunication",
        &[("conflictApproach", 0.6), ("emotionalExpressiveness", 0.4)],
    ),
    (
        "socialLifestyle",
        &[("socialEnergy", 0.5), ("lifestylePace", 0.5)],
    ),
    (
        "financialAttitudes",
        &[("planningStyle", 0.5), ("values", 0.5)],
    ),
    (
        "futurePlanning",
        &[("intents", 0.5), ("planningStyle", 0.3), ("values", 0.2)],
    ),
    (
        "spontaneousTravel",
        &[
            ("adventureOrientation", 0.5),
            ("planningStyle", 0.3),
            ("sharedInterests", 0.2),
        ],
    ),
    (
        "personalBoundaries",
        &[("conflictApproach", 0.5), ("emotionalExpressiveness", 0.5)],
    ),
    (
        "dailyRoutines",
        &[
            ("planningStyle", 0.4),
            ("lifestylePace", 0.3),
            ("socialEnergy", 0.3),
        ],
    ),
];

struct Aggregate<'a> {
    score: Option<f64>,
    confidence: f64,
    coverage: f64,
    used: Vec<(&'static str, &'a Comparison)>,
}

fn find<'a>(comparisons: &'a [(&'static str, Comparison)], key: &str) -> Option<&'a Comparison> {
    comparisons.iter().find(|(k, _)| *k == key).map(|(_, c)| c)
}

/// Confidence-weighted mean over the features known for both people.
fn aggregate<'a>(
    features: FeatureWeights,
    comparisons: &'a [(&'static str, Comparison)],
) -> Aggregate<'a> {
    let total = features.iter().fold(0.0, |s, (_, w)| s + w);
    let used: Vec<(&'static str, f64, &Comparison)> = features
        .iter()
        .filter_map(|(key, w)| find(comparisons, key).map(|c| (*key, *w, c)))
        .collect();
    let known_weight = used.iter().fold(0.0, |s, (_, w, _)| s + w);
    let coverage = if total == 0.0 {
        0.0
    } else {
        known_weight / total
    };
    let weighted_confidence = used.iter().fold(0.0, |s, (_, w, c)| s + w * c.confidence);
    let mean = if weighted_confidence == 0.0 {
        None
    } else {
        Some(
            used.iter()
                .fold(0.0, |s, (_, w, c)| s + w * c.confidence * c.similarity)
                / weighted_confidence,
        )
    };
    let mean_confidence = if known_weight == 0.0 {
        0.0
    } else {
        weighted_confidence / known_weight
    };
    Aggregate {
        score: mean.map(round3),
        confidence: round3(mean_confidence * coverage),
        coverage: round3(coverage),
        used: used.into_iter().map(|(k, _, c)| (k, c)).collect(),
    }
}

fn feature_results(used: &[(&'static str, &Comparison)]) -> Vec<FeatureResult> {
    used.iter()
        .map(|(feature, c)| FeatureResult {
            feature: (*feature).to_string(),
            similarity: c.similarity,
            confidence: c.confidence,
        })
        .collect()
}

fn sufficiency_for(data_coverage: f64) -> &'static str {
    if data_coverage < INSUFFICIENT_BELOW {
        "INSUFFICIENT"
    } else if data_coverage < PARTIAL_BELOW {
        "PARTIAL"
    } else {
        "SUFFICIENT"
    }
}

/// Estimated alignment between two people who passed `ineligibility`. Deterministic.
pub fn score(
    a: &Person,
    b: &Person,
    weights: &Weights,
    weights_version: &str,
) -> CompatibilityResult {
    let comparisons = compare_all(a, b);

    let mut weighted = 0.0;
    let mut weight_with_data = 0.0;
    let mut confidence = 0.0;
    let mut data_coverage = 0.0;
    let mut results: Vec<DimensionResult> = Vec::with_capacity(6);
    for dimension in DIMENSIONS {
        let agg = aggregate(dimension_features(dimension), &comparisons);
        let w = weights.get(dimension);
        if let Some(s) = agg.score {
            weighted += w * s;
            weight_with_data += w;
        }
        confidence += w * agg.confidence;
        data_coverage += w * agg.coverage;
        results.push(DimensionResult {
            score: agg.score,
            confidence: agg.confidence,
            coverage: agg.coverage,
            features: feature_results(&agg.used),
            aligned: agg
                .used
                .iter()
                .filter_map(|(_, c)| c.aligned.clone())
                .collect(),
            different: agg
                .used
                .iter()
                .filter_map(|(_, c)| c.different.clone())
                .collect(),
        });
    }

    let sufficiency = sufficiency_for(data_coverage);
    let raw = (weight_with_data != 0.0).then(|| weighted / weight_with_data);
    let overall = match raw {
        Some(raw) if sufficiency != "INSUFFICIENT" => {
            Some(round3(0.5 + (raw - 0.5) * data_coverage.min(1.0)))
        }
        _ => None,
    };

    let scenarios = SCENARIOS
        .iter()
        .map(|(key, features)| {
            let agg = aggregate(features, &comparisons);
            ScenarioResult {
                key: (*key).to_string(),
                alignment: if agg.coverage >= SCENARIO_MIN_COVERAGE {
                    agg.score
                } else {
                    None
                },
                confidence: agg.confidence,
                features: feature_results(&agg.used),
            }
        })
        .collect();

    let mut it = results.into_iter();
    let mut next = || it.next().expect("six dimensions");
    let dimensions = Dimensions {
        emotional: next(),
        communication: next(),
        lifestyle: next(),
        relationship_alignment: next(),
        intellectual: next(),
        mutual_preferences: next(),
    };

    CompatibilityResult {
        engine_version: ENGINE_VERSION.to_string(),
        weights_version: weights_version.to_string(),
        overall,
        confidence: round3(confidence),
        sufficiency: sufficiency.to_string(),
        dimensions,
        scenarios,
        shared_interests: shared_interest_labels(a, b),
    }
}

/// The strongest two or three reasons, one per dimension first.
pub fn highlights(result: &CompatibilityResult, weights: &Weights, max: usize) -> Vec<String> {
    let mut ranked: Vec<Dimension> = DIMENSIONS
        .into_iter()
        .filter(|d| result.dimensions.get(*d).score.is_some())
        .collect();
    // A stable sort with the TypeScript comparator `wy·sy − wx·sx`.
    ranked.sort_by(|x, y| {
        let vx = weights.get(*x) * result.dimensions.get(*x).score.unwrap_or(0.0);
        let vy = weights.get(*y) * result.dimensions.get(*y).score.unwrap_or(0.0);
        let d = vy - vx;
        if d < 0.0 {
            Ordering::Less
        } else if d > 0.0 {
            Ordering::Greater
        } else {
            Ordering::Equal
        }
    });
    let mut reasons: Vec<String> = Vec::new();
    let mut pass = 0;
    while reasons.len() < max {
        let mut added = false;
        for d in &ranked {
            if let Some(line) = result.dimensions.get(*d).aligned.get(pass)
                && reasons.len() < max
                && !reasons.contains(line)
            {
                reasons.push(line.clone());
                added = true;
            }
        }
        if !added {
            break;
        }
        pass += 1;
    }
    reasons
}
