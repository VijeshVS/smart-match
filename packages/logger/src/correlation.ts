import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface CorrelationContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
}

export interface CorrelationRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

export interface CorrelationResponseLike {
  setHeader(name: string, value: string): void;
}

export type NextFunctionLike = (err?: unknown) => void;

/**
 * W3C traceparent: `00-<32 hex trace id>-<16 hex span id>-<flags>`.
 * Parsing is intentionally tolerant: malformed headers are ignored.
 */
export function parseTraceparent(traceparent?: string): Pick<CorrelationContext, 'traceId' | 'spanId'> {
  if (!traceparent) return {};
  const parts = traceparent.trim().split('-');
  if (parts.length < 4) return {};
  const traceId = parts[1];
  const spanId = parts[2];
  if (!traceId || !spanId || traceId.length !== 32 || spanId.length !== 16) return {};
  return { traceId, spanId };
}

export function createCorrelationContext(
  correlationId?: string,
  traceparent?: string,
): CorrelationContext {
  return {
    correlationId: correlationId?.trim() || randomUUID(),
    ...parseTraceparent(traceparent),
  };
}

function readHeader(
  headers: CorrelationRequestLike['headers'],
  name: string,
): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/**
 * Express/Fastify-compatible middleware that guarantees an X-Correlation-ID
 * for every request and exposes it through AsyncLocalStorage.
 */
export function correlationMiddleware(
  req: CorrelationRequestLike,
  res: CorrelationResponseLike,
  next: NextFunctionLike,
): void {
  const context = createCorrelationContext(
    readHeader(req.headers, 'x-correlation-id') ?? readHeader(req.headers, 'x-request-id'),
    readHeader(req.headers, 'traceparent'),
  );
  res.setHeader('x-correlation-id', context.correlationId);
  runWithCorrelation(context, () => next());
}

const storage = new AsyncLocalStorage<CorrelationContext>();

export function getCorrelationContext(): CorrelationContext | undefined {
  return storage.getStore();
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export function runWithCorrelation<T>(context: CorrelationContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return storage.run({ correlationId }, fn);
}
