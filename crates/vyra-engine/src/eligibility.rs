use crate::features::{fails_must_haves, intent_fit};
use crate::geo::distance_km;
use crate::types::Person;

fn accepts_age(viewer: &Person, other: &Person) -> bool {
    other.age >= viewer.preferences.min_age && other.age <= viewer.preferences.max_age
}

/// Whether `viewer`'s "show me" choice includes `other`. Nothing is inferred.
pub fn accepts_gender(viewer: &Person, other: &Person) -> bool {
    let wanted = &viewer.preferences.show_genders;
    if wanted.is_empty() {
        return true;
    }
    match other.gender.as_deref() {
        Some(identity @ ("WOMAN" | "MAN" | "NON_BINARY")) => wanted.iter().any(|w| w == identity),
        Some("SELF_DESCRIBE") if !other.discoverable_as.is_empty() => {
            other.discoverable_as.iter().any(|c| wanted.contains(c))
        }
        _ => viewer.preferences.include_unlisted_genders,
    }
}

fn within_distance(viewer: &Person, other: &Person) -> bool {
    match (
        viewer.preferences.max_distance_km,
        viewer.location,
        other.location,
    ) {
        (Some(limit), Some(a), Some(b)) => distance_km(a, b) <= limit,
        _ => true,
    }
}

/// Hard gates in both directions. The first reason the pair is ineligible, or None.
pub fn ineligibility(a: &Person, b: &Person) -> Option<&'static str> {
    if a.id == b.id {
        return Some("self");
    }
    if !accepts_age(a, b) || !accepts_age(b, a) {
        return Some("age_preference");
    }
    if !accepts_gender(a, b) || !accepts_gender(b, a) {
        return Some("gender_preference");
    }
    if !within_distance(a, b) || !within_distance(b, a) {
        return Some("distance");
    }
    if intent_fit(&a.intents, &b.intents).unwrap_or(0.0) < 0.5 {
        return Some("intent_mismatch");
    }
    if fails_must_haves(a, b).is_some() || fails_must_haves(b, a).is_some() {
        return Some("must_have");
    }
    None
}
