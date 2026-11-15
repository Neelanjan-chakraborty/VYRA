//! Thin N-API layer over `vyra-engine`. Values cross the boundary as JSON
//! strings: one serialisation each way per call, and `score_many` handles a
//! whole candidate pool in a single call, so the boundary cost stays small.

use napi::{Error, Result, Status};
use napi_derive::napi;
use vyra_engine::{CompatibilityResult, Person, Weights};

fn parse<T: serde::de::DeserializeOwned>(what: &str, json: &str) -> Result<T> {
    serde_json::from_str(json)
        .map_err(|e| Error::new(Status::InvalidArg, format!("invalid {what}: {e}")))
}

fn to_json<T: serde::Serialize>(value: &T) -> Result<String> {
    serde_json::to_string(value).map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
}

/// The engine version this build implements, e.g. "compat-2".
#[napi]
pub fn engine_version() -> String {
    vyra_engine::ENGINE_VERSION.to_string()
}

/// Why two people can't be shown to each other, or null.
#[napi]
pub fn ineligibility(a: String, b: String) -> Result<Option<String>> {
    let (a, b): (Person, Person) = (parse("person", &a)?, parse("person", &b)?);
    Ok(vyra_engine::ineligibility(&a, &b).map(str::to_string))
}

/// Full compatibility result for one pair, as JSON.
#[napi]
pub fn score(a: String, b: String, weights: String, weights_version: String) -> Result<String> {
    let (a, b): (Person, Person) = (parse("person", &a)?, parse("person", &b)?);
    let weights: Weights = parse("weights", &weights)?;
    to_json(&vyra_engine::score(&a, &b, &weights, &weights_version))
}

/// Up to `max` plain-language reasons from a result.
#[napi]
pub fn highlights(result: String, weights: String, max: u32) -> Result<Vec<String>> {
    let result: CompatibilityResult = parse("result", &result)?;
    let weights: Weights = parse("weights", &weights)?;
    Ok(vyra_engine::highlights(&result, &weights, max as usize))
}

/// Gates, scores and explains every candidate for one viewer. JSON array of
/// `{ ineligible, result, highlights }` in candidate order.
#[napi]
pub fn score_many(
    viewer: String,
    candidates: String,
    weights: String,
    weights_version: String,
) -> Result<String> {
    let viewer: Person = parse("viewer", &viewer)?;
    let candidates: Vec<Person> = parse("candidates", &candidates)?;
    let weights: Weights = parse("weights", &weights)?;
    to_json(&vyra_engine::score_many(
        &viewer,
        &candidates,
        &weights,
        &weights_version,
    ))
}

/// Ranked order (indexes into `items`) for `[[key, result], …]`.
#[napi]
pub fn rank_with_diversity(items: String, weights: String) -> Result<Vec<u32>> {
    let items: Vec<(String, CompatibilityResult)> = parse("items", &items)?;
    let weights: Weights = parse("weights", &weights)?;
    Ok(vyra_engine::rank_with_diversity(&items, &weights)
        .into_iter()
        .map(|i| i as u32)
        .collect())
}

/// Gate, score, rank and explain in one call; only the top `limit`, as JSON
/// `[{ index, result, highlights }]` in ranked order.
#[napi]
pub fn recommend(
    viewer: String,
    candidates: String,
    weights: String,
    weights_version: String,
    limit: u32,
) -> Result<String> {
    let viewer: Person = parse("viewer", &viewer)?;
    let candidates: Vec<Person> = parse("candidates", &candidates)?;
    let weights: Weights = parse("weights", &weights)?;
    to_json(&vyra_engine::recommend(
        &viewer,
        &candidates,
        &weights,
        &weights_version,
        limit as usize,
    ))
}

/// Gate reasons for many candidates (null = eligible).
#[napi]
pub fn ineligibility_many(viewer: String, candidates: String) -> Result<Vec<Option<String>>> {
    let viewer: Person = parse("viewer", &viewer)?;
    let candidates: Vec<Person> = parse("candidates", &candidates)?;
    Ok(vyra_engine::ineligibility_many(&viewer, &candidates)
        .into_iter()
        .map(|r| r.map(str::to_string))
        .collect())
}

/// Proposes new dimension weights from decisions (see `vyra_engine::learning`).
/// `samples`: `[{ scores: [6 × number|null], positive }]`; returns the outcome as JSON.
#[napi]
pub fn fit_weights(samples: String, current: String, options: String) -> Result<String> {
    let samples: Vec<vyra_engine::Sample> = parse("samples", &samples)?;
    let current: Weights = parse("weights", &current)?;
    let options: vyra_engine::FitOptions = parse("options", &options)?;
    to_json(&vyra_engine::fit_weights(&samples, &current, &options))
}
