import { defineConfig } from 'vitest/config';

// Pure logic only (no React Native imports). UI is covered by scripts/e2e-web.cjs.
export default defineConfig({ test: { include: ['src/**/*.spec.ts'] } });
