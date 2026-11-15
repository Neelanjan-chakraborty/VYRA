//! Confidence-aware ranking with a diversity penalty. A port of `rank.ts`.

use crate::types::{CompatibilityResult, DIMENSIONS, Dimension, Weights};

pub const DIVERSITY_PENALTY: f64 = 0.05;

/// The estimate discounted by how unsure it is; insufficient results sort last.
pub fn rank_score(result: &CompatibilityResult) -> f64 {
    match result.overall {
        None => -1.0 + result.confidence,
        Some(overall) => overall * (0.5 + 0.5 * result.confidence),
    }
}

fn strongest_dimension(result: &CompatibilityResult, weights: &Weights) -> Option<Dimension> {
    let mut best = None;
    let mut best_value = -1.0;
    for d in DIMENSIONS {
        let value = weights.get(d) * result.dimensions.get(d).score.unwrap_or(-1.0);
        if value > best_value {
            best = Some(d);
            best_value = value;
        }
    }
    best
}

/// Orders items by `rank_score`, avoiding several picks in a row that are
/// strongest on the same dimension. Ties break on the key. Returns indexes
/// into `items` in ranked order.
pub fn rank_with_diversity(
    items: &[(String, CompatibilityResult)],
    weights: &Weights,
) -> Vec<usize> {
    let strongest: Vec<Option<Dimension>> = items
        .iter()
        .map(|(_, r)| strongest_dimension(r, weights))
        .collect();
    let scores: Vec<f64> = items.iter().map(|(_, r)| rank_score(r)).collect();
    let mut remaining: Vec<usize> = (0..items.len()).collect();
    let mut out = Vec::with_capacity(items.len());
    let mut previous: Option<Dimension> = None;
    while !remaining.is_empty() {
        let mut best_pos = 0;
        let mut best_value = f64::NEG_INFINITY;
        for (pos, &index) in remaining.iter().enumerate() {
            let penalty = if previous.is_some() && strongest[index] == previous {
                DIVERSITY_PENALTY
            } else {
                0.0
            };
            let value = scores[index] - penalty;
            let better = value > best_value
                || (value == best_value && items[index].0 < items[remaining[best_pos]].0);
            if better {
                best_pos = pos;
                best_value = value;
            }
        }
        let picked = remaining.remove(best_pos);
        previous = strongest[picked];
        out.push(picked);
    }
    out
}
