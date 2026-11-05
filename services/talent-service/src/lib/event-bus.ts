import { createEventBus } from '@talent-ai/event-bus';
import { config } from '../config.js';
import { logger } from './logger.js';

export const eventBus = createEventBus({
  url: config.rabbitmq.url,
  exchange: config.rabbitmq.exchange,
  serviceName: config.serviceName,
  logger,
});
