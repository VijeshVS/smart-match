import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      NOTIFICATION_MONGODB_URI: 'mongodb://localhost:27017/talent_notif?directConnection=true',
      NOTIFICATION_MONGODB_DB: 'talent_notif',
      RABBITMQ_URL: 'amqp://talent:talent@localhost:5672',
      JWT_ACCESS_SECRET: 'test-access-secret-change-me-32characters',
      EMAIL_ENABLED: 'false',
    },
  },
});
