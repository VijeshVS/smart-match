import mongoose from 'mongoose';
import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * Connects Mongoose to the notification database. Notification history and the
 * contact projections used to address events live together here.
 */
export async function connectMongo(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (error) => {
    logger.error({ err: error }, 'MongoDB connection error');
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  await mongoose.connect(config.mongo.uri, {
    dbName: config.mongo.dbName,
    maxPoolSize: config.mongo.maxPoolSize,
    serverSelectionTimeoutMS: config.mongo.serverSelectionTimeoutMs,
  });

  logger.info(
    {
      dbName: config.mongo.dbName,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
    },
    'MongoDB connected',
  );
}

export function isMongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
