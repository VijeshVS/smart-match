import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '../src/lib/concurrency.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('mapWithConcurrency', () => {
  it('preserves order and respects the concurrency limit', async () => {
    let active = 0;
    let peak = 0;

    const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await delay(5);
      active -= 1;
      return value * 2;
    });

    expect(result).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('handles empty input', async () => {
    expect(await mapWithConcurrency([], 4, async (value: number) => value)).toEqual([]);
  });
});
