import type { Permission, UserRole } from '@talent-ai/shared-types';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        role: UserRole;
        permissions: Permission[];
        sessionId: string;
      };
    }
  }
}

export {};
