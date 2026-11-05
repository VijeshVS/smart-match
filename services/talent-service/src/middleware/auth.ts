import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { USER_ROLES, type Permission, type UserRole } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { AppError, sendError } from '../lib/errors.js';

export interface TalentPrincipal {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  sessionId?: string;
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

function headerValue(req: Request, name: string): string | undefined {
  const value = req.header(name);
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Identity injected by the API Gateway after it verifies the access token.
 * Client-supplied copies are stripped at the edge.
 */
function principalFromGatewayHeaders(req: Request): TalentPrincipal | undefined {
  const userId = headerValue(req, 'x-user-id');
  const email = headerValue(req, 'x-user-email');
  const role = headerValue(req, 'x-user-role');

  if (!userId || !email || !isUserRole(role)) return undefined;

  return {
    userId,
    email,
    role,
    permissions: [],
    ...(headerValue(req, 'x-session-id') ? { sessionId: headerValue(req, 'x-session-id') } : {}),
  };
}

function extractBearerToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (!header) return undefined;

  const [scheme, token] = header.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') return undefined;
  return token.trim();
}

/**
 * Verifies a bearer token directly. This keeps the service usable in local
 * development without the gateway while still rejecting forged identities.
 */
function principalFromBearerToken(token: string): TalentPrincipal {
  let payload: JwtPayload;

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    if (typeof decoded === 'string') {
      throw new AppError(401, 'AUTH_TOKEN_INVALID', 'Token payload is invalid');
    }
    payload = decoded;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'AUTH_TOKEN_EXPIRED', 'Access token has expired');
    }
    throw new AppError(401, 'AUTH_TOKEN_INVALID', 'Access token is invalid');
  }

  if (
    payload.type !== 'access' ||
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    !isUserRole(payload.role)
  ) {
    throw new AppError(401, 'AUTH_TOKEN_INVALID', 'Access token payload is incomplete');
  }

  const permissions = Array.isArray(payload.permissions)
    ? payload.permissions.filter((item): item is Permission => typeof item === 'string')
    : [];

  return {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
    permissions,
    ...(typeof payload.sessionId === 'string' ? { sessionId: payload.sessionId } : {}),
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const gatewayPrincipal = config.trustGatewayHeaders
    ? principalFromGatewayHeaders(req)
    : undefined;

  if (gatewayPrincipal) {
    req.auth = gatewayPrincipal;
    next();
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    sendError(res, 401, 'AUTH_TOKEN_MISSING', 'An Authorization: Bearer token is required');
    return;
  }

  try {
    req.auth = principalFromBearerToken(token);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      sendError(res, error.status, error.code, error.message);
      return;
    }
    sendError(res, 401, 'AUTH_TOKEN_INVALID', 'Access token is invalid');
  }
}

/** Restricts a route to the supplied roles. Must run after `requireAuth`. */
export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      sendError(res, 401, 'AUTH_TOKEN_MISSING', 'Authentication is required');
      return;
    }

    if (!roles.includes(req.auth.role)) {
      sendError(res, 403, 'FORBIDDEN', 'You do not have access to this resource', {
        requiredRoles: roles,
      });
      return;
    }

    next();
  };
}

export function isOwnerOrAdmin(principal: TalentPrincipal, userId: string): boolean {
  return principal.role === 'ADMIN' || principal.userId === userId;
}
