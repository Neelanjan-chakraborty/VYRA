//! The Rust engine must produce what the TypeScript reference produces.
//! Fixtures come from `scripts/engine-fixtures.mjs` (regenerate with
//! `pnpm engine:fixtures`): 2 000 seeded pairs covering every gate, every
//! sufficiency level and every attribute kind, plus 60 rankings.

use flate2::read::GzDecoder;
use serde::Deserialize;
use serde_json::Value;
use std::io::Read;
use vyra_engine::{
    CompatibilityResult, Person, Weights, highlights, ineligibility, rank_with_diversity, score,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Pair {
    a: Person,
    b: Person,
    weights: Weights,
    weights_version: String,
    ineligibility: Option<String>,
    result: Value,
    highlights: Vec<String>,
}

#[derive(Deserialize)]
struct Item {
    key: String,
    result: CompatibilityResult,
}

#[derive(Deserialize)]
struct Ranking {
    weights: Weights,
    items: Vec<Item>,
    ranked: Vec<String>,
}

#[derive(Deserialize)]
struct Fixtures {
    pairs: Vec<Pair>,
    rankings: Vec<Ranking>,
}

fn fixtures() -> Fixtures {
    let file = std::fs::File::open(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/parity.json.gz"
    ))
    .expect("fixtures exist");
    let mut json = String::new();
    GzDecoder::new(file)
        .read_to_string(&mut json)
        .expect("gzip");
    serde_json::from_str(&json).expect("fixtures parse")
}

/// Structural equality; numbers must agree to 1e-12 (the engine rounds to 1e-3).
fn assert_same(path: &str, actual: &Value, expected: &Value) {
    match (actual, expected) {
        (Value::Number(a), Value::Number(e)) => {
            let (a, e) = (a.as_f64().unwrap(), e.as_f64().unwrap());
            assert!((a - e).abs() <= 1e-12, "{path}: {a} != {e}");
        }
        (Value::Array(a), Value::Array(e)) => {
            assert_eq!(a.len(), e.len(), "{path}: length");
            for (i, (x, y)) in a.iter().zip(e).enumerate() {
                assert_same(&format!("{path}[{i}]"), x, y);
            }
        }
        (Value::Object(a), Value::Object(e)) => {
            let mut ak: Vec<_> = a.keys().collect();
            let mut ek: Vec<_> = e.keys().collect();
            ak.sort();
            ek.sort();
            assert_eq!(ak, ek, "{path}: keys");
            for (k, v) in e {
                assert_same(&format!("{path}.{k}"), &a[k], v);
            }
        }
        _ => assert_eq!(actual, expected, "{path}"),
    }
}

#[test]
fn every_pair_matches_the_typescript_engine() {
    let fixtures = fixtures();
    assert!(fixtures.pairs.len() >= 2000);
    for (i, pair) in fixtures.pairs.iter().enumerate() {
        assert_eq!(
            ineligibility(&pair.a, &pair.b).map(str::to_string),
            pair.ineligibility,
            "pair {i}: gate"
        );
        let result = score(&pair.a, &pair.b, &pair.weights, &pair.weights_version);
        assert_same(
            &format!("pair {i}"),
            &serde_json::to_value(&result).unwrap(),
            &pair.result,
        );
        assert_eq!(
            highlights(&result, &pair.weights, 3),
            pair.highlights,
            "pair {i}: highlights"
        );
    }
}

#[test]
fn every_ranking_matches_the_typescript_engine() {
    for (i, ranking) in fixtures().rankings.iter().enumerate() {
        let items: Vec<(String, CompatibilityResult)> = ranking
            .items
            .iter()
            .map(|item| (item.key.clone(), item.result.clone()))
            .collect();
        let order: Vec<String> = rank_with_diversity(&items, &ranking.weights)
            .into_iter()
            .map(|index| items[index].0.clone())
            .collect();
        assert_eq!(order, ranking.ranked, "ranking {i}");
    }
}
