# Build from the repository root:
#   docker build -f crates/vyra-realtime/Dockerfile -t vyra-realtime .
FROM rust:1.97-slim AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN cargo build --release -p vyra-realtime

FROM debian:trixie-slim
RUN useradd --system --uid 10001 vyra
COPY --from=build /src/target/release/vyra-realtime /usr/local/bin/vyra-realtime
USER vyra
EXPOSE 4001
ENV REALTIME_PORT=4001
# DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET and CORS_ORIGINS come from the environment.
ENTRYPOINT ["/usr/local/bin/vyra-realtime"]
