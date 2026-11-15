//! Access tokens are verified exactly like the API's `AccessVerifier`: an
//! HS256 JWT from issuer `vyra-api` for audience `vyra:access`, then the
//! session row is checked so sign-out and deletion take effect immediately.

use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::Deserialize;
use sqlx::PgPool;

#[derive(Deserialize)]
struct Claims {
    sub: String,
    sid: String,
}

pub struct Verifier {
    key: DecodingKey,
    validation: Validation,
}

impl Verifier {
    pub fn new(secret: &str) -> Self {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(&["vyra-api"]);
        validation.set_audience(&["vyra:access"]);
        validation.set_required_spec_claims(&["exp", "sub", "iss", "aud"]);
        validation.leeway = 0;
        Self {
            key: DecodingKey::from_secret(secret.as_bytes())
                .expect("an HMAC key accepts any bytes"),
            validation,
        }
    }

    /// The signed-in user's id and session id, or None for any invalid token or session.
    pub async fn verify(&self, pool: &PgPool, token: &str) -> Option<(String, String)> {
        let claims = decode::<Claims>(token, &self.key, &self.validation)
            .ok()?
            .claims;
        let session_id = uuid::Uuid::parse_str(&claims.sid).ok()?;
        let user_id = uuid::Uuid::parse_str(&claims.sub).ok()?;
        let row: Option<(bool,)> = sqlx::query_as(
            "select true from auth_sessions s join users u on u.id = s.user_id
             where s.id = $1 and s.user_id = $2 and s.revoked_at is null
               and s.expires_at > now() and u.deleted_at is null
               and u.status::text in ('ONBOARDING', 'ACTIVE', 'PAUSED')",
        )
        .bind(session_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .ok()?;
        row.map(|_| (claims.sub, claims.sid))
    }
}

/// The other participant, if `user_id` may tell them they're typing: same
/// rule as the API's `MessagingService.access` + `writable` + `shares_typing`.
pub async fn typing_recipient(
    pool: &PgPool,
    user_id: &str,
    conversation_id: &str,
) -> Option<String> {
    let user = uuid::Uuid::parse_str(user_id).ok()?;
    let conversation = uuid::Uuid::parse_str(conversation_id).ok()?;
    let row: Option<(uuid::Uuid,)> = sqlx::query_as(
        "select other.user_id
         from conversation_participants me
         join conversation_participants other
           on other.conversation_id = me.conversation_id and other.user_id <> me.user_id
         join conversations c on c.id = me.conversation_id
         join matches m on m.id = c.match_id
         join users ou on ou.id = other.user_id
         where me.conversation_id = $1 and me.user_id = $2 and me.shares_typing and not me.restricted
           and m.ended_at is null
           and ou.deleted_at is null and ou.status::text in ('ACTIVE', 'PAUSED')
           and not exists (
             select 1 from blocked_users b
             where (b.blocker_id = me.user_id and b.blocked_id = other.user_id)
                or (b.blocker_id = other.user_id and b.blocked_id = me.user_id))",
    )
    .bind(conversation)
    .bind(user)
    .fetch_optional(pool)
    .await
    .ok()?;
    row.map(|(id,)| id.to_string())
}
