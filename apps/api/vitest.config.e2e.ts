import { defineConfig } from 'vitest/config';

// End-to-end tests need the PostgreSQL and Redis services from DATABASE_URL / REDIS_URL.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
  },
});
