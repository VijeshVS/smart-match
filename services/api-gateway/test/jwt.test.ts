import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { config } from '../src/config.js';
import { AppError } from '../src/lib/errors.js';
import { verifyAccessToken } from '../src/lib/jwt.js';

const claims = {
  sub: '2f3c0a2e-5f5b-4f0b-9a0f-3f5e4d2c1b0a',
  email: 'recruiter@talent.ai',
  role: 'RECRUITER',
  permissions: ['talent:read', 'engagement:swipe'],
  sessionId: '8b1f3d4c-2a6e-4c9b-8f0d-1e2a3b4c5d6e',
  type: 'access',
};

function sign(overrides: Record<string, unknown> = {}, expiresIn = 900): string {
  return jwt.sign({ ...claims, ...overrides }, config.jwt.accessSecret, {
    algorithm: 'HS256',
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn,
    jwtid: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  });
}

describe('gateway JWT verification', () => {
  it('trusts a valid access token and maps identity claims', () => {
    const principal = verifyAccessToken(sign());
    expect(principal.userId).toBe(claims.sub);
    expect(principal.role).toBe('RECRUITER');
    expect(principal.permissions).toContain('engagement:swipe');
    expect(principal.sessionId).toBe(claims.sessionId);
  });

  it('rejects a token signed with another secret', () => {
    const token = jwt.sign({ ...claims }, 'a-different-secret-that-is-long-enough', {
      algorithm: 'HS256',
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      expiresIn: 900,
    });

    expect(() => verifyAccessToken(token)).toThrowError(AppError);
  });

  it('rejects expired tokens with AUTH_TOKEN_EXPIRED', () => {
    const token = sign({}, -1);
    try {
      verifyAccessToken(token);
      expect.unreachable('expired token should not verify');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('AUTH_TOKEN_EXPIRED');
    }
  });

  it('rejects tokens carrying a refresh type', () => {
    expect(() => verifyAccessToken(sign({ type: 'refresh' }))).toThrowError(AppError);
  });

  it('rejects an access token without a session id', () => {
    expect(() => verifyAccessToken(sign({ sessionId: undefined }))).toThrowError(AppError);
  });
});
