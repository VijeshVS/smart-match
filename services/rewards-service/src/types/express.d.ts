import type { RewardsPrincipal } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: RewardsPrincipal;
    }
  }
}

export {};
