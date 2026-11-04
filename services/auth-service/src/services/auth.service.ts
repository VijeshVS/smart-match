import { randomUUID } from 'node:crypto';
import type { User } from '@prisma/client';
import { getCorrelationId } from '@talent-ai/logger';
import type {
  AuthTokens,
  AuthUser,
  AuthUserRegisteredPayload,
  Permission,
  UserRole,
} from '@talent-ai/shared-types';
import { config } from '../config.js';
import { writeAuditLog, writeAuditLogSafe, type AuditLogInput } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { enqueueOutbox } from '../lib/outbox.js';
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from '../lib/password.js';
import { permissionsForRole } from '../lib/permissions.js';
import { prisma } from '../lib/prisma.js';
import {
  createSession,
  getSession,
  revokeAllSessions,
  revokeSession,
  touchSession,
} from '../lib/session-store.js';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../lib/tokens.js';
import type { RequestContext } from '../middleware/auth.js';

export interface IssuedSession {
  user: AuthUser;
  permissions: Permission[];
  tokens: AuthTokens;
  refreshToken: string;
  sessionId: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role as UserRole,
    fullName: user.fullName,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function auditInput(
  action: string,
  ctx: RequestContext,
  extra: Omit<AuditLogInput, 'action' | 'ipAddress' | 'userAgent'> = {},
): AuditLogInput {
  return {
    action,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    ...extra,
  };
}

async function persistRefreshToken(input: {
  tokenHash: string;
  userId: string;
  sessionId: string;
  tokenId: string;
  expiresAt: Date;
  ctx: RequestContext;
}): Promise<void> {
  await prisma.refreshToken.create({
    data: {
      id: input.tokenId,
      userId: input.userId,
      sessionId: input.sessionId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdByIp: input.ctx.ip,
      userAgent: input.ctx.userAgent,
    },
  });
}

async function issueSession(
  user: User,
  ctx: RequestContext,
  existingSessionId?: string,
): Promise<IssuedSession> {
  const permissions = permissionsForRole(user.role as UserRole);
  const sessionId = existingSessionId ?? randomUUID();

  const access = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
    permissions,
    sessionId,
  });

  const refreshTokenId = randomUUID();
  const refresh = signRefreshToken({
    userId: user.id,
    sessionId,
    tokenId: refreshTokenId,
  });

  await persistRefreshToken({
    tokenHash: hashToken(refresh.token),
    userId: user.id,
    sessionId,
    tokenId: refreshTokenId,
    expiresAt: refresh.expiresAt,
    ctx,
  });

  try {
    await createSession(
      {
        sessionId,
        userId: user.id,
        role: user.role,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      config.jwt.refreshTokenTtlSeconds,
    );
  } catch (error) {
    // Do not leave a refresh token that can never be tied to a live session.
    await prisma.refreshToken.delete({ where: { id: refreshTokenId } }).catch(() => undefined);
    logger.error({ err: error, userId: user.id }, 'failed to persist auth session in Redis');
    throw new AppError(
      503,
      'SESSION_STORE_UNAVAILABLE',
      'Authentication session store is unavailable',
    );
  }

  return {
    user: toAuthUser(user),
    permissions,
    tokens: {
      accessToken: access.token,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
    },
    refreshToken: refresh.token,
    sessionId,
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  role: Exclude<UserRole, 'ADMIN'>;
}

export async function registerUser(
  input: RegisterInput,
  ctx: RequestContext,
): Promise<IssuedSession> {
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new AppError(
      409,
      'EMAIL_ALREADY_REGISTERED',
      'An account with this email already exists',
    );
  }

  const passwordHash = await hashPassword(input.password);
  const correlationId = getCorrelationId() ?? randomUUID();

  let user: User;

  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          role: input.role,
        },
      });

      const payload: AuthUserRegisteredPayload = {
        userId: created.id,
        email: created.email,
        role: created.role as UserRole,
        fullName: created.fullName,
      };

      await enqueueOutbox(tx, {
        eventType: 'auth.user_registered',
        aggregateId: created.id,
        correlationId,
        payload: { ...payload },
      });

      await writeAuditLog(tx, {
        ...auditInput('auth.register', ctx, { userId: created.id }),
        metadata: { role: created.role, correlationId },
      });

      return created;
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new AppError(
        409,
        'EMAIL_ALREADY_REGISTERED',
        'An account with this email already exists',
      );
    }
    throw error;
  }

  logger.info({ userId: user.id, role: user.role }, 'user registered');
  return issueSession(user, ctx);
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function loginUser(input: LoginInput, ctx: RequestContext): Promise<IssuedSession> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });

  const passwordMatches = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyAgainstDummyHash(input.password);

  if (!user || !passwordMatches) {
    await writeAuditLogSafe(prisma, {
      ...auditInput('auth.login_failed', ctx, { userId: user?.id }),
      metadata: { email, reason: 'invalid_credentials' },
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  if (!user.isActive) {
    await writeAuditLogSafe(prisma, {
      ...auditInput('auth.login_failed', ctx, { userId: user.id }),
      metadata: { reason: 'account_disabled' },
    });
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAuditLogSafe(prisma, auditInput('auth.login', ctx, { userId: user.id }));
  logger.info({ userId: user.id, role: user.role }, 'user logged in');

  return issueSession(updated, ctx);
}

export interface RefreshInput {
  refreshToken: string;
}

export async function refreshSession(
  input: RefreshInput,
  ctx: RequestContext,
): Promise<IssuedSession> {
  let payload;
  try {
    payload = verifyRefreshToken(input.refreshToken);
  } catch {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid or expired');
  }

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(input.refreshToken) },
    include: { user: true },
  });

  if (
    !record ||
    record.userId !== payload.sub ||
    record.sessionId !== payload.sessionId ||
    record.id !== payload.jti
  ) {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is not recognised');
  }

  if (record.revokedAt) {
    // A rotated token was replayed: assume theft and revoke the whole session.
    const now = new Date();
    await prisma.refreshToken.updateMany({
      where: { sessionId: record.sessionId, revokedAt: null },
      data: { revokedAt: now, revokedByIp: ctx.ip },
    });
    await revokeSession(record.sessionId).catch(() => undefined);
    await writeAuditLogSafe(prisma, {
      ...auditInput('auth.refresh_reuse_detected', ctx, { userId: record.userId }),
      metadata: { sessionId: record.sessionId },
    });
    throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token reuse detected');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token has expired');
  }

  if (!record.user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  }

  const session = await getSession(record.sessionId);
  if (!session) {
    await prisma.refreshToken.updateMany({
      where: { sessionId: record.sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedByIp: ctx.ip },
    });
    throw new AppError(401, 'SESSION_REVOKED', 'Session is no longer active');
  }

  const permissions = permissionsForRole(record.user.role as UserRole);
  const access = signAccessToken({
    userId: record.user.id,
    email: record.user.email,
    role: record.user.role as UserRole,
    permissions,
    sessionId: record.sessionId,
  });

  const newTokenId = randomUUID();
  const refresh = signRefreshToken({
    userId: record.user.id,
    sessionId: record.sessionId,
    tokenId: newTokenId,
  });
  const newTokenHash = hashToken(refresh.token);

  try {
    await prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedByIp: ctx.ip,
          replacedByTokenId: newTokenId,
        },
      });

      if (revoked.count === 0) {
        throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token reuse detected');
      }

      await tx.refreshToken.create({
        data: {
          id: newTokenId,
          userId: record.userId,
          sessionId: record.sessionId,
          tokenHash: newTokenHash,
          expiresAt: refresh.expiresAt,
          createdByIp: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw error;
  }

  const touched = await touchSession(record.sessionId, config.jwt.refreshTokenTtlSeconds);
  if (!touched) {
    await prisma.refreshToken
      .update({ where: { id: newTokenId }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
    throw new AppError(401, 'SESSION_REVOKED', 'Session is no longer active');
  }

  await writeAuditLogSafe(prisma, {
    ...auditInput('auth.refresh', ctx, { userId: record.userId }),
    metadata: { sessionId: record.sessionId },
  });

  return {
    user: toAuthUser(record.user),
    permissions,
    tokens: {
      accessToken: access.token,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
    },
    refreshToken: refresh.token,
    sessionId: record.sessionId,
  };
}

export interface LogoutInput {
  refreshToken?: string;
  accessToken?: string;
  allSessions: boolean;
}

export async function logoutSession(input: LogoutInput, ctx: RequestContext): Promise<void> {
  let sessionId: string | undefined;
  let userId: string | undefined;

  if (input.refreshToken) {
    try {
      const payload = verifyRefreshToken(input.refreshToken);
      sessionId = payload.sessionId;
      userId = payload.sub;
    } catch {
      // Logout is idempotent — an expired refresh token is still cleared.
    }
  }

  if (!sessionId && input.accessToken) {
    try {
      const payload = verifyAccessToken(input.accessToken);
      sessionId = payload.sessionId;
      userId = payload.sub;
    } catch {
      // Ignore invalid access tokens.
    }
  }

  const now = new Date();

  try {
    if (input.allSessions && userId) {
      const revokedSessions = await revokeAllSessions(userId);
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokedByIp: ctx.ip },
      });
      await writeAuditLogSafe(prisma, {
        ...auditInput('auth.logout_all', ctx, { userId }),
        metadata: { revokedSessions: revokedSessions.length },
      });
      return;
    }

    if (sessionId) {
      await revokeSession(sessionId).catch((error: unknown) => {
        logger.warn({ err: error, sessionId }, 'failed to revoke Redis session');
      });
      await prisma.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: now, revokedByIp: ctx.ip },
      });
      await writeAuditLogSafe(prisma, {
        ...auditInput('auth.logout', ctx, { userId }),
        metadata: { sessionId },
      });
    }
  } catch (error) {
    logger.error({ err: error, sessionId, userId }, 'logout encountered an error');
    // Do not leak infrastructure failures to the client on logout.
  }
}

export async function getCurrentUser(userId: string): Promise<{
  user: AuthUser;
  permissions: Permission[];
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, 'USER_NOT_FOUND', 'Authenticated user no longer exists');
  }
  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  }

  return {
    user: toAuthUser(user),
    permissions: permissionsForRole(user.role as UserRole),
  };
}
