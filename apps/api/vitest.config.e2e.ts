import { defineConfig } from 'vitest/config';

// End-to-end tests need the PostgreSQL and Redis services from DATABASE_URL / REDIS_URL.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    // Builds and runs the Rust realtime gateway (crates/vyra-realtime).
    globalSetup: ['./test/support/realtime-gateway.ts'],
    // Deterministic photo moderation: approves unless a test says otherwise.
    // The real classifier is exercised by src/modules/moderation/*.spec.ts.
    env: { PHOTO_MODERATION_PROVIDER: 'mock' },
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
