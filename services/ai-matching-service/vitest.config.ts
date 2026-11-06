import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      REDIS_URL: 'redis://localhost:6379',
      QDRANT_URL: 'http://localhost:6333',
      RABBITMQ_URL: 'amqp://talent:talent@localhost:5672',
      JWT_ACCESS_SECRET: 'test-access-secret-change-me-32characters',
      AI_PROVIDER: 'local',
      EMBEDDING_PROVIDER: 'local',
      EMBEDDING_DIMENSIONS: '384',
    },
  },
});
