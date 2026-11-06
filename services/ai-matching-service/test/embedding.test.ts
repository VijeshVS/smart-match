import { describe, expect, it } from 'vitest';
import { LocalEmbeddingProvider } from '../src/ai/embedding.js';

function cosine(left: number[], right: number[]): number {
  let dot = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return dot;
}

describe('LocalEmbeddingProvider', () => {
  const provider = new LocalEmbeddingProvider(128);

  it('produces a deterministic, normalised vector', async () => {
    const first = await provider.embed('React Node.js TypeScript');
    const second = await provider.embed('React Node.js TypeScript');
    const magnitude = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));

    expect(first).toHaveLength(128);
    expect(first).toEqual(second);
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it('scores related text higher than unrelated text', async () => {
    const query = await provider.embed('senior devops terraform aws');
    const related = await provider.embed('Terraform AWS Kubernetes DevOps engineer');
    const unrelated = await provider.embed('Accounting payroll finance spreadsheet');

    expect(cosine(query, related)).toBeGreaterThan(cosine(query, unrelated));
  });

  it('handles empty text without returning a zero vector', async () => {
    const vector = await provider.embed('   ');
    expect(vector).toHaveLength(128);
    expect(vector.some((value) => value !== 0)).toBe(true);
  });
});
