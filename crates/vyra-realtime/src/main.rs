use tracing::info;
use vyra_realtime::{config::Config, router, state, subscribe};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Like the API, read a local .env during development; real deployments set the environment.
    let _ = dotenvy::dotenv();
    // RUST_LOG, not LOG_LEVEL: the API's LOG_LEVEL values ("log", …) aren't filter directives.
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    if std::env::var("NODE_ENV").as_deref() == Ok("production") {
        tracing_subscriber::fmt()
            .json()
            .with_env_filter(filter)
            .init();
    } else {
        tracing_subscriber::fmt().with_env_filter(filter).init();
    }

    let config = Config::from_env()?;
    let port = config.port;
    let shared = state(config).await?;
    tokio::spawn(subscribe(shared.clone()));

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    info!(port, "VYRA realtime gateway listening");
    axum::serve(listener, router(shared))
        .with_graceful_shutdown(async {
            let ctrl_c = tokio::signal::ctrl_c();
            #[cfg(unix)]
            {
                let mut term =
                    tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                        .expect("signal handler");
                tokio::select! { _ = ctrl_c => {}, _ = term.recv() => {} }
            }
            #[cfg(not(unix))]
            let _ = ctrl_c.await;
            info!("shutting down");
        })
        .await?;
    Ok(())
}
