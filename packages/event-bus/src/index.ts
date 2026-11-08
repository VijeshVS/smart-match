import { randomUUID } from 'node:crypto';
import { connect, type Channel, type ChannelModel, type ConfirmChannel, type ConsumeMessage, type Options } from 'amqplib';
import { createLogger, getCorrelationId, type Logger } from '@talent-ai/logger';
import {
  EVENT_TOPOLOGY,
  EVENT_VERSION,
  type DomainEvent,
  type EventDataMap,
  type EventType,
  type PublishOptions,
} from '@talent-ai/shared-types';

export interface ReconnectOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
  /** Use Infinity (default) to retry forever. */
  maxRetries?: number;
}

export type EventConsumerOutcome = 'success' | 'failure' | 'invalid';

/**
 * Optional observability hooks. Implementations live in each service so the
 * event-bus package stays free of a Prometheus dependency.
 */
export interface EventBusMetricsHooks {
  onPublish?: (eventType: EventType) => void;
  onConsume?: (eventType: string, outcome: EventConsumerOutcome, durationSeconds: number) => void;
}

export interface EventBusOptions {
  /** AMQP connection URL, e.g. `amqp://guest:guest@localhost:5672`. */
  url: string;
  serviceName: string;
  exchange?: string;
  deadLetterExchange?: string;
  deadLetterQueue?: string;
  deadLetterRoutingKey?: string;
  /** Default consumer prefetch. */
  prefetch?: number;
  logger?: Logger;
  reconnect?: ReconnectOptions;
  metrics?: EventBusMetricsHooks;
}

export interface SubscribeOptions<T = unknown> {
  queue: string;
  routingKeys: readonly (EventType | string)[];
  handler: (event: DomainEvent<T>, raw: ConsumeMessage) => Promise<void> | void;
  prefetch?: number;
  durable?: boolean;
  /** Extra queue arguments, e.g. `x-message-ttl`. */
  arguments?: Record<string, unknown>;
}

interface RegisteredConsumer {
  options: SubscribeOptions<unknown>;
  consumerTag?: string;
}

const DEFAULT_RECONNECT: Required<ReconnectOptions> = {
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
  maxRetries: Number.POSITIVE_INFINITY,
};

/**
 * Builds a CloudEvents-inspired envelope for a domain event.
 *
 * The correlation id is taken from (in priority order):
 *  1. the explicit `PublishOptions.correlationId`
 *  2. the AsyncLocalStorage context populated by the HTTP middleware
 *  3. a freshly generated UUID
 */
export function createDomainEvent<K extends EventType>(
  eventType: K,
  aggregateId: string,
  data: EventDataMap[K],
  options: PublishOptions = {},
): DomainEvent<EventDataMap[K]> {
  return {
    eventId: randomUUID(),
    eventType,
    aggregateId,
    timestamp: new Date().toISOString(),
    correlationId: options.correlationId ?? getCorrelationId() ?? randomUUID(),
    version: options.version ?? EVENT_VERSION,
    data,
  };
}

export function parseDomainEvent<T>(message: ConsumeMessage): DomainEvent<T> {
  const parsed: unknown = JSON.parse(message.content.toString('utf8'));
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as DomainEvent<T>).eventType !== 'string' ||
    typeof (parsed as DomainEvent<T>).eventId !== 'string' ||
    typeof (parsed as DomainEvent<T>).aggregateId !== 'string'
  ) {
    throw new Error('Invalid domain event envelope');
  }
  return parsed as DomainEvent<T>;
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '<invalid-amqp-url>';
  }
}

/**
 * Resilient RabbitMQ event bus.
 *
 * - Publisher confirms for at-least-once delivery
 * - Topic exchange `talent.events.topic`
 * - Dead-letter exchange + queue for poison messages
 * - Automatic reconnect with exponential backoff
 * - Consumer re-registration after reconnect
 */
export class EventBus {
  private readonly url: string;
  private readonly serviceName: string;
  private readonly exchange: string;
  private readonly deadLetterExchange: string;
  private readonly deadLetterQueue: string;
  private readonly deadLetterRoutingKey: string;
  private readonly prefetch: number;
  private readonly reconnect: Required<ReconnectOptions>;
  private readonly logger: Logger;
  private readonly metrics?: EventBusMetricsHooks;

  private connection?: ChannelModel;
  private publishChannel?: ConfirmChannel;
  private consumeChannel?: Channel;
  private readonly consumers = new Map<string, RegisteredConsumer>();

  private closing = false;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private connectPromise?: Promise<void>;

  constructor(options: EventBusOptions) {
    this.url = options.url;
    this.serviceName = options.serviceName;
    this.exchange = options.exchange ?? EVENT_TOPOLOGY.exchange;
    this.deadLetterExchange = options.deadLetterExchange ?? EVENT_TOPOLOGY.deadLetterExchange;
    this.deadLetterQueue = options.deadLetterQueue ?? EVENT_TOPOLOGY.deadLetterQueue;
    this.deadLetterRoutingKey =
      options.deadLetterRoutingKey ?? EVENT_TOPOLOGY.deadLetterRoutingKey;
    this.prefetch = options.prefetch ?? 10;
    this.reconnect = { ...DEFAULT_RECONNECT, ...options.reconnect };
    this.logger = options.logger ?? createLogger({ serviceName: options.serviceName });
    this.metrics = options.metrics;
  }

  /** Metrics must never break message delivery, so hook errors are swallowed. */
  private recordMetric(operation: () => void): void {
    try {
      operation();
    } catch {
      // Intentionally ignored.
    }
  }

  get isConnected(): boolean {
    return Boolean(this.connection && this.publishChannel);
  }

  async connect(): Promise<void> {
    if (this.closing) {
      throw new Error('EventBus has been closed');
    }
    if (this.isConnected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.doConnect().finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  private async doConnect(): Promise<void> {
    this.logger.info({ broker: redactUrl(this.url) }, 'connecting to RabbitMQ');

    const connection = await connect(this.url);

    try {
      connection.on('error', (error) => {
        this.logger.error({ err: error }, 'RabbitMQ connection error');
      });
      connection.on('close', () => {
        if (this.connection === connection) {
          this.handleDisconnect('connection closed');
        }
      });

      const publishChannel = await connection.createConfirmChannel();
      publishChannel.on('error', (error) => {
        this.logger.error({ err: error }, 'RabbitMQ publish channel error');
      });
      publishChannel.on('close', () => {
        if (this.connection === connection) {
          this.handleDisconnect('publish channel closed');
        }
      });

      await this.assertTopology(publishChannel);

      const consumeChannel = await connection.createChannel();
      consumeChannel.on('error', (error) => {
        this.logger.error({ err: error }, 'RabbitMQ consume channel error');
      });
      await consumeChannel.prefetch(this.prefetch);

      this.connection = connection;
      this.publishChannel = publishChannel;
      this.consumeChannel = consumeChannel;
      this.reconnectAttempts = 0;

      await this.restoreConsumers();
      this.logger.info({ exchange: this.exchange }, 'RabbitMQ connected');
    } catch (error) {
      // Never leak a half-initialised connection.
      await connection.close().catch(() => undefined);
      this.connection = undefined;
      this.publishChannel = undefined;
      this.consumeChannel = undefined;
      throw error;
    }
  }

  private async assertTopology(channel: Channel | ConfirmChannel): Promise<void> {
    await channel.assertExchange(this.exchange, 'topic', { durable: true });
    await channel.assertExchange(this.deadLetterExchange, 'direct', { durable: true });
    await channel.assertQueue(this.deadLetterQueue, { durable: true });
    await channel.bindQueue(
      this.deadLetterQueue,
      this.deadLetterExchange,
      this.deadLetterRoutingKey,
    );
  }

  /**
   * Publishes a typed domain event and waits for the broker confirm.
   */
  async publish<K extends EventType>(
    eventType: K,
    aggregateId: string,
    data: EventDataMap[K],
    options: PublishOptions = {},
  ): Promise<DomainEvent<EventDataMap[K]>> {
    await this.connect();
    const channel = this.publishChannel;
    if (!channel) {
      throw new Error('EventBus publish channel is not available');
    }

    const event = createDomainEvent(eventType, aggregateId, data, options);
    const body = Buffer.from(JSON.stringify(event), 'utf8');
    const headers: Record<string, string> = {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      correlationId: event.correlationId,
      version: event.version,
    };
    if (options.traceparent) headers.traceparent = options.traceparent;

    const publishOptions: Options.Publish = {
      persistent: true,
      contentType: 'application/json',
      contentEncoding: 'utf-8',
      messageId: event.eventId,
      timestamp: Date.now(),
      type: event.eventType,
      appId: this.serviceName,
      correlationId: event.correlationId,
      headers,
    };

    await new Promise<void>((resolve, reject) => {
      channel.publish(this.exchange, eventType, body, publishOptions, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    this.recordMetric(() => this.metrics?.onPublish?.(eventType));

    this.logger.debug(
      { eventId: event.eventId, eventType, aggregateId, correlationId: event.correlationId },
      'domain event published',
    );
    return event;
  }

  /**
   * Registers a durable consumer. Safe to call before or after `connect()`.
   */
  async subscribe<T = unknown>(options: SubscribeOptions<T>): Promise<this> {
    this.consumers.set(options.queue, {
      options: options as unknown as SubscribeOptions<unknown>,
    });

    if (this.consumeChannel) {
      await this.startConsumer(options as unknown as SubscribeOptions<unknown>);
    }
    return this;
  }

  private async startConsumer(consumer: SubscribeOptions<unknown>): Promise<void> {
    const channel = this.consumeChannel;
    if (!channel) return;

    const queueArguments: Record<string, unknown> = {
      'x-dead-letter-exchange': this.deadLetterExchange,
      'x-dead-letter-routing-key': this.deadLetterRoutingKey,
      ...consumer.arguments,
    };

    await channel.assertQueue(consumer.queue, {
      durable: consumer.durable ?? true,
      arguments: queueArguments,
    });

    for (const routingKey of consumer.routingKeys) {
      await channel.bindQueue(consumer.queue, this.exchange, routingKey);
    }

    if (consumer.prefetch) {
      await channel.prefetch(consumer.prefetch);
    }

    const { consumerTag } = await channel.consume(
      consumer.queue,
      (message) => {
        void this.handleMessage(consumer, message);
      },
      { noAck: false },
    );

    const registered = this.consumers.get(consumer.queue);
    if (registered) registered.consumerTag = consumerTag;

    this.logger.info(
      { queue: consumer.queue, routingKeys: consumer.routingKeys, consumerTag },
      'event consumer started',
    );
  }

  private async handleMessage(
    consumer: SubscribeOptions<unknown>,
    message: ConsumeMessage | null,
  ): Promise<void> {
    if (!message) return;
    const channel = this.consumeChannel;
    if (!channel) return;

    const startedAt = process.hrtime.bigint();
    const elapsedSeconds = (): number => Number(process.hrtime.bigint() - startedAt) / 1e9;

    let event: DomainEvent<unknown>;
    try {
      event = parseDomainEvent<unknown>(message);
    } catch (error) {
      this.logger.error(
        { err: error, queue: consumer.queue },
        'invalid event envelope; routing to dead-letter queue',
      );
      this.recordMetric(() => this.metrics?.onConsume?.('unknown', 'invalid', elapsedSeconds()));
      channel.nack(message, false, false);
      return;
    }

    try {
      await consumer.handler(event, message);
      channel.ack(message);
      this.recordMetric(() =>
        this.metrics?.onConsume?.(event.eventType, 'success', elapsedSeconds()),
      );
    } catch (error) {
      this.logger.error(
        {
          err: error,
          queue: consumer.queue,
          eventType: event.eventType,
          eventId: event.eventId,
          correlationId: event.correlationId,
        },
        'event handler failed; routing to dead-letter queue',
      );
      this.recordMetric(() =>
        this.metrics?.onConsume?.(event.eventType, 'failure', elapsedSeconds()),
      );
      channel.nack(message, false, false);
    }
  }

  private async restoreConsumers(): Promise<void> {
    for (const consumer of this.consumers.values()) {
      await this.startConsumer(consumer.options);
    }
  }

  private handleDisconnect(reason: string): void {
    if (this.closing || this.reconnectTimer) return;

    this.connection = undefined;
    this.publishChannel = undefined;
    this.consumeChannel = undefined;

    if (this.reconnectAttempts >= this.reconnect.maxRetries) {
      this.logger.fatal({ reason }, 'RabbitMQ reconnect retries exhausted');
      return;
    }

    const delay = Math.min(
      this.reconnect.initialDelayMs * 2 ** this.reconnectAttempts,
      this.reconnect.maxDelayMs,
    );
    this.reconnectAttempts += 1;

    this.logger.warn(
      { reason, delayMs: delay, attempt: this.reconnectAttempts },
      'RabbitMQ disconnected; scheduling reconnect',
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect().catch((error: unknown) => {
        this.logger.error({ err: error }, 'RabbitMQ reconnect failed');
        this.handleDisconnect('reconnect failed');
      });
    }, delay);

    // Do not keep the process alive solely to retry.
    this.reconnectTimer.unref?.();
  }

  async close(): Promise<void> {
    this.closing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    const channel = this.consumeChannel;
    if (channel) {
      for (const consumer of this.consumers.values()) {
        if (consumer.consumerTag) {
          try {
            await channel.cancel(consumer.consumerTag);
          } catch {
            // Channel may already be closed.
          }
        }
      }
    }

    await Promise.allSettled([
      this.publishChannel?.close(),
      this.consumeChannel?.close(),
      this.connection?.close(),
    ]);

    this.connection = undefined;
    this.publishChannel = undefined;
    this.consumeChannel = undefined;
    this.logger.info('RabbitMQ connection closed');
  }
}

export function createEventBus(options: EventBusOptions): EventBus {
  return new EventBus(options);
}
