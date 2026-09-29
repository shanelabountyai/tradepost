import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/helpers/next.ts', 'tests/helpers/geocode.ts'],
    fileParallelism: false, // one local Postgres, shared state
    hookTimeout: 20_000,
    testTimeout: 20_000,
  },
});
