import { createHash } from 'node:crypto';
import type {
  Education,
  TalentLensFilters,
  TalentLevel,
  WorkExperience,
} from '@talent-ai/shared-types';
import { config } from '../config.js';
import { levelOrDefault } from '../ai/profile.js';
import type { AiProfile, SearchHit } from '../ai/types.js';
import { logger } from './logger.js';

export class QdrantError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'QdrantError';
    this.statusCode = statusCode;
  }
}

interface QdrantResponse<T> {
  result?: T;
  status?: string;
}

interface QdrantScoredPoint {
  id: string | number;
  score?: number;
  payload?: Record<string, unknown>;
}

interface QdrantCollectionInfo {
  config?: {
    params?: {
      vectors?: {
        size?: number;
      };
    };
  };
}

/**
 * Qdrant point ids must be UUIDs or unsigned integers; talent ids are Mongo
 * ObjectIds. A stable SHA-1 based UUID keeps upserts idempotent.
 */
export function toPointId(talentId: string): string {
  const hash = createHash('sha1').update(`talent:${talentId}`).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function payloadToProfile(payload: Record<string, unknown>): AiProfile | undefined {
  const talentId = stringValue(payload.talentId);
  const name = stringValue(payload.name);
  const field = stringValue(payload.field);
  const experienceYears = payload.experienceYears;

  if (
    !talentId ||
    !name ||
    !field ||
    typeof experienceYears !== 'number' ||
    !Number.isFinite(experienceYears)
  ) {
    return undefined;
  }

  return {
    talentId,
    name,
    field,
    skills: stringArray(payload.skills),
    experienceYears,
    level: levelOrDefault(stringValue(payload.level) as TalentLevel | undefined),
    ...(stringValue(payload.userId) ? { userId: stringValue(payload.userId) } : {}),
    ...(Array.isArray(payload.education) ? { education: payload.education as Education[] } : {}),
    ...(Array.isArray(payload.previousExperience)
      ? { previousExperience: payload.previousExperience as WorkExperience[] }
      : {}),
    ...(stringValue(payload.bio) ? { bio: stringValue(payload.bio) } : {}),
  };
}

export function buildQdrantFilter(filters: TalentLensFilters = {}): unknown {
  const must: unknown[] = [];

  if (filters.skills && filters.skills.length > 0) {
    must.push({
      key: 'skillsLower',
      match: { any: filters.skills.map((skill) => skill.toLowerCase()) },
    });
  }

  if (filters.level) {
    must.push({ key: 'level', match: { value: filters.level } });
  }

  if (filters.field) {
    must.push({ key: 'fieldLower', match: { value: filters.field.toLowerCase() } });
  }

  if (filters.minExperienceYears !== undefined || filters.maxExperienceYears !== undefined) {
    must.push({
      key: 'experienceYears',
      range: {
        ...(filters.minExperienceYears === undefined ? {} : { gte: filters.minExperienceYears }),
        ...(filters.maxExperienceYears === undefined ? {} : { lte: filters.maxExperienceYears }),
      },
    });
  }

  return must.length > 0 ? { must } : undefined;
}

export interface QdrantSearchOptions {
  limit: number;
  filters?: TalentLensFilters;
}

class QdrantClient {
  private readonly baseUrl: string;
  private readonly collection: string;
  private readonly apiKey?: string;
  private readonly dimensions: number;
  private collectionPromise?: Promise<void>;

  constructor() {
    this.baseUrl = config.qdrant.url;
    this.collection = config.qdrant.collection;
    this.apiKey = config.qdrant.apiKey;
    this.dimensions = config.embedding.dimensions;
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      ...(this.apiKey ? { 'api-key': this.apiKey } : {}),
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      signal: AbortSignal.timeout(config.qdrant.timeoutMs),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 500);
      throw new QdrantError(
        `Qdrant ${method} ${path} failed with HTTP ${response.status}${
          detail ? `: ${detail}` : ''
        }`,
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  async ensureCollection(): Promise<void> {
    if (this.collectionPromise) return this.collectionPromise;

    this.collectionPromise = this.doEnsureCollection().catch((error: unknown) => {
      this.collectionPromise = undefined;
      throw error;
    });

    return this.collectionPromise;
  }

  private async doEnsureCollection(): Promise<void> {
    try {
      const existing = await this.request<QdrantResponse<QdrantCollectionInfo>>(
        'GET',
        `/collections/${encodeURIComponent(this.collection)}`,
      );
      const size = existing.result?.config?.params?.vectors?.size;

      if (typeof size === 'number' && size !== this.dimensions) {
        throw new QdrantError(
          `Qdrant collection ${this.collection} has dimension ${size}, but ` +
            `EMBEDDING_DIMENSIONS is ${this.dimensions}. Recreate the collection or ` +
            'use a new QDRANT_COLLECTION name.',
        );
      }

      await this.ensurePayloadIndexes();
      return;
    } catch (error) {
      if (!(error instanceof QdrantError) || error.statusCode !== 404) {
        throw error;
      }
    }

    const created = await this.request<QdrantResponse<boolean>>(
      'PUT',
      `/collections/${encodeURIComponent(this.collection)}`,
      {
        vectors: { size: this.dimensions, distance: 'Cosine' },
        on_disk_payload: true,
      },
    );

    if (created.result === false) {
      throw new QdrantError(`Qdrant did not create collection ${this.collection}`);
    }

    logger.info(
      { collection: this.collection, dimensions: this.dimensions },
      'Qdrant collection created',
    );
    await this.ensurePayloadIndexes();
  }

  private async ensurePayloadIndexes(): Promise<void> {
    const indexes = [
      { field_name: 'talentId', field_schema: 'keyword' },
      { field_name: 'level', field_schema: 'keyword' },
      { field_name: 'fieldLower', field_schema: 'keyword' },
      { field_name: 'skillsLower', field_schema: 'keyword' },
      { field_name: 'experienceYears', field_schema: 'integer' },
    ];

    for (const index of indexes) {
      try {
        await this.request(
          'PUT',
          `/collections/${encodeURIComponent(this.collection)}/index`,
          index,
        );
      } catch (error) {
        // An existing index returns a conflict; indexes are an optimisation,
        // never a startup blocker.
        logger.debug({ err: error, field: index.field_name }, 'Qdrant index already present');
      }
    }
  }

  async upsert(profile: AiProfile, vector: number[]): Promise<void> {
    await this.ensureCollection();

    if (vector.length !== this.dimensions) {
      throw new Error(
        `Embedding dimension ${vector.length} does not match configured ${this.dimensions}`,
      );
    }

    const payload = {
      talentId: profile.talentId,
      ...(profile.userId === undefined ? {} : { userId: profile.userId }),
      name: profile.name,
      field: profile.field,
      fieldLower: profile.field.toLowerCase(),
      skills: profile.skills,
      skillsLower: profile.skills.map((skill) => skill.toLowerCase()),
      experienceYears: profile.experienceYears,
      level: profile.level,
      ...(profile.education === undefined ? {} : { education: profile.education }),
      ...(profile.previousExperience === undefined
        ? {}
        : { previousExperience: profile.previousExperience }),
      ...(profile.bio === undefined ? {} : { bio: profile.bio }),
      indexedAt: new Date().toISOString(),
    };

    await this.request(
      'PUT',
      `/collections/${encodeURIComponent(this.collection)}/points?wait=true`,
      { points: [{ id: toPointId(profile.talentId), vector, payload }] },
    );
  }

  async getProfile(talentId: string): Promise<AiProfile | null> {
    await this.ensureCollection();

    try {
      const response = await this.request<QdrantResponse<{ payload?: Record<string, unknown> }>>(
        'GET',
        `/collections/${encodeURIComponent(this.collection)}/points/${toPointId(
          talentId,
        )}?with_payload=true`,
      );

      const payload = response.result?.payload;
      return payload ? (payloadToProfile(payload) ?? null) : null;
    } catch (error) {
      if (error instanceof QdrantError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async search(vector: number[], options: QdrantSearchOptions): Promise<SearchHit[]> {
    await this.ensureCollection();

    const filter = buildQdrantFilter(options.filters);
    const response = await this.request<QdrantResponse<QdrantScoredPoint[]>>(
      'POST',
      `/collections/${encodeURIComponent(this.collection)}/points/search`,
      {
        vector,
        limit: options.limit,
        with_payload: true,
        ...(filter === undefined ? {} : { filter }),
      },
    );

    return (response.result ?? [])
      .map((point): SearchHit | undefined => {
        const payload = point.payload;
        const profile = payload ? payloadToProfile(payload) : undefined;
        if (!profile) return undefined;

        return {
          profile,
          score: Math.min(1, Math.max(0, point.score ?? 0)),
        };
      })
      .filter((hit): hit is SearchHit => hit !== undefined);
  }

  async health(): Promise<'up' | 'down'> {
    try {
      await this.request('GET', '/collections');
      return 'up';
    } catch {
      return 'down';
    }
  }
}

export const qdrant = new QdrantClient();
