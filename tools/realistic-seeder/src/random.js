import { createHash } from 'node:crypto';

/** Deterministic UUID (version 5 layout) derived from a seed and a logical key. */
export function deterministicUuid(seed, key) {
  const hash = createHash('sha1').update(`${seed}:${key}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/** Deterministic 12-byte Mongo ObjectId hex string. */
export function deterministicObjectId(seed, key) {
  return createHash('sha1').update(`${seed}:${key}`).digest().subarray(0, 12).toString('hex');
}

/** Keeps the Qdrant point id stable and compatible with the AI service. */
export function toPointId(talentId) {
  const hash = createHash('sha1').update(`talent:${talentId}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function hash32(value) {
  const digest = createHash('sha256').update(String(value)).digest();
  return digest.readUInt32LE(0);
}

/**
 * Mulberry32 PRNG. Fast, deterministic across Node versions and good enough
 * for synthetic data — not for cryptography.
 */
export function createRng(seed) {
  let state = hash32(seed);

  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  const rng = {
    next,
    float(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      if (max < min) return min;
      return Math.floor(rng.float(min, max + 1));
    },
    bool(probability = 0.5) {
      return next() < probability;
    },
    pick(items) {
      if (items.length === 0) return undefined;
      return items[Math.floor(next() * items.length)];
    },
    pickMany(items, count) {
      return rng.shuffle(items).slice(0, Math.min(count, items.length));
    },
    shuffle(items) {
      const copy = [...items];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(next() * (index + 1));
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
      }
      return copy;
    },
  };

  return rng;
}
