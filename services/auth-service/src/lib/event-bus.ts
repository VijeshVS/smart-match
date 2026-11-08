import { createEventBus } from '@talent-ai/event-bus';
import { getServiceMetrics } from '@talent-ai/observability/metrics';
import { config } from '../config.js';
import { logger } from './logger.js';

const domain = getServiceMetrics(config.serviceName).domain;

export const eventBus = createEventBus({
  url: config.rabbitmq.url,
  exchange: config.rabbitmq.exchange,
  serviceName: config.serviceName,
  logger,
  metrics: {
    onPublish(eventType) {
      domain.eventsPublished.inc({ event_type: eventType });
    },
    onConsume(eventType, outcome, durationSeconds) {
      domain.eventsConsumed.inc({ event_type: eventType, outcome });
      domain.eventProcessingDuration.observe({ event_type: eventType, outcome }, durationSeconds);
    },
  },
});
