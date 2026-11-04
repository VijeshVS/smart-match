import { describe, expect, it } from 'vitest';
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from '../src/lib/password.js';

describe('Argon2id password hashing', () => {
  it('hashes with a salted argon2id digest and verifies the original password', async () => {
    const hash = await hashPassword('CorrectHorseBattery9');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(hash, 'CorrectHorseBattery9')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('CorrectHorseBattery9');
    await expect(verifyPassword(hash, 'WrongPassword9')).resolves.toBe(false);
  });

  it('returns false for malformed hashes instead of throwing', async () => {
    await expect(verifyPassword('not-a-hash', 'anything')).resolves.toBe(false);
  });

  it('performs a real (failing) verification for unknown accounts', async () => {
    await expect(verifyAgainstDummyHash('some-password')).resolves.toBe(false);
  });
});
