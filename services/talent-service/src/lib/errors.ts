import type { NextFunction, Request, Response } from 'express';
import { getCorrelationId } from '@talent-ai/logger';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: unknown; expose?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? status < 500;
  }
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
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

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

function isMongoValidationError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'ValidationError'
  );
}

function isMongoCastError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'CastError'
  );
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
    if (error.status >= 500) {
      logger.error({ err: error, method: req.method, path: req.originalUrl }, 'request failed');
    }
    sendError(res, error.status, error.code, error.message, error.details);
    return;
  }

  if (error instanceof ZodError) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Request validation failed', error.flatten());
    return;
  }

  if (
    error instanceof SyntaxError &&
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: number }).status === 400
  ) {
    sendError(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
    return;
  }

  if (isMongoDuplicateKey(error)) {
    sendError(res, 409, 'CONFLICT', 'A profile with these values already exists');
    return;
  }

  if (isMongoValidationError(error)) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Profile validation failed', {
      message: (error as Error).message,
    });
    return;
  }

  if (isMongoCastError(error)) {
    sendError(res, 400, 'INVALID_IDENTIFIER', 'The supplied identifier is not valid');
    return;
  }

  logger.error(
    { err: error, method: req.method, path: req.originalUrl },
    'unhandled request error',
  );
  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
