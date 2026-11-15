//! Inputs and outputs, shaped exactly like the TypeScript engine's JSON so the
//! two implementations are interchangeable and can be compared value for value.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// A persona attribute value: a 0–1 scale, an option, or a list of options.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub enum TraitValue {
    Number(f64),
    Text(String),
    List(Vec<String>),
}

/// Hand-written instead of `#[serde(untagged)]`, which buffers every value
/// before trying each variant; this reads the JSON once.
impl<'de> Deserialize<'de> for TraitValue {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct Visitor;
        impl<'de> serde::de::Visitor<'de> for Visitor {
            type Value = TraitValue;
            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("a number, a string or a list of strings")
            }
            fn visit_f64<E>(self, v: f64) -> Result<TraitValue, E> {
                Ok(TraitValue::Number(v))
            }
            fn visit_u64<E>(self, v: u64) -> Result<TraitValue, E> {
                Ok(TraitValue::Number(v as f64))
            }
            fn visit_i64<E>(self, v: i64) -> Result<TraitValue, E> {
                Ok(TraitValue::Number(v as f64))
            }
            fn visit_str<E>(self, v: &str) -> Result<TraitValue, E> {
                Ok(TraitValue::Text(v.to_string()))
            }
            fn visit_string<E>(self, v: String) -> Result<TraitValue, E> {
                Ok(TraitValue::Text(v))
            }
            fn visit_seq<A: serde::de::SeqAccess<'de>>(
                self,
                mut seq: A,
            ) -> Result<TraitValue, A::Error> {
                let mut list = Vec::with_capacity(seq.size_hint().unwrap_or(0));
                while let Some(item) = seq.next_element::<String>()? {
                    list.push(item);
                }
                Ok(TraitValue::List(list))
            }
        }
        deserializer.deserialize_any(Visitor)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Trait {
    pub value: TraitValue,
    pub confidence: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Criterion {
    pub criterion: String,
    /// "must", "prefer" or "open".
    pub mode: String,
    #[serde(default)]
    pub accepted: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub min_age: f64,
    pub max_age: f64,
    pub max_distance_km: Option<f64>,
    #[serde(default)]
    pub show_genders: Vec<String>,
    pub include_unlisted_genders: bool,
    #[serde(default)]
    pub criteria: Vec<Criterion>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Location {
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Interest {
    pub slug: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    pub id: String,
    pub age: f64,
    /// As stated; None = not answered. Never inferred.
    pub gender: Option<String>,
    #[serde(default)]
    pub discoverable_as: Vec<String>,
    #[serde(default)]
    pub intents: Vec<String>,
    pub preferences: Preferences,
    pub location: Option<Location>,
    /// From the approved persona only. Missing = unknown.
    #[serde(default)]
    pub traits: BTreeMap<String, Trait>,
    #[serde(default)]
    pub interests: Vec<Interest>,
}

/// Dimension weights, keyed by dimension name.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Weights {
    pub emotional: f64,
    pub communication: f64,
    pub lifestyle: f64,
    pub relationship_alignment: f64,
    pub intellectual: f64,
    pub mutual_preferences: f64,
}

impl Weights {
    pub fn get(&self, dimension: Dimension) -> f64 {
        match dimension {
            Dimension::Emotional => self.emotional,
            Dimension::Communication => self.communication,
            Dimension::Lifestyle => self.lifestyle,
            Dimension::RelationshipAlignment => self.relationship_alignment,
            Dimension::Intellectual => self.intellectual,
            Dimension::MutualPreferences => self.mutual_preferences,
        }
    }

    pub fn from_array(values: [f64; 6]) -> Self {
        Self {
            emotional: values[0],
            communication: values[1],
            lifestyle: values[2],
            relationship_alignment: values[3],
            intellectual: values[4],
            mutual_preferences: values[5],
        }
    }

    pub fn to_array(self) -> [f64; 6] {
        DIMENSIONS.map(|d| self.get(d))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Dimension {
    Emotional,
    Communication,
    Lifestyle,
    RelationshipAlignment,
    Intellectual,
    MutualPreferences,
}

/// In the same order as `COMPATIBILITY_DIMENSIONS` in `@vyra/validation`.
pub const DIMENSIONS: [Dimension; 6] = [
    Dimension::Emotional,
    Dimension::Communication,
    Dimension::Lifestyle,
    Dimension::RelationshipAlignment,
    Dimension::Intellectual,
    Dimension::MutualPreferences,
];

impl Dimension {
    pub fn key(self) -> &'static str {
        match self {
            Dimension::Emotional => "emotional",
            Dimension::Communication => "communication",
            Dimension::Lifestyle => "lifestyle",
            Dimension::RelationshipAlignment => "relationshipAlignment",
            Dimension::Intellectual => "intellectual",
            Dimension::MutualPreferences => "mutualPreferences",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FeatureResult {
    pub feature: String,
    pub similarity: f64,
    pub confidence: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DimensionResult {
    pub score: Option<f64>,
    pub confidence: f64,
    pub coverage: f64,
    pub features: Vec<FeatureResult>,
    pub aligned: Vec<String>,
    pub different: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ScenarioResult {
    pub key: String,
    pub alignment: Option<f64>,
    pub confidence: f64,
    pub features: Vec<FeatureResult>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dimensions {
    pub emotional: DimensionResult,
    pub communication: DimensionResult,
    pub lifestyle: DimensionResult,
    pub relationship_alignment: DimensionResult,
    pub intellectual: DimensionResult,
    pub mutual_preferences: DimensionResult,
}

impl Dimensions {
    pub fn get(&self, dimension: Dimension) -> &DimensionResult {
        match dimension {
            Dimension::Emotional => &self.emotional,
            Dimension::Communication => &self.communication,
            Dimension::Lifestyle => &self.lifestyle,
            Dimension::RelationshipAlignment => &self.relationship_alignment,
            Dimension::Intellectual => &self.intellectual,
            Dimension::MutualPreferences => &self.mutual_preferences,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompatibilityResult {
    pub engine_version: String,
    pub weights_version: String,
    pub overall: Option<f64>,
    pub confidence: f64,
    /// "INSUFFICIENT", "PARTIAL" or "SUFFICIENT".
    pub sufficiency: String,
    pub dimensions: Dimensions,
    pub scenarios: Vec<ScenarioResult>,
    pub shared_interests: Vec<String>,
}
