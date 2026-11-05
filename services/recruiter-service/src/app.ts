import cors, { type CorsOptions } from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createHttpMetrics } from '@talent-ai/observability/metrics';
import { correlationMiddleware } from '@talent-ai/logger';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { healthRouter } from './routes/health.routes.js';
import { recruiterRouter } from './routes/recruiter.routes.js';

export function createApp(): express.Express {
  const app = express();
  const metrics = createHttpMetrics(config.serviceName);

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ? 1 : false);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'X-Request-ID',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    exposedHeaders: ['X-Correlation-ID'],
    maxAge: 86_400,
  };
  app.use(cors(corsOptions));

  app.use(correlationMiddleware);

  // Scrapes are intentionally excluded from HTTP request metrics.
  app.get('/metrics', metrics.handler);
  app.use(metrics.middleware);

  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      logger.info(
        {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
          userId: req.auth?.userId,
        },
        'http request',
      );
    });
    next();
  });

  app.use(express.json({ limit: '200kb' }));

  app.use('/health', healthRouter);
  app.use('/api/v1/recruiters', recruiterRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
