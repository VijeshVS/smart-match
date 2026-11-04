import type { NextFunction, Request, Response } from 'express';
import { AppError, sendError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';

function extractBearerToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (!header) return undefined;

  const [scheme, token] = header.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') return undefined;
  return token.trim();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    sendError(res, 401, 'AUTH_TOKEN_MISSING', 'An Authorization: Bearer token is required');
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      sendError(res, error.status, error.code, error.message);
      return;
    }
    sendError(res, 401, 'AUTH_TOKEN_INVALID', 'Access token is invalid');
  }
}

/**
 * Best-effort principal extraction for public auth endpoints. Invalid tokens
 * are ignored so that login/register still work with a stale browser token.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
  } catch {
    // Public route — continue without identity headers.
  }
  next();
}
