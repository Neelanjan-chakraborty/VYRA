//! Wire formats. App ↔ gateway: MessagePack maps. API → gateway: JSON on Redis.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// What the app may send. Anything else closes the connection.
#[derive(Debug, Deserialize)]
#[serde(tag = "t", rename_all = "lowercase")]
pub enum ClientFrame {
    Auth { token: String },
    Typing { c: String },
    Ping,
}

/// What the gateway sends to the app.
#[derive(Debug, Serialize)]
#[serde(tag = "t", rename_all = "lowercase")]
pub enum ServerFrame<'a> {
    Ready,
    Pong,
    /// An API event, e.g. `conversation.changed` with ids only.
    Event {
        e: &'a str,
        d: &'a Value,
    },
}

/// Published by the API on `<namespace>:realtime`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Envelope {
    #[serde(default)]
    pub user_ids: Vec<String>,
    pub event: Option<String>,
    #[serde(default)]
    pub payload: Value,
    /// Close every socket of these users (deletion, suspension, sign-out everywhere).
    #[serde(default)]
    pub disconnect: Vec<String>,
    /// Close the sockets of these sessions only (signing out one device).
    #[serde(default)]
    pub disconnect_sessions: Vec<String>,
}

pub fn encode(frame: &ServerFrame) -> Vec<u8> {
    rmp_serde::to_vec_named(frame).expect("server frames always encode")
}

pub fn decode(bytes: &[u8]) -> Option<ClientFrame> {
    rmp_serde::from_slice(bytes).ok()
}

/// Close codes the app understands.
pub mod close {
    pub const SIGNED_OUT: u16 = 4000;
    pub const UNAUTHORIZED: u16 = 4001;
    pub const BAD_FRAME: u16 = 4002;
    pub const AUTH_TIMEOUT: u16 = 4008;
    pub const TOO_MANY: u16 = 4029;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_client_frames_and_rejects_anything_else() {
        let auth =
            rmp_serde::to_vec_named(&serde_json::json!({ "t": "auth", "token": "x" })).unwrap();
        assert!(matches!(decode(&auth), Some(ClientFrame::Auth { token }) if token == "x"));
        let typing =
            rmp_serde::to_vec_named(&serde_json::json!({ "t": "typing", "c": "id" })).unwrap();
        assert!(matches!(decode(&typing), Some(ClientFrame::Typing { c }) if c == "id"));
        let unknown =
            rmp_serde::to_vec_named(&serde_json::json!({ "t": "send", "body": "hi" })).unwrap();
        assert!(decode(&unknown).is_none());
        assert!(decode(b"not msgpack").is_none());
    }

    #[test]
    fn events_are_compact_named_maps() {
        let payload = serde_json::json!({ "conversationId": "c1", "reason": "message" });
        let bytes = encode(&ServerFrame::Event {
            e: "conversation.changed",
            d: &payload,
        });
        let back: serde_json::Value = rmp_serde::from_slice(&bytes).unwrap();
        assert_eq!(
            back,
            serde_json::json!({ "t": "event", "e": "conversation.changed", "d": payload })
        );
        // MessagePack is smaller than the same JSON.
        assert!(bytes.len() < back.to_string().len());
    }
}
