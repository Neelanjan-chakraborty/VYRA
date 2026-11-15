//! Learning dimension weights from what people actually do — with guardrails,
//! so the engine improves slowly, transparently and never on protected traits.
//!
//! Input: one sample per (viewer, candidate) decision, holding only the six
//! dimension scores the engine showed (None when unknown) and whether the
//! viewer acted positively (asked to connect, saved, accepted) or not (passed,
//! declined). Nothing else — no age, gender, location or identity — can enter.
//!
//! Method: deterministic L2-regularised logistic regression on centred scores,
//! turned into candidate weights, then bounded: each weight in
//! [MIN_WEIGHT, MAX_WEIGHT], at most ±MAX_STEP from the current weights, summing
//! to 1. The proposal is kept only if it ranks held-out decisions better
//! (AUC) than the current weights. A person must still approve it.

use crate::types::{DIMENSIONS, Weights};
use serde::{Deserialize, Serialize};

pub const MIN_WEIGHT: f64 = 0.05;
pub const MAX_WEIGHT: f64 = 0.40;
/// Largest change to any one weight in a single proposal.
pub const MAX_STEP: f64 = 0.05;

#[derive(Debug, Clone, Deserialize)]
pub struct Sample {
    /// Dimension scores in `DIMENSIONS` order; None when unknown for the pair.
    pub scores: [Option<f64>; 6],
    /// The viewer acted positively.
    pub positive: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FitOptions {
    pub min_samples: usize,
    pub min_per_class: usize,
    pub l2: f64,
    pub iterations: usize,
    pub learning_rate: f64,
}

impl Default for FitOptions {
    fn default() -> Self {
        Self {
            min_samples: 500,
            min_per_class: 50,
            l2: 0.01,
            iterations: 2_000,
            learning_rate: 0.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FitMetrics {
    pub samples: usize,
    pub positives: usize,
    pub negatives: usize,
    pub train_size: usize,
    pub validation_size: usize,
    /// Logistic coefficient per dimension, in `DIMENSIONS` order.
    pub coefficients: [f64; 6],
    pub auc_current: f64,
    pub auc_proposed: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FitOutcome {
    /// "proposed", "insufficient_data" or "no_improvement".
    pub status: &'static str,
    pub weights: Option<Weights>,
    pub metrics: Option<FitMetrics>,
}

fn sigmoid(z: f64) -> f64 {
    1.0 / (1.0 + (-z).exp())
}

/// Centred features: unknown dimensions contribute nothing.
fn features(sample: &Sample) -> [f64; 6] {
    sample.scores.map(|s| s.map_or(0.0, |s| s - 0.5))
}

/// Deterministic batch gradient descent. Returns (intercept, coefficients).
fn logistic(train: &[&Sample], options: &FitOptions) -> (f64, [f64; 6]) {
    let n = train.len() as f64;
    let mut bias = 0.0;
    let mut beta = [0.0; 6];
    for _ in 0..options.iterations {
        let mut grad_bias = 0.0;
        let mut grad = [0.0; 6];
        for sample in train {
            let x = features(sample);
            let z = bias + x.iter().zip(&beta).map(|(x, b)| x * b).sum::<f64>();
            let error = sigmoid(z) - if sample.positive { 1.0 } else { 0.0 };
            grad_bias += error;
            for (g, xi) in grad.iter_mut().zip(x) {
                *g += error * xi;
            }
        }
        bias -= options.learning_rate * grad_bias / n;
        for (b, g) in beta.iter_mut().zip(grad) {
            *b -= options.learning_rate * (g / n + options.l2 * *b);
        }
    }
    (bias, beta)
}

/// The engine's own ranking signal for a sample under some weights: the
/// weighted mean of the known dimension scores.
fn engine_score(sample: &Sample, weights: &[f64; 6]) -> f64 {
    let (mut sum, mut total) = (0.0, 0.0);
    for (s, w) in sample.scores.iter().zip(weights) {
        if let Some(s) = s {
            sum += w * s;
            total += w;
        }
    }
    if total == 0.0 { 0.5 } else { sum / total }
}

/// Area under the ROC curve: the chance a random positive outranks a random negative.
pub fn auc(samples: &[&Sample], weights: &[f64; 6]) -> f64 {
    let mut scored: Vec<(f64, bool)> = samples
        .iter()
        .map(|s| (engine_score(s, weights), s.positive))
        .collect();
    scored.sort_by(|a, b| a.0.total_cmp(&b.0));
    let positives = scored.iter().filter(|(_, p)| *p).count() as f64;
    let negatives = scored.len() as f64 - positives;
    if positives == 0.0 || negatives == 0.0 {
        return 0.5;
    }
    // Rank-sum with average ranks for ties.
    let mut rank_sum = 0.0;
    let mut i = 0;
    while i < scored.len() {
        let mut j = i;
        while j + 1 < scored.len() && scored[j + 1].0 == scored[i].0 {
            j += 1;
        }
        let average_rank = (i + j) as f64 / 2.0 + 1.0;
        rank_sum += scored[i..=j].iter().filter(|(_, p)| *p).count() as f64 * average_rank;
        i = j + 1;
    }
    (rank_sum - positives * (positives + 1.0) / 2.0) / (positives * negatives)
}

/// Bounds and renormalises: every weight within its step and absolute limits, sum 1.
pub fn constrain(candidate: [f64; 6], current: [f64; 6]) -> [f64; 6] {
    let lower: [f64; 6] = std::array::from_fn(|i| (current[i] - MAX_STEP).max(MIN_WEIGHT));
    let upper: [f64; 6] = std::array::from_fn(|i| (current[i] + MAX_STEP).min(MAX_WEIGHT));
    let mut w: [f64; 6] = std::array::from_fn(|i| candidate[i].clamp(lower[i], upper[i]));
    // Spread any surplus or deficit over the weights that still have room.
    for _ in 0..100 {
        let gap = 1.0 - w.iter().sum::<f64>();
        if gap.abs() < 1e-12 {
            break;
        }
        let free: Vec<usize> = (0..6)
            .filter(|&i| {
                if gap > 0.0 {
                    w[i] < upper[i]
                } else {
                    w[i] > lower[i]
                }
            })
            .collect();
        if free.is_empty() {
            break;
        }
        let share = gap / free.len() as f64;
        for i in free {
            w[i] = (w[i] + share).clamp(lower[i], upper[i]);
        }
    }
    w.map(|x| (x * 1e6).round() / 1e6)
}

/// Proposes new weights from decisions, or explains why not.
pub fn fit_weights(samples: &[Sample], current: &Weights, options: &FitOptions) -> FitOutcome {
    let positives = samples.iter().filter(|s| s.positive).count();
    let negatives = samples.len() - positives;
    if samples.len() < options.min_samples
        || positives < options.min_per_class
        || negatives < options.min_per_class
    {
        return FitOutcome {
            status: "insufficient_data",
            weights: None,
            metrics: None,
        };
    }
    // Deterministic split: every fifth sample is held out.
    let (mut train, mut validation): (Vec<&Sample>, Vec<&Sample>) = (Vec::new(), Vec::new());
    for (i, sample) in samples.iter().enumerate() {
        if i % 5 == 4 {
            validation.push(sample);
        } else {
            train.push(sample);
        }
    }
    let (_, beta) = logistic(&train, options);
    let current_array = current.to_array();
    // Dimensions that predict positive decisions more strongly get more weight.
    let positive_part: [f64; 6] = beta.map(|b| b.max(0.0));
    let total: f64 = positive_part.iter().sum();
    let candidate = if total == 0.0 {
        current_array
    } else {
        positive_part.map(|b| b / total)
    };
    let proposed = constrain(candidate, current_array);
    let auc_current = auc(&validation, &current_array);
    let auc_proposed = auc(&validation, &proposed);
    let metrics = FitMetrics {
        samples: samples.len(),
        positives,
        negatives,
        train_size: train.len(),
        validation_size: validation.len(),
        coefficients: beta.map(|b| (b * 1e6).round() / 1e6),
        auc_current,
        auc_proposed,
    };
    let improved = auc_proposed > auc_current && proposed != current_array;
    FitOutcome {
        status: if improved {
            "proposed"
        } else {
            "no_improvement"
        },
        weights: improved.then(|| Weights::from_array(proposed)),
        metrics: Some(metrics),
    }
}

/// Dimension names in the order coefficients and scores use.
pub fn dimension_keys() -> [&'static str; 6] {
    DIMENSIONS.map(|d| d.key())
}

#[cfg(test)]
mod tests {
    use super::*;

    const CURRENT: Weights = Weights {
        emotional: 0.25,
        communication: 0.2,
        lifestyle: 0.2,
        relationship_alignment: 0.15,
        intellectual: 0.1,
        mutual_preferences: 0.1,
    };

    /// xorshift: tests need reproducible noise without a dependency.
    struct Rng(u64);
    impl Rng {
        fn next(&mut self) -> f64 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            (self.0 >> 11) as f64 / (1u64 << 53) as f64
        }
    }

    /// Decisions driven mostly by communication, then lifestyle.
    fn synthetic(n: usize, seed: u64) -> Vec<Sample> {
        let mut rng = Rng(seed);
        let truth = [0.0, 6.0, 3.0, 0.0, 0.0, 0.0];
        (0..n)
            .map(|_| {
                let scores: [Option<f64>; 6] = std::array::from_fn(|_| {
                    if rng.next() < 0.1 {
                        None
                    } else {
                        Some(rng.next())
                    }
                });
                let z: f64 = scores
                    .iter()
                    .zip(truth)
                    .map(|(s, t)| s.map_or(0.0, |s| (s - 0.5) * t))
                    .sum();
                Sample {
                    scores,
                    positive: rng.next() < sigmoid(z),
                }
            })
            .collect()
    }

    #[test]
    fn learns_which_dimensions_matter_within_the_guardrails() {
        let outcome = fit_weights(&synthetic(3000, 7), &CURRENT, &FitOptions::default());
        assert_eq!(outcome.status, "proposed");
        let w = outcome.weights.unwrap().to_array();
        let c = CURRENT.to_array();
        assert!(w[1] > c[1], "communication up: {w:?}");
        assert!(w[2] > c[2], "lifestyle up: {w:?}");
        assert!(w[0] < c[0], "emotional down: {w:?}");
        assert!((w.iter().sum::<f64>() - 1.0).abs() < 1e-5);
        for i in 0..6 {
            assert!((MIN_WEIGHT - 1e-9..=MAX_WEIGHT + 1e-9).contains(&w[i]));
            assert!((w[i] - c[i]).abs() <= MAX_STEP + 1e-6, "step {i}: {w:?}");
        }
        let m = outcome.metrics.unwrap();
        assert!(m.auc_proposed > m.auc_current);
    }

    #[test]
    fn is_deterministic() {
        let samples = synthetic(1500, 11);
        let a = fit_weights(&samples, &CURRENT, &FitOptions::default());
        let b = fit_weights(&samples, &CURRENT, &FitOptions::default());
        assert_eq!(a, b);
    }

    #[test]
    fn refuses_too_little_or_one_sided_data() {
        let few = synthetic(100, 3);
        assert_eq!(
            fit_weights(&few, &CURRENT, &FitOptions::default()).status,
            "insufficient_data"
        );
        let mut one_sided = synthetic(1000, 5);
        for s in &mut one_sided {
            s.positive = true;
        }
        assert_eq!(
            fit_weights(&one_sided, &CURRENT, &FitOptions::default()).status,
            "insufficient_data"
        );
    }

    #[test]
    fn keeps_the_current_weights_when_decisions_are_noise() {
        let mut rng = Rng(99);
        let noise: Vec<Sample> = (0..2000)
            .map(|_| Sample {
                scores: std::array::from_fn(|_| Some(rng.next())),
                positive: rng.next() < 0.5,
            })
            .collect();
        let outcome = fit_weights(&noise, &CURRENT, &FitOptions::default());
        // Random decisions should not produce a confident, better ranking.
        if outcome.status == "proposed" {
            let m = outcome.metrics.unwrap();
            assert!(m.auc_proposed - m.auc_current < 0.03, "{m:?}");
        }
    }

    #[test]
    fn constrain_respects_bounds_and_sum() {
        let w = constrain([1.0, 0.0, 0.0, 0.0, 0.0, 0.0], CURRENT.to_array());
        assert!((w.iter().sum::<f64>() - 1.0).abs() < 1e-5);
        assert_eq!(w[0], 0.3);
        assert!(w.iter().all(|x| *x >= MIN_WEIGHT - 1e-9));
    }

    #[test]
    fn auc_is_one_for_a_perfect_ranking() {
        let samples = [
            Sample {
                scores: [Some(0.9); 6],
                positive: true,
            },
            Sample {
                scores: [Some(0.1); 6],
                positive: false,
            },
        ];
        let refs: Vec<&Sample> = samples.iter().collect();
        assert_eq!(auc(&refs, &CURRENT.to_array()), 1.0);
    }
}
