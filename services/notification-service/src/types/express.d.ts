import type { NotificationPrincipal } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: NotificationPrincipal;
    }
  }
}

export {};
