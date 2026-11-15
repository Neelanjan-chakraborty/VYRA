//! `cargo bench -p vyra-engine`: one pair, and one viewer against 200 candidates.
use criterion::{Criterion, black_box, criterion_group, criterion_main};
use flate2::read::GzDecoder;
use serde_json::Value;
use std::io::Read;
use vyra_engine::{Person, Weights, rank_with_diversity, score, score_many};

fn people() -> (Vec<Person>, Weights) {
    let file = std::fs::File::open(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/parity.json.gz"
    ))
    .unwrap();
    let mut json = String::new();
    GzDecoder::new(file).read_to_string(&mut json).unwrap();
    let value: Value = serde_json::from_str(&json).unwrap();
    let pairs = value["pairs"].as_array().unwrap();
    let people = pairs
        .iter()
        .flat_map(|p| [p["a"].clone(), p["b"].clone()])
        .map(|v| serde_json::from_value(v).unwrap())
        .collect();
    let weights = serde_json::from_value(pairs[0]["weights"].clone()).unwrap();
    (people, weights)
}

fn benches(c: &mut Criterion) {
    let (people, weights) = people();
    let (a, b) = (&people[0], &people[1]);
    c.bench_function("score one pair", |bench| {
        bench.iter(|| score(black_box(a), black_box(b), &weights, "w"))
    });
    let candidates = &people[2..202];
    c.bench_function("gate + score + rank 200 candidates", |bench| {
        bench.iter(|| {
            let scored = score_many(black_box(a), black_box(candidates), &weights, "w");
            let items: Vec<_> = scored
                .into_iter()
                .zip(candidates)
                .filter_map(|(s, p)| s.result.map(|r| (p.id.clone(), r)))
                .collect();
            rank_with_diversity(&items, &weights)
        })
    });
}

criterion_group!(engine, benches);
criterion_main!(engine);
