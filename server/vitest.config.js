import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./src/tests/setup.js'],
    // One in-memory MongoDB per file would be slow and memory-hungry, so the
    // suite shares a single server and clears collections between tests.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30000,
    hookTimeout: 120000,
    include: ['src/tests/**/*.test.js'],
  },
});
