import { createHash, randomUUID } from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import type { AuthClaims, Permission, UserRole } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { AppError } from './errors.js';

export interface AccessTokenPayload extends AuthClaims {
  type: 'access';
  sessionId: string;
  jti: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  type: 'refresh';
  sessionId: string;
  jti: string;
}

export interface IssuedToken {
  token: string;
  jti: string;
  expiresIn: number;
  expiresAt: Date;
}

interface AccessTokenInput {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
}

interface RefreshTokenInput {
  userId: string;
  sessionId: string;
  tokenId: string;
}

const COMMON_OPTIONS: SignOptions = {
  algorithm: 'HS256',
  issuer: config.jwt.issuer,
  audience: config.jwt.audience,
};

export function signAccessToken(input: AccessTokenInput): IssuedToken {
  const jti = randomUUID();
  const expiresIn = config.jwt.accessTokenTtlSeconds;

  const token = jwt.sign(
    {
      sub: input.userId,
      email: input.email,
      role: input.role,
      permissions: input.permissions,
      sessionId: input.sessionId,
      type: 'access',
    },
    config.jwt.accessSecret,
    { ...COMMON_OPTIONS, expiresIn, jwtid: jti },
  );

  return {
    token,
    jti,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

export function signRefreshToken(input: RefreshTokenInput): IssuedToken {
  const expiresIn = config.jwt.refreshTokenTtlSeconds;

  const token = jwt.sign(
    {
      sub: input.userId,
      sessionId: input.sessionId,
      type: 'refresh',
    },
    config.jwt.refreshSecret,
    { ...COMMON_OPTIONS, expiresIn, jwtid: input.tokenId },
  );

  return {
    token,
    jti: input.tokenId,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

function verify(token: string, secret: string): JwtPayload {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    if (typeof payload === 'string') {
      throw new AppError(401, 'AUTH_TOKEN_INVALID', 'Token payload is invalid');
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'AUTH_TOKEN_EXPIRED', 'Token has expired');
    }
    throw new AppError(401, 'AUTH_TOKEN_INVALID', 'Token is invalid or has been tampered with');
  }
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = verify(token, config.jwt.accessSecret);

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

  return payload as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = verify(token, config.jwt.refreshSecret);

  if (
    payload.type !== 'refresh' ||
    typeof payload.sub !== 'string' ||
    typeof payload.sessionId !== 'string' ||
    typeof payload.jti !== 'string'
  ) {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token payload is incomplete');
  }

  return payload as RefreshTokenPayload;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
