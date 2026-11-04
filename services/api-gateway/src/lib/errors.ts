import type { NextFunction, Request, Response } from 'express';
import { getCorrelationId } from '@talent-ai/logger';
import { logger } from './logger.js';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  if (res.headersSent) return;

  const correlationId = getCorrelationId() ?? res.getHeader('x-correlation-id');
  res.status(status).json({
    status,
    error: {
      code,
      message,
      ...(correlationId ? { correlationId: String(correlationId) } : {}),
      ...(details !== undefined ? { details } : {}),
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} was not found`);
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    sendError(res, error.status, error.code, error.message, error.details);
    return;
  }

  logger.error(
    { err: error, method: req.method, path: req.originalUrl },
    'unhandled gateway error',
  );
  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}
