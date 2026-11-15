//! The persona attribute catalogue, generated from `@vyra/validation` by
//! `scripts/engine-catalogue.mjs`. Only the labels used in explanations matter here.

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::LazyLock;

#[derive(Debug, Deserialize)]
pub struct OptionLabel {
    pub value: String,
    pub label: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Definition {
    Scale {
        label: String,
        low: String,
        high: String,
    },
    Enum {
        label: String,
        options: Vec<OptionLabel>,
    },
    List {
        vocabulary: Option<Vec<OptionLabel>>,
    },
}

static CATALOGUE: LazyLock<HashMap<String, Definition>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("catalogue.json")).expect("catalogue.json is valid")
});

pub fn definition(key: &str) -> Option<&'static Definition> {
    CATALOGUE.get(key)
}
