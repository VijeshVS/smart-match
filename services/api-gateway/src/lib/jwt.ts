import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { Permission, UserRole } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { AppError } from './errors.js';

export interface GatewayPrincipal {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
  tokenId: string;
}

/**
 * Verifies an access token issued by auth-service and returns the trusted
 * principal that will be injected into downstream identity headers.
 */
export function verifyAccessToken(token: string): GatewayPrincipal {
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
    typeof payload.role !== 'string' ||
    typeof payload.sessionId !== 'string' ||
    typeof payload.jti !== 'string' ||
    !Array.isArray(payload.permissions)
  ) {
    throw new AppError(401, 'AUTH_TOKEN_INVALID', 'Access token payload is incomplete');
  }

  return {
    userId: payload.sub,
    email: payload.email,
    role: payload.role as UserRole,
    permissions: payload.permissions as Permission[],
    sessionId: payload.sessionId,
    tokenId: payload.jti,
  };
}
