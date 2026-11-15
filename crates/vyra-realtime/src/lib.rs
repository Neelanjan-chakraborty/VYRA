//! VYRA's real-time gateway. It holds every app connection, authenticates it
//! like the API does, delivers the API's id-only events (published on Redis,
//! so any number of gateway instances can run), tracks presence for push
//! suppression, and relays "typing" after checking the same access rule as the
//! API. It never writes messages: NestJS stays the one place for business rules.

pub mod auth;
pub mod config;
pub mod hub;
pub mod protocol;

use auth::{Verifier, typing_recipient};
use axum::{
    Json, Router,
    extract::{
        State, WebSocketUpgrade,
        ws::{CloseFrame, Message, WebSocket},
    },
    http::{HeaderMap, StatusCode, header::ORIGIN},
    response::{IntoResponse, Response},
    routing::get,
};
use config::Config;
use futures_util::{SinkExt, StreamExt};
use hub::{Hub, Outbound};
use protocol::{ClientFrame, Envelope, ServerFrame, close, decode, encode};
use redis::AsyncCommands;
use redis::aio::ConnectionManager;
use serde_json::json;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

const AUTH_TIMEOUT: Duration = Duration::from_secs(5);
const HEARTBEAT: Duration = Duration::from_secs(25);
/// Presence outlives a missed heartbeat or two, then expires on its own.
const PRESENCE_TTL_SECONDS: i64 = 90;
const TYPING_INTERVAL: Duration = Duration::from_secs(2);
/// Client frames allowed per second before the connection is closed.
const MAX_FRAMES_PER_SECOND: u32 = 20;
const OUTBOUND_QUEUE: usize = 64;

pub struct AppState {
    pub config: Config,
    pub pool: PgPool,
    pub verifier: Verifier,
    pub hub: Hub,
    pub redis: ConnectionManager,
}

pub type Shared = Arc<AppState>;

pub async fn state(config: Config) -> anyhow::Result<Shared> {
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;
    let client = redis::Client::open(config.redis_url.as_str())?;
    let redis = ConnectionManager::new(client).await?;
    Ok(Arc::new(AppState {
        verifier: Verifier::new(&config.jwt_secret),
        hub: Hub::default(),
        config,
        pool,
        redis,
    }))
}

pub fn router(state: Shared) -> Router {
    Router::new()
        .route("/v1/realtime", get(upgrade))
        .route("/health", get(health))
        .with_state(state)
}

async fn health(State(state): State<Shared>) -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "connections": state.hub.connections() }))
}

/// Browsers send an Origin; it must be on the allow-list. Native apps send none.
fn origin_allowed(config: &Config, headers: &HeaderMap) -> bool {
    match headers.get(ORIGIN).and_then(|v| v.to_str().ok()) {
        None => true,
        Some(origin) => config.cors_origins.iter().any(|o| o == origin),
    }
}

async fn upgrade(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    State(state): State<Shared>,
) -> Response {
    if !origin_allowed(&state.config, &headers) {
        return StatusCode::FORBIDDEN.into_response();
    }
    // Frames are tiny (ids only), so small buffers: the defaults reserve
    // ~128 KB per connection, which dominates memory at scale.
    ws.max_message_size(4 * 1024)
        .max_frame_size(4 * 1024)
        .read_buffer_size(4 * 1024)
        .write_buffer_size(4 * 1024)
        .max_write_buffer_size(64 * 1024)
        .on_upgrade(move |socket| connection(socket, state))
}

async fn close_with(socket: &mut WebSocket, code: u16) {
    let _ = socket
        .send(Message::Close(Some(CloseFrame {
            code,
            reason: "".into(),
        })))
        .await;
}

/// Waits for `{t:"auth", token}` and returns the user id and session id.
async fn authenticate(socket: &mut WebSocket, state: &AppState) -> Result<(String, String), u16> {
    let first = tokio::time::timeout(AUTH_TIMEOUT, socket.recv())
        .await
        .map_err(|_| close::AUTH_TIMEOUT)?;
    let Some(Ok(Message::Binary(bytes))) = first else {
        return Err(close::BAD_FRAME);
    };
    let Some(ClientFrame::Auth { token }) = decode(&bytes) else {
        return Err(close::BAD_FRAME);
    };
    state
        .verifier
        .verify(&state.pool, &token)
        .await
        .ok_or(close::UNAUTHORIZED)
}

async fn presence(state: &AppState, user_id: &str, delta: i64) {
    let key = state.config.presence_key(user_id);
    let mut redis = state.redis.clone();
    let result: redis::RedisResult<i64> = redis.incr(&key, delta).await;
    match result {
        Ok(count) if count <= 0 => {
            let _: redis::RedisResult<()> = redis.del(&key).await;
        }
        Ok(_) => {
            let _: redis::RedisResult<()> = redis.expire(&key, PRESENCE_TTL_SECONDS).await;
        }
        Err(error) => warn!(%error, "presence update failed"),
    }
}

async fn publish(state: &AppState, envelope: serde_json::Value) {
    let mut redis = state.redis.clone();
    let result: redis::RedisResult<()> = redis
        .publish(state.config.channel(), envelope.to_string())
        .await;
    if let Err(error) = result {
        warn!(%error, "publish failed");
    }
}

async fn connection(mut socket: WebSocket, state: Shared) {
    let (user_id, session_id) = match authenticate(&mut socket, &state).await {
        Ok(ids) => ids,
        Err(code) => {
            close_with(&mut socket, code).await;
            return;
        }
    };
    let (tx, mut rx) = mpsc::channel::<Outbound>(OUTBOUND_QUEUE);
    let connection_id = state.hub.register(&user_id, &session_id, tx.clone());
    debug!(
        connections = state.hub.connections(),
        "connection authenticated"
    );
    presence(&state, &user_id, 1).await;
    let _ = tx.try_send(Outbound::Bytes(encode(&ServerFrame::Ready)));

    let (mut sink, mut stream) = socket.split();
    let writer_state = state.clone();
    let writer_user = user_id.clone();
    let writer = tokio::spawn(async move {
        let mut heartbeat = tokio::time::interval(HEARTBEAT);
        heartbeat.tick().await;
        loop {
            tokio::select! {
                message = rx.recv() => match message {
                    Some(Outbound::Bytes(bytes)) => {
                        if sink.send(Message::Binary(bytes.into())).await.is_err() { break; }
                    }
                    Some(Outbound::Close(code)) => {
                        let _ = sink.send(Message::Close(Some(CloseFrame { code, reason: "".into() }))).await;
                        break;
                    }
                    None => break,
                },
                _ = heartbeat.tick() => {
                    if sink.send(Message::Ping(Vec::new().into())).await.is_err() { break; }
                    let key = writer_state.config.presence_key(&writer_user);
                    let mut redis = writer_state.redis.clone();
                    let _: redis::RedisResult<()> = redis.expire(&key, PRESENCE_TTL_SECONDS).await;
                }
            }
        }
    });

    let mut window_start = Instant::now();
    let mut frames_in_window = 0u32;
    let mut last_typing: HashMap<String, Instant> = HashMap::new();
    while let Some(Ok(message)) = stream.next().await {
        let bytes = match message {
            Message::Binary(bytes) => bytes,
            Message::Close(_) => break,
            Message::Ping(_) | Message::Pong(_) => continue,
            Message::Text(_) => {
                let _ = tx.try_send(Outbound::Close(close::BAD_FRAME));
                break;
            }
        };
        if window_start.elapsed() >= Duration::from_secs(1) {
            window_start = Instant::now();
            frames_in_window = 0;
        }
        frames_in_window += 1;
        if frames_in_window > MAX_FRAMES_PER_SECOND {
            let _ = tx.try_send(Outbound::Close(close::TOO_MANY));
            break;
        }
        match decode(&bytes) {
            Some(ClientFrame::Ping) => {
                let _ = tx.try_send(Outbound::Bytes(encode(&ServerFrame::Pong)));
            }
            Some(ClientFrame::Typing { c }) => {
                let now = Instant::now();
                if last_typing
                    .get(&c)
                    .is_some_and(|at| now.duration_since(*at) < TYPING_INTERVAL)
                {
                    continue;
                }
                last_typing.insert(c.clone(), now);
                let recipient = typing_recipient(&state.pool, &user_id, &c).await;
                debug!(relayed = recipient.is_some(), "typing");
                if let Some(other) = recipient {
                    publish(
                        &state,
                        json!({ "userIds": [other], "event": "typing", "payload": { "conversationId": c } }),
                    )
                    .await;
                }
            }
            Some(ClientFrame::Auth { .. }) | None => {
                let _ = tx.try_send(Outbound::Close(close::BAD_FRAME));
                break;
            }
        }
    }

    state.hub.unregister(&user_id, connection_id);
    drop(tx);
    let _ = writer.await;
    presence(&state, &user_id, -1).await;
}

/// Delivers API events published on Redis to this instance's sockets.
/// Reconnects with backoff if Redis goes away.
pub async fn subscribe(state: Shared) {
    let mut backoff = Duration::from_millis(250);
    loop {
        match listen(&state).await {
            Ok(()) => backoff = Duration::from_millis(250),
            Err(error) => warn!(%error, "event subscription lost; retrying"),
        }
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(Duration::from_secs(10));
    }
}

async fn listen(state: &AppState) -> anyhow::Result<()> {
    let client = redis::Client::open(state.config.redis_url.as_str())?;
    let mut pubsub = client.get_async_pubsub().await?;
    pubsub.subscribe(state.config.channel()).await?;
    info!(channel = %state.config.channel(), "listening for events");
    let mut messages = pubsub.on_message();
    while let Some(message) = messages.next().await {
        let Ok(payload) = message.get_payload::<String>() else {
            continue;
        };
        let Ok(envelope) = serde_json::from_str::<Envelope>(&payload) else {
            warn!("ignoring malformed event");
            continue;
        };
        dispatch(state, &envelope);
    }
    Ok(())
}

pub fn dispatch(state: &AppState, envelope: &Envelope) {
    for user in &envelope.disconnect {
        state.hub.send(user, Outbound::Close(close::SIGNED_OUT));
    }
    for session in &envelope.disconnect_sessions {
        state.hub.close_session(session, close::SIGNED_OUT);
    }
    if let Some(event) = &envelope.event {
        let bytes = encode(&ServerFrame::Event {
            e: event,
            d: &envelope.payload,
        });
        for user in &envelope.user_ids {
            state.hub.send(user, Outbound::Bytes(bytes.clone()));
        }
    }
}
