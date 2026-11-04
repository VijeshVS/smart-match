import { redis } from './redis.js';

const SESSION_PREFIX = 'talent:auth:session:';
const USER_SESSIONS_PREFIX = 'talent:auth:user-sessions:';

export interface AuthSessionRecord {
  sessionId: string;
  userId: string;
  role: string;
  createdAt: string;
  lastSeenAt: string;
  ip?: string;
  userAgent?: string;
}

function sessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

function userSessionsKey(userId: string): string {
  return `${USER_SESSIONS_PREFIX}${userId}`;
}

export async function createSession(record: AuthSessionRecord, ttlSeconds: number): Promise<void> {
  await redis
    .multi()
    .set(sessionKey(record.sessionId), JSON.stringify(record), 'EX', ttlSeconds)
    .sadd(userSessionsKey(record.userId), record.sessionId)
    .expire(userSessionsKey(record.userId), ttlSeconds)
    .exec();
}

export async function getSession(sessionId: string): Promise<AuthSessionRecord | null> {
  const raw = await redis.get(sessionKey(sessionId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSessionRecord;
  } catch {
    return null;
  }
}

/** Extends the session TTL — the sliding half of the 7-day refresh lifecycle. */
export async function touchSession(
  sessionId: string,
  ttlSeconds: number,
): Promise<AuthSessionRecord | null> {
  const record = await getSession(sessionId);
  if (!record) return null;

  const updated: AuthSessionRecord = {
    ...record,
    lastSeenAt: new Date().toISOString(),
  };

  await redis
    .multi()
    .set(sessionKey(sessionId), JSON.stringify(updated), 'EX', ttlSeconds)
    .expire(userSessionsKey(updated.userId), ttlSeconds)
    .exec();

  return updated;
}

export async function revokeSession(sessionId: string): Promise<void> {
  const record = await getSession(sessionId);
  await redis.del(sessionKey(sessionId));
  if (record) {
    await redis.srem(userSessionsKey(record.userId), sessionId);
  }
}

export async function revokeAllSessions(userId: string): Promise<string[]> {
  const sessions = await redis.smembers(userSessionsKey(userId));
  if (sessions.length > 0) {
    await redis.del(...sessions.map(sessionKey));
  }
  await redis.del(userSessionsKey(userId));
  return sessions;
}
