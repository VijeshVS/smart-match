import type { AiPrincipal } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AiPrincipal;
    }
  }
}

export {};
