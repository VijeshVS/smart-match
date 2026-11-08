import type { Request, RequestHandler, Response } from 'express';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

/**
 * Domain, event and business metrics shared by every service.
 *
 * Labels deliberately stay low-cardinality: event types are a closed union in
 * `@talent-ai/shared-types`, provider/circuit names are small enumerations and
 * cache names are the AI feature namespaces. The `service` label is injected
 * by the registry's default labels.
 */
export interface DomainMetrics {
  /** Domain events accepted by RabbitMQ (publisher confirms). */
  eventsPublished: Counter<string>;
  /** Domain events consumed, labelled by outcome (`success`/`failure`). */
  eventsConsumed: Counter<string>;
  /** Consumer handler duration. */
  eventProcessingDuration: Histogram<string>;
  /** Persisted in-app notifications. */
  notificationsCreated: Counter<string>;
  /** Email delivery attempts by terminal status. */
  notificationEmails: Counter<string>;
  /** Immutable ledger rows written by the rewards service. */
  ledgerTransactions: Counter<string>;
  /** Rewards saga outcomes (review credit, Tier-3 unlock). */
  rewardsSaga: Counter<string>;
  /** Events applied to analytics read models. */
  analyticsEventsProcessed: Counter<string>;
  /** Event timestamp → analytics projection write latency. */
  analyticsProjectionLag: Histogram<string>;
  /** LLM/provider calls by provider and outcome. */
  aiProviderRequests: Counter<string>;
  /** LLM/provider call duration. */
  aiProviderDuration: Histogram<string>;
  /** Response-cache lookups by feature namespace and hit/miss. */
  aiCacheRequests: Counter<string>;
  /** Circuit breaker state: 0 = closed, 1 = half-open, 2 = open. */
  aiCircuitState: Gauge<string>;
  /** TalentLens searches by outcome (`success`/`empty`/`error`). */
  aiTalentLensSearches: Counter<string>;
}

export interface HttpMetrics {
  registry: Registry;
  /** Records request counts, durations and in-flight requests. */
  middleware: RequestHandler;
  /** Prometheus scrape handler. Mount on `/metrics`. */
  handler: RequestHandler;
}

export interface ServiceMetrics extends HttpMetrics {
  domain: DomainMetrics;
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_ID_PATTERN = /\/\d+(?=\/|$)/g;

/**
 * Keeps metric labels low-cardinality by replacing identifiers with `:id`.
 */
export function normalizeRoute(req: Request): string {
  const routePath = req.route?.path;
  if (typeof routePath === 'string') {
    return `${req.baseUrl ?? ''}${routePath}` || '/';
  }

  const path = (req.originalUrl ?? req.url ?? '/').split('?')[0] ?? '/';
  const normalized = path
    .replace(UUID_PATTERN, ':id')
    .replace(NUMERIC_ID_PATTERN, '/:id')
    .replace(/\/{2,}/g, '/');

  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

/**
 * Registers every shared domain metric on the supplied registry. A service
 * should call this once; `createHttpMetrics` already does it.
 */
export function createDomainMetrics(registry: Registry): DomainMetrics {
  return {
    eventsPublished: new Counter({
      name: 'talent_domain_events_published_total',
      help: 'Domain events published to RabbitMQ with a broker confirm.',
      labelNames: ['event_type'],
      registers: [registry],
    }),
    eventsConsumed: new Counter({
      name: 'talent_domain_events_consumed_total',
      help: 'Domain events handled by a consumer, labelled by outcome.',
      labelNames: ['event_type', 'outcome'],
      registers: [registry],
    }),
    eventProcessingDuration: new Histogram({
      name: 'talent_domain_event_processing_seconds',
      help: 'Time spent handling one domain event.',
      labelNames: ['event_type', 'outcome'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    }),
    notificationsCreated: new Counter({
      name: 'talent_notifications_created_total',
      help: 'In-app notifications persisted by the notification service.',
      labelNames: ['type', 'delivery_status'],
      registers: [registry],
    }),
    notificationEmails: new Counter({
      name: 'talent_notification_email_total',
      help: 'Notification email delivery attempts by terminal status.',
      labelNames: ['status'],
      registers: [registry],
    }),
    ledgerTransactions: new Counter({
      name: 'talent_rewards_ledger_transactions_total',
      help: 'TalentCredits ledger transactions written by type.',
      labelNames: ['type'],
      registers: [registry],
    }),
    rewardsSaga: new Counter({
      name: 'talent_rewards_saga_total',
      help: 'Rewards saga outcomes (review credit, Tier-3 unlock).',
      labelNames: ['saga', 'outcome'],
      registers: [registry],
    }),
    analyticsEventsProcessed: new Counter({
      name: 'talent_analytics_events_processed_total',
      help: 'Domain events applied exactly once to analytics read models.',
      labelNames: ['event_type'],
      registers: [registry],
    }),
    analyticsProjectionLag: new Histogram({
      name: 'talent_analytics_projection_lag_seconds',
      help: 'Event timestamp to analytics projection write latency.',
      labelNames: ['event_type'],
      buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 300, 900],
      registers: [registry],
    }),
    aiProviderRequests: new Counter({
      name: 'talent_ai_provider_requests_total',
      help: 'LLM provider calls by provider and outcome.',
      labelNames: ['provider', 'outcome'],
      registers: [registry],
    }),
    aiProviderDuration: new Histogram({
      name: 'talent_ai_provider_request_duration_seconds',
      help: 'LLM provider call duration.',
      labelNames: ['provider', 'outcome'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 30],
      registers: [registry],
    }),
    aiCacheRequests: new Counter({
      name: 'talent_ai_cache_requests_total',
      help: 'AI response-cache lookups by namespace and result.',
      labelNames: ['cache', 'result'],
      registers: [registry],
    }),
    aiCircuitState: new Gauge({
      name: 'talent_ai_circuit_breaker_state',
      help: 'Circuit breaker state (0 = closed, 1 = half-open, 2 = open).',
      labelNames: ['breaker'],
      registers: [registry],
    }),
    aiTalentLensSearches: new Counter({
      name: 'talent_ai_talent_lens_searches_total',
      help: 'TalentLens searches by outcome.',
      labelNames: ['outcome'],
      registers: [registry],
    }),
  };
}

const serviceMetrics = new Map<string, ServiceMetrics>();

function buildServiceMetrics(serviceName: string): ServiceMetrics {
  const registry = new Registry();
  registry.setDefaultLabels({
    service: serviceName,
    env: process.env.NODE_ENV ?? 'development',
  });

  collectDefaultMetrics({ register: registry, prefix: 'talent_' });

  const requestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests handled by the service.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [registry],
  });

  const requestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const inFlight = new Gauge({
    name: 'http_requests_in_flight',
    help: 'HTTP requests currently being processed.',
    labelNames: ['method'],
    registers: [registry],
  });

  const middleware: RequestHandler = (req, res, next) => {
    const method = req.method;
    const startedAt = process.hrtime.bigint();
    inFlight.inc({ method });

    let recorded = false;
    const record = (): void => {
      if (recorded) return;
      recorded = true;

      const route = normalizeRoute(req);
      const statusCode = String(res.statusCode);
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;

      inFlight.dec({ method });
      requestsTotal.inc({ method, route, status_code: statusCode });
      requestDuration.observe({ method, route, status_code: statusCode }, durationSeconds);
    };

    res.once('finish', record);
    res.once('close', record);
    next();
  };

  const handler: RequestHandler = (_req: Request, res: Response) => {
    void registry
      .metrics()
      .then((body) => {
        res.setHeader('Content-Type', registry.contentType);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(body);
      })
      .catch((error: unknown) => {
        res.status(500).json({
          status: 500,
          error: {
            code: 'METRICS_UNAVAILABLE',
            message: 'Metrics could not be collected',
            details: String(error),
          },
        });
      });
  };

  const metrics: ServiceMetrics = {
    registry,
    middleware,
    handler,
    domain: createDomainMetrics(registry),
  };

  serviceMetrics.set(serviceName, metrics);
  return metrics;
}

/**
 * Returns the process-wide metrics for one service, creating the registry on
 * first use. Event-bus wrappers and library code can therefore share the same
 * registry that `createHttpMetrics` exposes on `/metrics`.
 */
export function getServiceMetrics(serviceName: string): ServiceMetrics {
  return serviceMetrics.get(serviceName) ?? buildServiceMetrics(serviceName);
}

/**
 * Creates (or returns) the isolated Prometheus registry and HTTP
 * instrumentation for one service process.
 */
export function createHttpMetrics(serviceName: string): ServiceMetrics {
  return getServiceMetrics(serviceName);
}
