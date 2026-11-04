import type { Request, RequestHandler, Response } from 'express';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

export interface HttpMetrics {
  registry: Registry;
  /** Records request counts, durations and in-flight requests. */
  middleware: RequestHandler;
  /** Prometheus scrape handler. Mount on `/metrics`. */
  handler: RequestHandler;
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
 * Creates an isolated Prometheus registry and HTTP instrumentation for one
 * service process.
 */
export function createHttpMetrics(serviceName: string): HttpMetrics {
  const registry = new Registry();
  registry.setDefaultLabels({ service: serviceName });

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

  return { registry, middleware, handler };
}
