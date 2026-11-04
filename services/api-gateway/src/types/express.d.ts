import type { GatewayPrincipal } from '../lib/jwt.js';

declare global {
  namespace Express {
    interface Request {
      auth?: GatewayPrincipal;
    }
  }
}

export {};
