import { Router, type Response } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { asyncHandler, sendError } from '../lib/errors.js';
import { requireAuth, requestContext } from '../middleware/auth.js';
import {
  getCurrentUser,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
} from '../services/auth.service.js';

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const registerSchema = z.object({
  email: z.string().trim().email('A valid email is required').max(254),
  password: passwordSchema,
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  role: z.enum(['CANDIDATE', 'RECRUITER']),
});

const loginSchema = z.object({
  email: z.string().trim().email('A valid email is required').max(254),
  password: z.string().min(1, 'Password is required').max(128),
});

const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .optional();

const logoutSchema = z
  .object({
    allSessions: z.boolean().optional().default(false),
  })
  .optional();

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: config.cookie.path,
    maxAge: config.cookie.maxAgeMs,
  } as const;
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(config.cookie.name, token, refreshCookieOptions());
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(config.cookie.name, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: config.cookie.path,
  });
}

function readRefreshCookie(cookies: unknown): string | undefined {
  if (!cookies || typeof cookies !== 'object') return undefined;
  const value = (cookies as Record<string, unknown>)[config.cookie.name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function extractAccessToken(authorization?: string): string | undefined {
  if (!authorization) return undefined;
  const [scheme, token] = authorization.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') return undefined;
  return token.trim();
}

export const authRouter: Router = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const result = await registerUser(body, requestContext(req));
    setRefreshCookie(res, result.refreshToken);

    res.status(201).json({
      user: result.user,
      permissions: result.permissions,
      tokens: result.tokens,
    });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await loginUser(body, requestContext(req));
    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      user: result.user,
      permissions: result.permissions,
      tokens: result.tokens,
    });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const body = refreshSchema.parse(req.body ?? {}) ?? {};
    const cookieToken = readRefreshCookie(req.cookies);
    const refreshToken = body.refreshToken ?? cookieToken;

    if (!refreshToken) {
      sendError(
        res,
        401,
        'REFRESH_TOKEN_MISSING',
        'A refresh token cookie or body field is required',
      );
      return;
    }

    const result = await refreshSession({ refreshToken }, requestContext(req));
    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      user: result.user,
      permissions: result.permissions,
      tokens: result.tokens,
    });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const body = logoutSchema.parse(req.body ?? {});
    const cookieToken = readRefreshCookie(req.cookies);

    await logoutSession(
      {
        refreshToken: cookieToken,
        accessToken: extractAccessToken(req.header('authorization')),
        allSessions: body?.allSessions ?? false,
      },
      requestContext(req),
    );

    clearRefreshCookie(res);
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await getCurrentUser(req.auth!.userId);
    res.status(200).json(result);
  }),
);
