import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@talent-ai/shared-types';
import { permissionsForRole, ROLE_PERMISSIONS } from '../src/lib/permissions.js';

describe('role permissions', () => {
  it('grants candidates profile read/write access only', () => {
    expect(permissionsForRole('CANDIDATE')).toEqual(['talent:read', 'talent:write']);
  });

  it('grants recruiters engagement and rewards capabilities', () => {
    const permissions = permissionsForRole('RECRUITER');
    expect(permissions).toContain('engagement:swipe');
    expect(permissions).toContain('engagement:review');
    expect(permissions).toContain('rewards:spend');
    expect(permissions).not.toContain('talent:write');
  });

  it('gives admins every declared permission', () => {
    expect(permissionsForRole('ADMIN')).toEqual([...PERMISSIONS]);
  });

  it('only references canonical permission strings', () => {
    const canonical = new Set<string>(PERMISSIONS);
    for (const grants of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of grants) {
        expect(canonical.has(permission)).toBe(true);
      }
    }
  });
});
