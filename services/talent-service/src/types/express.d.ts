import type { TalentPrincipal } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: TalentPrincipal;
    }
  }
}

export {};
