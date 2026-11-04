import { describe, expect, it } from 'vitest';
import { AppError } from '../src/lib/errors.js';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/lib/tokens.js';

const baseInput = {
  userId: '2f3c0a2e-5f5b-4f0b-9a0f-3f5e4d2c1b0a',
  email: 'candidate@talent.ai',
  role: 'CANDIDATE' as const,
  permissions: ['talent:read', 'talent:write'] as const,
  sessionId: '8b1f3d4c-2a6e-4c9b-8f0d-1e2a3b4c5d6e',
};

describe('JWT lifecycle', () => {
  it('issues and verifies an access token with identity claims', () => {
    const issued = signAccessToken({ ...baseInput, permissions: [...baseInput.permissions] });
    const payload = verifyAccessToken(issued.token);

    expect(payload.sub).toBe(baseInput.userId);
    expect(payload.email).toBe(baseInput.email);
    expect(payload.role).toBe('CANDIDATE');
    expect(payload.sessionId).toBe(baseInput.sessionId);
    expect(payload.permissions).toEqual(['talent:read', 'talent:write']);
    expect(issued.expiresIn).toBe(900);
  });

  it('issues a refresh token that only verifies against the refresh secret', () => {
    const refresh = signRefreshToken({
      userId: baseInput.userId,
      sessionId: baseInput.sessionId,
      tokenId: '0b0c1d2e-3f4a-4b5c-8d6e-7f8a9b0c1d2e',
    });

    const payload = verifyRefreshToken(refresh.token);
    expect(payload.type).toBe('refresh');
    expect(payload.sessionId).toBe(baseInput.sessionId);

    expect(() => verifyAccessToken(refresh.token)).toThrow(AppError);
  });

  it('rejects an access token presented as a refresh token', () => {
    const access = signAccessToken({ ...baseInput, permissions: [...baseInput.permissions] });
    expect(() => verifyRefreshToken(access.token)).toThrow(AppError);
  });

  it('hashes refresh tokens deterministically for storage', () => {
    const token = 'opaque-refresh-token';
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(hashToken(`${token}-other`));
  });
});
