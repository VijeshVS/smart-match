import type { ISODateString, UUID } from './common.js';

export const USER_ROLES = ['CANDIDATE', 'RECRUITER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSIONS = [
  'talent:read',
  'talent:write',
  'talent:unlock',
  'recruiter:read',
  'recruiter:write',
  'engagement:swipe',
  'engagement:review',
  'rewards:read',
  'rewards:spend',
  'analytics:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface AuthUser {
  id: UUID;
  email: string;
  role: UserRole;
  fullName: string;
  isEmailVerified: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

export interface AuthClaims {
  sub: UUID;
  email: string;
  role: UserRole;
  permissions: Permission[];
  sessionId?: string;
  iat?: number;
  exp?: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role: Exclude<UserRole, 'ADMIN'>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RefreshTokenRequest {
  /** Optional when the refresh token travels in an HTTP-only cookie. */
  refreshToken?: string;
}

export interface LogoutRequest {
  refreshToken?: string;
  allSessions?: boolean;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface AuditLogEntry {
  id: UUID;
  userId?: UUID;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: ISODateString;
}

export interface AuthUserRegisteredPayload {
  userId: UUID;
  email: string;
  role: UserRole;
  fullName: string;
}
