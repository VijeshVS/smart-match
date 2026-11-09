/**
 * Returns a new array containing the same items in a uniformly random order.
 *
 * Uses the Fisher–Yates algorithm so every permutation is equally likely. The
 * source array is never mutated, and `random` can be injected for deterministic
 * tests.
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index] as T;
    result[index] = result[swapIndex] as T;
    result[swapIndex] = current;
  }

  return result;
}
