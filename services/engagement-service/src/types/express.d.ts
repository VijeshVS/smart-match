import type { EngagementPrincipal } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: EngagementPrincipal;
    }
  }
}

export {};
