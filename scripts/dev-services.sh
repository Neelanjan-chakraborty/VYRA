#!/usr/bin/env bash
# Starts the PostgreSQL and Redis services installed in the cloud dev container.
# On a workstation, use `docker compose -f infrastructure/docker/compose.yaml up -d` instead.
set -euo pipefail
service postgresql start
service redis-server start
pg_isready -h localhost -p 5432
redis-cli ping
