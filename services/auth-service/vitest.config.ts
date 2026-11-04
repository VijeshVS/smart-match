import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://talent:talent@localhost:5432/talent_auth',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'test-access-secret-change-me-32characters',
      JWT_REFRESH_SECRET: 'test-refresh-secret-change-me-32characters',
    },
  },
});
