use anyhow::{Context, Result, bail};

/// Everything the gateway reads from the environment. It refuses to start when
/// anything is missing or malformed, and never prints secret values.
#[derive(Clone)]
pub struct Config {
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    /// Browser origins allowed to connect (the same list as the API's).
    pub cors_origins: Vec<String>,
    /// Redis key prefix and channel namespace, e.g. "vyra" or "vyra-test".
    pub namespace: String,
}

fn var(name: &str) -> Result<String> {
    std::env::var(name).with_context(|| format!("{name} is required"))
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let port = std::env::var("REALTIME_PORT")
            .unwrap_or_else(|_| "4001".into())
            .parse()
            .context("REALTIME_PORT must be a port number")?;
        let jwt_secret = var("JWT_ACCESS_SECRET")?;
        if jwt_secret.len() < 32 {
            bail!("JWT_ACCESS_SECRET must be at least 32 characters");
        }
        let database_url = var("DATABASE_URL")?;
        if !database_url.starts_with("postgres") {
            bail!("DATABASE_URL must be a postgresql:// URL");
        }
        let redis_url = var("REDIS_URL")?;
        if !redis_url.starts_with("redis") {
            bail!("REDIS_URL must be a redis:// URL");
        }
        let cors_origins = std::env::var("CORS_ORIGINS")
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let namespace = if std::env::var("NODE_ENV").as_deref() == Ok("test") {
            "vyra-test".to_string()
        } else {
            std::env::var("REALTIME_NAMESPACE").unwrap_or_else(|_| "vyra".into())
        };
        Ok(Self {
            port,
            database_url,
            redis_url,
            jwt_secret,
            cors_origins,
            namespace,
        })
    }

    /// The pub/sub channel Nest publishes events on.
    pub fn channel(&self) -> String {
        format!("{}:realtime", self.namespace)
    }

    pub fn presence_key(&self, user_id: &str) -> String {
        format!("{}:presence:{user_id}", self.namespace)
    }
}
