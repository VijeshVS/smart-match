import type { RecruiterPrincipal } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: RecruiterPrincipal;
    }
  }
}

export {};
