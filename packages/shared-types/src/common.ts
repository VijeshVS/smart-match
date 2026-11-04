/**
 * Cross-cutting primitives shared by every talent.ai microservice.
 */

export type UUID = string;
export type ISODateString = string;

export const SERVICE_NAMES = [
  'api-gateway',
  'auth-service',
  'talent-service',
  'recruiter-service',
  'engagement-service',
  'rewards-service',
  'ai-matching-service',
  'notification-service',
  'analytics-service',
] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  correlationId?: string;
  details?: unknown;
}

/** Central error envelope returned by the API Gateway and every service. */
export interface ApiErrorResponse {
  status: number;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;

export type HealthState = 'up' | 'down';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  service: ServiceName | string;
  version: string;
  uptimeSeconds: number;
  checks: Record<string, HealthState>;
  timestamp: ISODateString;
}

export interface AuthenticatedPrincipal {
  userId: UUID;
  email: string;
  role: string;
  permissions: string[];
}
