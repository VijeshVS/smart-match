import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      REWARDS_DATABASE_URL:
        'postgresql://talent:talent@localhost:5432/talent_rewards?schema=public',
      JWT_ACCESS_SECRET: 'test-access-secret-change-me-32characters',
    },
  },
});
