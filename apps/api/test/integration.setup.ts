
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },

  test: {
    globals: true,
    root: './',
    include: ['**/*.integration-spec.ts'],
    fileParallelism: false,
    setupFiles: ['./test/integration.setup.ts'],
  },
});
