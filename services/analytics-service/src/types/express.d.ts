import type { AnalyticsPrincipal } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AnalyticsPrincipal;
    }
  }
}

export {};
