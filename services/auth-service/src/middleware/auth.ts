import type { NextFunction, Request, Response } from 'express';
import { AppError, sendError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

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
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
      sessionId: payload.sessionId,
    };
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
 * Attaches the principal when a valid bearer token is present, but never blocks
 * the request. Used by login/register so a stale browser token cannot prevent
 * re-authentication.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
      sessionId: payload.sessionId,
    };
  } catch {
    // Ignore invalid tokens on public auth endpoints.
  }
  next();
}

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export function requestContext(req: Request): RequestContext {
  return {
    ip: req.ip || req.socket.remoteAddress || undefined,
    userAgent: req.get('user-agent') ?? undefined,
  };
}
