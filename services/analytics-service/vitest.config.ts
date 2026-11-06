import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      ANALYTICS_DATABASE_URL:
        'postgresql://talent:talent@localhost:5432/talent_analytics?schema=public',
      RABBITMQ_URL: 'amqp://talent:talent@localhost:5672',
      JWT_ACCESS_SECRET: 'test-access-secret-change-me-32characters',
    },
  },
});
