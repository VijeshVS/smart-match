import { randomUUID } from 'node:crypto';
import { ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import type { Request, RequestHandler, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { context as otelContext, propagation } from '@opentelemetry/api';
import { getCorrelationId } from '@talent-ai/logger';
import { API_PREFIXES, INTERNAL_HEADERS } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { CircuitBreaker } from '../lib/circuit-breaker.js';
import { sendError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { createRateLimiter, type RateLimitBucket } from '../middleware/rate-limit.js';

type AuthMode = 'required' | 'optional';
type KeyMode = 'user' | 'ip';

interface RouteSpec {
  name: string;
  prefix: string;
  target: string;
  auth: AuthMode;
  bucket: RateLimitBucket;
  keyBy: KeyMode;
}

interface CompiledRoute {
  name: string;
  prefix: string;
  breaker: CircuitBreaker;
  authGuard: RequestHandler;
  rateLimiter: RequestHandler;
  circuitGuard: RequestHandler;
}

const ROUTE_SPECS: RouteSpec[] = [
  {
    name: 'auth-service',
    prefix: API_PREFIXES.auth,
    target: config.services.auth,
    auth: 'optional',
    bucket: 'sensitive',
    keyBy: 'ip',
  },
  {
    name: 'ai-matching-service',
    prefix: API_PREFIXES.ai,
    target: config.services.ai,
    auth: 'required',
    bucket: 'sensitive',
    keyBy: 'user',
  },
  {
    name: 'talent-service',
    prefix: API_PREFIXES.talent,
    target: config.services.talent,
    auth: 'required',
    bucket: 'general',
    keyBy: 'user',
  },
  {
    name: 'recruiter-service',
    prefix: API_PREFIXES.recruiters,
    target: config.services.recruiter,
    auth: 'required',
    bucket: 'general',
    keyBy: 'user',
  },
  {
    name: 'engagement-service',
    prefix: API_PREFIXES.engagement,
    target: config.services.engagement,
    auth: 'required',
    bucket: 'general',
    keyBy: 'user',
  },
  {
    name: 'rewards-service',
    prefix: API_PREFIXES.rewards,
    target: config.services.rewards,
    auth: 'required',
    bucket: 'general',
    keyBy: 'user',
  },
  {
    name: 'notification-service',
    prefix: API_PREFIXES.notifications,
    target: config.services.notification,
    auth: 'required',
    bucket: 'general',
    keyBy: 'user',
  },
  {
    name: 'analytics-service',
    prefix: API_PREFIXES.analytics,
    target: config.services.analytics,
    auth: 'required',
    bucket: 'general',
    keyBy: 'user',
  },
];

const DOWNSTREAM_CORS_HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-expose-headers',
  'access-control-max-age',
];

const IDENTITY_HEADERS = [
  INTERNAL_HEADERS.userId,
  INTERNAL_HEADERS.userRole,
  INTERNAL_HEADERS.userEmail,
  'x-session-id',
];

function prepareDownstreamHeaders(req: Request): void {
  // Never trust identity headers supplied by a client.
  for (const header of [...IDENTITY_HEADERS, INTERNAL_HEADERS.requestId]) {
    delete req.headers[header];
  }

  const correlationId = getCorrelationId() ?? randomUUID();
  delete req.headers[INTERNAL_HEADERS.correlationId];
  req.headers[INTERNAL_HEADERS.correlationId] = correlationId;
  req.headers[INTERNAL_HEADERS.requestId] = correlationId;

  // Propagate the W3C trace context to the downstream service. Incoming
  // traceparent values are replaced by the active span when tracing is on.
  delete req.headers.traceparent;
  propagation.inject(otelContext.active(), req.headers as Record<string, unknown>);

  if (req.auth) {
    req.headers[INTERNAL_HEADERS.userId] = req.auth.userId;
    req.headers[INTERNAL_HEADERS.userRole] = req.auth.role;
    req.headers[INTERNAL_HEADERS.userEmail] = req.auth.email;
    req.headers['x-session-id'] = req.auth.sessionId;
  }
}

function writeProxyError(error: Error, res: ServerResponse | Socket, serviceName: string): void {
  const code = (error as NodeJS.ErrnoException).code;
  const timedOut =
    code === 'ETIMEDOUT' ||
    code === 'ESOCKETTIMEDOUT' ||
    code === 'ECONNRESET' ||
    /timeout/i.test(error.message);

  const status = timedOut ? 504 : 502;
  const errorCode = timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE';
  const correlationId = getCorrelationId() ?? randomUUID();

  logger.error(
    {
      err: error,
      serviceName,
      status,
      correlationId,
    },
    'downstream proxy request failed',
  );

  if (res instanceof ServerResponse) {
    if (res.headersSent) {
      res.destroy();
      return;
    }

    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('x-correlation-id', correlationId);
    res.end(
      JSON.stringify({
        status,
        error: {
          code: errorCode,
          message: `The ${serviceName} is currently unavailable`,
          correlationId,
        },
      }),
    );
    return;
  }

  if ('destroy' in res) res.destroy();
}

function compileRoute(spec: RouteSpec): CompiledRoute {
  const breaker = new CircuitBreaker({
    name: spec.name,
    failureThreshold: config.proxy.failureThreshold,
    resetTimeoutMs: config.proxy.resetTimeoutMs,
  });

  const proxy = createProxyMiddleware({
    target: spec.target,
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: config.proxy.timeoutMs,
    timeout: config.proxy.timeoutMs,
    on: {
      proxyReq(proxyReq) {
        const correlationId = getCorrelationId();
        if (correlationId) {
          proxyReq.setHeader(INTERNAL_HEADERS.correlationId, correlationId);
          proxyReq.setHeader(INTERNAL_HEADERS.requestId, correlationId);
        }
      },
      proxyRes(proxyRes) {
        // The gateway owns the CORS contract; drop duplicate downstream headers.
        for (const header of DOWNSTREAM_CORS_HEADERS) {
          delete proxyRes.headers[header];
        }

        if ((proxyRes.statusCode ?? 500) >= 500) {
          breaker.recordFailure();
        } else {
          breaker.recordSuccess();
        }
      },
      error(error, _req, res) {
        breaker.recordFailure();
        writeProxyError(error, res, spec.name);
      },
    },
  }) as unknown as RequestHandler;

  const authGuard = spec.auth === 'required' ? requireAuth : optionalAuth;
  const rateLimiter = createRateLimiter({
    bucket: spec.bucket,
    limitPerMinute:
      spec.bucket === 'sensitive'
        ? config.rateLimit.sensitivePerMinute
        : config.rateLimit.generalPerMinute,
    failOpen: config.rateLimit.failOpen,
    keyResolver: (req) =>
      spec.keyBy === 'user' ? (req.auth?.userId ?? `ip:${req.ip}`) : `ip:${req.ip}`,
  });

  const circuitGuard: RequestHandler = (req, res, next) => {
    if (!breaker.canRequest()) {
      const retryAfterSeconds = Math.max(1, Math.ceil(breaker.remainingCooldownMs() / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      sendError(res, 503, 'CIRCUIT_OPEN', `${spec.name} is temporarily unavailable`, {
        retryAfterSeconds,
        service: spec.name,
      });
      return;
    }

    prepareDownstreamHeaders(req);
    proxy(req, res, next);
  };

  return { name: spec.name, prefix: spec.prefix, breaker, authGuard, rateLimiter, circuitGuard };
}

const compiledRoutes = ROUTE_SPECS.map(compileRoute);

export const circuitBreakers = compiledRoutes.map((route) => route.breaker);

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function runRoute(
  route: CompiledRoute,
  req: Request,
  res: Response,
  next: (error?: unknown) => void,
): void {
  route.authGuard(req, res, (authError?: unknown) => {
    if (authError) {
      next(authError);
      return;
    }

    route.rateLimiter(req, res, (rateError?: unknown) => {
      if (rateError) {
        next(rateError);
        return;
      }
      route.circuitGuard(req, res, next);
    });
  });
}

/**
 * Single root-level dispatcher. Keep the proxy mounted at "/" so Express does
 * not strip the `/api/v1/...` prefix before forwarding to the downstream.
 */
export function createProxyDispatcher(): RequestHandler {
  return (req, res, next) => {
    const route = compiledRoutes.find((candidate) => matchesPrefix(req.path, candidate.prefix));

    if (!route) {
      next();
      return;
    }

    runRoute(route, req, res, next);
  };
}
