
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      JWT_SECRET: 'secureloginauth-e2e-only-secret-not-for-production',
      JWT_ACCESS_EXPIRES_IN: '15m',
    },
  },
});
