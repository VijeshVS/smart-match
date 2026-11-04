import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: config.argon2.memoryCost,
  timeCost: config.argon2.timeCost,
  parallelism: config.argon2.parallelism,
  hashLength: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Runs a real Argon2 verification for unknown accounts so login timing does not
 * reveal whether an email is registered.
 */
export async function verifyAgainstDummyHash(password: string): Promise<boolean> {
  dummyHash ??= hashPassword(randomUUID());
  return verifyPassword(await dummyHash, password);
}
