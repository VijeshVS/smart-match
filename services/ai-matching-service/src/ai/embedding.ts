import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { tokenize } from './fallback.js';

export type EmbeddingKind = 'document' | 'query';

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string, kind?: EmbeddingKind): Promise<number[]>;
}

function normalize(vector: number[]): number[] {
  let magnitude = 0;
  for (const value of vector) magnitude += value * value;
  magnitude = Math.sqrt(magnitude);

  if (magnitude === 0) {
    const fallback = new Array<number>(vector.length).fill(0);
    fallback[0] = 1;
    return fallback;
  }

  return vector.map((value) => value / magnitude);
}

function hashToken(token: string): number {
  return createHash('sha256').update(token).digest().readUInt32BE(0);
}

/**
 * Deterministic hash embedding for local development, tests and provider
 * outages. Unigrams and bigrams are hashed into a fixed-size non-negative
 * vector, which makes cosine similarity behave like lexical overlap.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'local';
  readonly dimensions: number;

  constructor(dimensions: number) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = tokenize(text);

    for (const token of tokens) {
      vector[hashToken(token) % this.dimensions]! += 1;
    }

    for (let index = 0; index < tokens.length - 1; index += 1) {
      const bigram = `${tokens[index]} ${tokens[index + 1]}`;
      vector[hashToken(bigram) % this.dimensions]! += 0.5;
    }

    return normalize(vector);
  }
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string, dimensions: number) {
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        dimensions: this.dimensions,
      }),
      signal: AbortSignal.timeout(config.ai.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embeddings failed with HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vector = body.data?.[0]?.embedding;

    if (!Array.isArray(vector) || vector.length !== this.dimensions) {
      throw new Error('OpenAI embeddings returned an unexpected vector shape');
    }

    return normalize(vector);
  }
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'gemini';
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string, dimensions: number) {
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(text: string, kind: EmbeddingKind = 'document'): Promise<number[]> {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent` +
      `?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        taskType: kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
        outputDimensionality: this.dimensions,
      }),
      signal: AbortSignal.timeout(config.ai.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Gemini embeddings failed with HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      embedding?: { values?: number[] };
    };
    const vector = body.embedding?.values;

    if (!Array.isArray(vector) || vector.length !== this.dimensions) {
      throw new Error('Gemini embeddings returned an unexpected vector shape');
    }

    return normalize(vector);
  }
}

function createEmbeddingProvider(): EmbeddingProvider {
  const { provider, model, dimensions } = config.embedding;

  if (provider === 'local') {
    return new LocalEmbeddingProvider(dimensions);
  }

  if (provider === 'openai') {
    const apiKey = config.providers.openai.apiKey;
    if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI embeddings');
    return new OpenAiEmbeddingProvider(apiKey, model, dimensions);
  }

  const apiKey = config.providers.gemini.apiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required for Gemini embeddings');
  return new GeminiEmbeddingProvider(apiKey, model, dimensions);
}

export const embeddingProvider: EmbeddingProvider = createEmbeddingProvider();
