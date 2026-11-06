import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },

  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],

    env: {
      JWT_ACCESS_EXPIRES_IN: '15m',
    },
  },
});
