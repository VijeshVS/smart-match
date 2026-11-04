import { PERMISSIONS, type Permission, type UserRole } from '@talent-ai/shared-types';

/**
 * Authoritative role → permission grants. The same table is seeded into the
 * `roles` table for auditability, but token minting reads this constant so a
 * login never depends on an extra database round-trip.
 */
export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  CANDIDATE: ['talent:read', 'talent:write'],
  RECRUITER: [
    'talent:read',
    'talent:unlock',
    'recruiter:read',
    'recruiter:write',
    'engagement:swipe',
    'engagement:review',
    'rewards:read',
    'rewards:spend',
    'analytics:read',
  ],
  ADMIN: [...PERMISSIONS],
};

export function permissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}
