//! Per-feature comparisons between two people. A port of `features.ts` and
//! `criteria.ts`; every number and sentence must match the TypeScript engine.

use crate::catalogue::{Definition, definition};
use crate::geo::distance_km;
use crate::types::{Criterion, Person, TraitValue};

/// Confidence given to facts people stated themselves.
pub const STATED_CONFIDENCE: f64 = 0.95;
/// An inferred trait must be at least this confident before a must-have can exclude on it.
pub const MUST_HAVE_MIN_CONFIDENCE: f64 = 0.6;

#[derive(Debug, Clone, PartialEq)]
pub struct Comparison {
    pub similarity: f64,
    pub confidence: f64,
    pub aligned: Option<String>,
    pub different: Option<String>,
}

/// JavaScript's `Math.round`: nearest integer, halves towards +∞.
pub fn js_round(x: f64) -> f64 {
    let floor = x.floor();
    if x - floor >= 0.5 { floor + 1.0 } else { floor }
}

/// Rounds to three decimals the way the TypeScript engine does.
pub fn round3(n: f64) -> f64 {
    js_round(n * 1000.0) / 1000.0
}

/// Same order as JavaScript's default string sort for these ASCII values.
fn pair_matches(a: &str, b: &str, x: &str, y: &str) -> bool {
    (a == x && b == y) || (a == y && b == x)
}

fn communication_fit(a: &str, b: &str) -> f64 {
    const TABLE: [(&str, &str, f64); 6] = [
        ("concise", "expansive", 0.4),
        ("playful", "reflective", 0.5),
        ("concise", "playful", 0.6),
        ("concise", "reflective", 0.7),
        ("expansive", "playful", 0.7),
        ("expansive", "reflective", 0.8),
    ];
    lookup(&TABLE, a, b)
}

fn weekend_fit(a: &str, b: &str) -> f64 {
    const TABLE: [(&str, &str, f64); 6] = [
        ("restful", "social", 0.4),
        ("restful", "adventurous", 0.3),
        ("restful", "productive", 0.6),
        ("social", "adventurous", 0.7),
        ("social", "productive", 0.4),
        ("adventurous", "productive", 0.5),
    ];
    lookup(&TABLE, a, b)
}

fn lookup(table: &[(&str, &str, f64)], a: &str, b: &str) -> f64 {
    table
        .iter()
        .find(|(x, y, _)| pair_matches(a, b, x, y))
        .map_or(0.5, |(_, _, v)| *v)
}

fn pace_index(value: &str) -> f64 {
    match value {
        "homebody" => 0.0,
        "balanced" => 1.0,
        "outgoing" => 2.0,
        _ => -1.0,
    }
}

fn single_intent_fit(a: &str, b: &str) -> f64 {
    if a == "other" || b == "other" {
        return if a == b { 0.6 } else { 0.5 };
    }
    if a == b {
        return 1.0;
    }
    const TABLE: [(&str, &str, f64); 6] = [
        ("serious", "casual", 0.0),
        ("serious", "companionship", 0.7),
        ("casual", "companionship", 0.5),
        ("exploring", "serious", 0.6),
        ("exploring", "casual", 0.8),
        ("exploring", "companionship", 0.7),
    ];
    lookup(&TABLE, a, b)
}

/// Best fit across both people's intentions, or None if either has none.
pub fn intent_fit(a: &[String], b: &[String]) -> Option<f64> {
    if a.is_empty() || b.is_empty() {
        return None;
    }
    let mut best = f64::NEG_INFINITY;
    for x in a {
        for y in b {
            best = best.max(single_intent_fit(x, y));
        }
    }
    Some(best)
}

/// JavaScript's `text.charAt(0).toLowerCase() + text.slice(1)`.
fn lower(text: &str) -> String {
    let mut chars = text.chars();
    match chars.next() {
        Some(first) => first.to_lowercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

fn option_label(options: &[crate::catalogue::OptionLabel], value: &str) -> String {
    lower(
        options
            .iter()
            .find(|o| o.value == value)
            .map_or(value, |o| o.label.as_str()),
    )
}

fn compare_trait(key: &str, a: &Person, b: &Person) -> Option<Comparison> {
    let ta = a.traits.get(key)?;
    let tb = b.traits.get(key)?;
    let confidence = ta.confidence.min(tb.confidence);
    match (definition(key)?, &ta.value, &tb.value) {
        (
            Definition::Scale { label, low, high },
            TraitValue::Number(va),
            TraitValue::Number(vb),
        ) => {
            let similarity = 1.0 - (va - vb).abs();
            let mean = (va + vb) / 2.0;
            let side = if mean < 0.4 {
                Some(lower(low))
            } else if mean > 0.6 {
                Some(lower(high))
            } else {
                None
            };
            Some(Comparison {
                similarity,
                confidence,
                aligned: (similarity >= 0.75).then(|| match side {
                    Some(side) => format!("You both lean towards “{side}”"),
                    None => format!("You’re similar on {}", lower(label)),
                }),
                different: (similarity <= 0.5).then(|| {
                    format!(
                        "{label}: one of you leans towards “{}”, the other “{}”",
                        lower(low),
                        lower(high)
                    )
                }),
            })
        }
        (Definition::Enum { label, options }, TraitValue::Text(va), TraitValue::Text(vb)) => {
            let similarity = if va == vb {
                1.0
            } else if key == "communicationStyle" {
                communication_fit(va, vb)
            } else if key == "weekendRhythm" {
                weekend_fit(va, vb)
            } else {
                1.0 - (pace_index(va) - pace_index(vb)).abs() / 2.0
            };
            let (la, lb) = (option_label(options, va), option_label(options, vb));
            Some(Comparison {
                similarity,
                confidence,
                aligned: if va == vb {
                    Some(format!("{label}: you’re both “{la}”"))
                } else if similarity >= 0.75 {
                    Some(format!("{label}: “{la}” and “{lb}” tend to fit"))
                } else {
                    None
                },
                different: (similarity <= 0.5).then(|| format!("{label}: “{la}” and “{lb}”")),
            })
        }
        (
            Definition::List {
                vocabulary: Some(vocabulary),
                ..
            },
            TraitValue::List(va),
            TraitValue::List(vb),
        ) => {
            let shared: Vec<&String> = va.iter().filter(|v| vb.contains(v)).collect();
            let similarity = shared.len() as f64 / va.len().min(vb.len()) as f64;
            let labels: Vec<String> = shared.iter().map(|v| option_label(vocabulary, v)).collect();
            Some(Comparison {
                similarity,
                confidence,
                aligned: (!shared.is_empty())
                    .then(|| format!("You both value {}", labels.join(" and "))),
                different: shared
                    .is_empty()
                    .then(|| "You put different things first".to_string()),
            })
        }
        _ => None,
    }
}

fn compare_interests(a: &Person, b: &Person) -> Option<Comparison> {
    if a.interests.len() < 3 || b.interests.len() < 3 {
        return None;
    }
    let shared: Vec<_> = a
        .interests
        .iter()
        .filter(|i| b.interests.iter().any(|j| j.slug == i.slug))
        .collect();
    let similarity = (shared.len() as f64 / 3.0).min(1.0);
    Some(Comparison {
        similarity,
        confidence: STATED_CONFIDENCE,
        aligned: (!shared.is_empty()).then(|| {
            format!(
                "You share {}",
                shared
                    .iter()
                    .take(3)
                    .map(|i| lower(&i.label))
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        }),
        different: None,
    })
}

fn age_fit(age: f64, min: f64, max: f64) -> f64 {
    let mid = (min + max) / 2.0;
    let half = ((max - min) / 2.0).max(1.0);
    (1.0 - (0.4 * (age - mid).abs()) / half).max(0.0)
}

fn compare_preferences(a: &Person, b: &Person) -> Comparison {
    let mut fits = vec![
        age_fit(b.age, a.preferences.min_age, a.preferences.max_age),
        age_fit(a.age, b.preferences.min_age, b.preferences.max_age),
    ];
    if let (Some(la), Some(lb)) = (a.location, b.location) {
        let d = distance_km(la, lb);
        for limit in [a.preferences.max_distance_km, b.preferences.max_distance_km]
            .into_iter()
            .flatten()
        {
            fits.push((1.0 - (0.4 * d) / limit).max(0.0));
        }
    }
    let similarity = fits.iter().fold(0.0, |s, f| s + f) / fits.len() as f64;
    Comparison {
        similarity,
        confidence: STATED_CONFIDENCE,
        aligned: (similarity >= 0.8)
            .then(|| "You sit comfortably within each other’s preferences".to_string()),
        different: None,
    }
}

fn compare_intents(a: &Person, b: &Person) -> Option<Comparison> {
    let similarity = intent_fit(&a.intents, &b.intents)?;
    Some(Comparison {
        similarity,
        confidence: STATED_CONFIDENCE,
        aligned: if similarity == 1.0 {
            Some("You’re looking for the same kind of relationship".to_string())
        } else if similarity >= 0.6 {
            Some("What you’re looking for overlaps".to_string())
        } else {
            None
        },
        different: (similarity < 0.6)
            .then(|| "You may want different things from a relationship".to_string()),
    })
}

/// What is known about `person` for a criterion: its values and how sure we are.
pub fn known_value(person: &Person, criterion: &str) -> Option<(Vec<String>, f64)> {
    if criterion == "relationshipIntent" {
        return (!person.intents.is_empty()).then(|| (person.intents.clone(), STATED_CONFIDENCE));
    }
    let t = person.traits.get(criterion)?;
    let values = match &t.value {
        TraitValue::List(v) => v.clone(),
        TraitValue::Text(s) => vec![s.clone()],
        TraitValue::Number(_) => vec![],
    };
    (!values.is_empty()).then_some((values, t.confidence))
}

fn satisfies(values: &[String], criterion: &Criterion) -> bool {
    values.iter().any(|v| criterion.accepted.contains(v))
}

/// The first must-have `other` fails on a known value, if any. Unknown is never a mismatch.
pub fn fails_must_haves<'a>(viewer: &'a Person, other: &Person) -> Option<&'a Criterion> {
    viewer.preferences.criteria.iter().find(|c| {
        c.mode == "must"
            && known_value(other, &c.criterion).is_some_and(|(values, confidence)| {
                confidence >= MUST_HAVE_MIN_CONFIDENCE && !satisfies(&values, c)
            })
    })
}

/// Soft signal from "prefer" criteria, or None when nothing applies.
pub fn preference_fit(viewer: &Person, other: &Person) -> Option<(f64, f64)> {
    let mut weighted = 0.0;
    let mut weights = 0.0;
    for c in &viewer.preferences.criteria {
        if c.mode != "prefer" {
            continue;
        }
        let Some((values, confidence)) = known_value(other, &c.criterion) else {
            continue;
        };
        weighted += confidence * if satisfies(&values, c) { 1.0 } else { 0.0 };
        weights += confidence;
    }
    if weights == 0.0 {
        return None;
    }
    let prefer_count = viewer
        .preferences
        .criteria
        .iter()
        .filter(|c| c.mode == "prefer")
        .count() as f64;
    Some((weighted / weights, weights / prefer_count))
}

fn compare_stated_preferences(a: &Person, b: &Person) -> Option<Comparison> {
    let fits: Vec<(f64, f64)> = [preference_fit(a, b), preference_fit(b, a)]
        .into_iter()
        .flatten()
        .collect();
    if fits.is_empty() {
        return None;
    }
    let n = fits.len() as f64;
    let similarity = fits.iter().fold(0.0, |s, f| s + f.0) / n;
    let confidence = (fits.iter().fold(0.0, |s, f| s + f.1) / n).min(1.0);
    Some(Comparison {
        similarity,
        confidence,
        aligned: (similarity >= 0.75).then(|| "You match what each other prefers".to_string()),
        different: (similarity <= 0.25)
            .then(|| "Some of what you each prefer doesn’t match".to_string()),
    })
}

/// Persona attributes compared as features, in the TypeScript engine's order.
pub const TRAIT_FEATURES: [&str; 11] = [
    "emotionalExpressiveness",
    "affectionExpression",
    "conflictApproach",
    "communicationStyle",
    "socialEnergy",
    "lifestylePace",
    "weekendRhythm",
    "planningStyle",
    "intellectualCuriosity",
    "adventureOrientation",
    "values",
];

/// Every feature for a pair, rounded to three decimals, keyed by feature name.
pub fn compare_all(a: &Person, b: &Person) -> Vec<(&'static str, Comparison)> {
    let mut out = Vec::with_capacity(15);
    let mut set = |key: &'static str, c: Option<Comparison>| {
        if let Some(c) = c {
            out.push((
                key,
                Comparison {
                    similarity: round3(c.similarity),
                    confidence: round3(c.confidence),
                    ..c
                },
            ));
        }
    };
    for key in TRAIT_FEATURES {
        set(key, compare_trait(key, a, b));
    }
    set("intents", compare_intents(a, b));
    set("sharedInterests", compare_interests(a, b));
    set("preferenceFit", Some(compare_preferences(a, b)));
    set("statedPreferences", compare_stated_preferences(a, b));
    out
}

pub fn shared_interest_labels(a: &Person, b: &Person) -> Vec<String> {
    a.interests
        .iter()
        .filter(|i| b.interests.iter().any(|j| j.slug == i.slug))
        .map(|i| i.label.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounds_like_javascript() {
        assert_eq!(js_round(2.5), 3.0);
        assert_eq!(js_round(-2.5), -2.0);
        assert_eq!(js_round(0.499_999_999_999_999_94), 0.0);
        assert_eq!(round3(0.123_5), 0.124);
    }

    #[test]
    fn serious_and_casual_never_fit() {
        let fit = intent_fit(&["serious".into()], &["casual".into()]);
        assert_eq!(fit, Some(0.0));
        assert_eq!(intent_fit(&[], &["casual".into()]), None);
    }
}
