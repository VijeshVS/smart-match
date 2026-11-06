import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Notification } from '@talent-ai/shared-types';
import { Redis } from 'ioredis';
import { WebSocket, WebSocketServer } from 'ws';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { verifySocketToken } from '../middleware/auth.js';

interface ClientConnection {
  socket: WebSocket;
  userId: string;
  isAlive: boolean;
}

const clients = new Map<string, Set<ClientConnection>>();
let wss: WebSocketServer | undefined;
let heartbeat: NodeJS.Timeout | undefined;
let publisher: Redis | undefined;
let subscriber: Redis | undefined;

function addClient(userId: string, socket: WebSocket): ClientConnection {
  const connection: ClientConnection = { socket, userId, isAlive: true };

  const set = clients.get(userId) ?? new Set<ClientConnection>();
  set.add(connection);
  clients.set(userId, set);

  socket.on('pong', () => {
    connection.isAlive = true;
  });

  socket.on('close', () => {
    const current = clients.get(userId);
    if (!current) return;
    current.delete(connection);
    if (current.size === 0) clients.delete(userId);
  });

  socket.on('error', (error) => {
    logger.warn({ err: error, userId }, 'notification websocket error');
  });

  return connection;
}

function tokenFromRequest(request: IncomingMessage): string | undefined {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const queryToken = url.searchParams.get('token');
  if (queryToken) return queryToken;

  const header = request.headers.authorization;
  if (typeof header === 'string') {
    const [scheme, token] = header.split(' ');
    if (token && scheme?.toLowerCase() === 'bearer') return token.trim();
  }

  return undefined;
}

/**
 * Attaches a WebSocket endpoint to the service's HTTP server.
 *
 * Clients connect to `WEBSOCKET_PATH?token=<access token>`. The token is
 * verified with the same key as the REST API, and every connection is scoped to
 * one user id so notifications are never broadcast across tenants.
 */
export function registerWebSocketServer(server: HttpServer): void {
  wss = new WebSocketServer({ noServer: true, clientTracking: false });

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (url.pathname !== config.websocketPath) {
      socket.destroy();
      return;
    }

    const principal = verifySocketToken(tokenFromRequest(request));
    if (!principal) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss?.handleUpgrade(request, socket, head, (websocket) => {
      addClient(principal.userId, websocket);

      websocket.send(
        JSON.stringify({
          type: 'connected',
          data: { userId: principal.userId, timestamp: new Date().toISOString() },
        }),
      );

      logger.info({ userId: principal.userId }, 'notification websocket connected');
    });
  });

  // Drop peers that stop answering pings so the client map cannot grow forever.
  heartbeat = setInterval(() => {
    for (const set of clients.values()) {
      for (const connection of set) {
        if (!connection.isAlive) {
          connection.socket.terminate();
          continue;
        }
        connection.isAlive = false;
        connection.socket.ping();
      }
    }
  }, 30_000);
  heartbeat.unref();
}

function deliverLocal(userId: string, notification: Notification): void {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;

  const payload = JSON.stringify({ type: 'notification', data: notification });
  for (const connection of set) {
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.send(payload);
    }
  }
}

/**
 * Creates the Redis publisher/subscriber pair used to fan notifications out to
 * every replica. Each replica consumes the same durable event queue, so without
 * this bridge a notification persisted by one pod would never reach a socket
 * connected to another. The bridge is optional: when Redis is unreachable the
 * service still delivers in-app notifications on the pod that processed them.
 */
/** Races a connection attempt against a bounded startup budget. */
async function withStartupTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    timer.unref();
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function startRealtimeBridge(): Promise<void> {
  const options = {
    lazyConnect: true,
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    // Keep retrying while the process is running so the bridge recovers after a
    // Redis failover; boot itself is bounded by `withStartupTimeout`.
    retryStrategy: (times: number) => Math.min(times * 250, 2_000),
  } as const;

  publisher = new Redis(config.redis.url, options);
  subscriber = new Redis(config.redis.url, options);

  // Prevent unhandled `error` events from crashing the process when Redis is
  // unavailable; delivery falls back to local sockets.
  publisher.on('error', (error) => logger.warn({ err: error }, 'redis publisher error'));
  subscriber.on('error', (error) => logger.warn({ err: error }, 'redis subscriber error'));

  try {
    await withStartupTimeout(Promise.all([publisher.connect(), subscriber.connect()]), 5_000);
    await subscriber.subscribe(config.redis.fanoutChannel);

    subscriber.on('message', (channel, message) => {
      if (channel !== config.redis.fanoutChannel) return;

      try {
        const payload = JSON.parse(message) as {
          userId?: string;
          notification?: Notification;
        };
        if (payload.userId && payload.notification) {
          deliverLocal(payload.userId, payload.notification);
        }
      } catch (error) {
        logger.warn({ err: error }, 'invalid notification fan-out message');
      }
    });

    logger.info({ channel: config.redis.fanoutChannel }, 'notification realtime bridge connected');
  } catch (error) {
    logger.warn(
      { err: error },
      'Redis unavailable; live notifications are limited to this replica',
    );
    publisher.disconnect();
    subscriber.disconnect();
    publisher = undefined;
    subscriber = undefined;
  }
}

export function isRealtimeBridgeReady(): boolean {
  return publisher?.status === 'ready';
}

/**
 * Pushes a freshly persisted notification to the user's live sockets, across
 * every replica via Redis when the bridge is available.
 */
export async function broadcastNotification(
  userId: string,
  notification: Notification,
): Promise<void> {
  if (publisher?.status === 'ready') {
    try {
      await publisher.publish(config.redis.fanoutChannel, JSON.stringify({ userId, notification }));
      return;
    } catch (error) {
      logger.warn(
        { err: error, userId },
        'notification fan-out failed; delivering on this replica only',
      );
    }
  }

  deliverLocal(userId, notification);
}

export function connectedClientCount(): number {
  let total = 0;
  for (const set of clients.values()) total += set.size;
  return total;
}

export async function closeWebSockets(): Promise<void> {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = undefined;

  for (const set of clients.values()) {
    for (const connection of set) connection.socket.close(1001, 'server shutting down');
  }
  clients.clear();

  await new Promise<void>((resolve) => {
    if (!wss) {
      resolve();
      return;
    }
    wss.close(() => resolve());
    wss = undefined;
  });

  await Promise.allSettled([
    publisher ? publisher.quit() : Promise.resolve(),
    subscriber ? subscriber.quit() : Promise.resolve(),
  ]);
  publisher = undefined;
  subscriber = undefined;
}
