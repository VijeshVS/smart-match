import type {
  Notification,
  NotificationListResponse,
  PaginatedResult,
} from '@talent-ai/shared-types';
import { api } from '../http.js';
import { API_PREFIXES, notificationSocketUrl } from '../env.js';
import { authStore } from '../auth-store.js';

interface Envelope<T> {
  data: T;
}

export interface NotificationListQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export const notificationsApi = {
  list: async (query: NotificationListQuery = {}): Promise<PaginatedResult<Notification>> => {
    const { data } = await api.get<NotificationListResponse>(`${API_PREFIXES.notifications}/`, {
      params: query,
    });
    return data;
  },

  unreadCount: async (): Promise<number> => {
    const { data } = await api.get<Envelope<{ count: number }>>(
      `${API_PREFIXES.notifications}/unread-count`,
    );
    return data.data.count;
  },

  markRead: async (id: string, read = true): Promise<Notification> => {
    const { data } = await api.patch<Envelope<Notification>>(
      `${API_PREFIXES.notifications}/${id}/read`,
      { read },
    );
    return data.data;
  },
};

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

export interface NotificationSocketHandle {
  close: () => void;
}

/**
 * Opens the notification-service WebSocket and keeps it alive with backoff.
 * Falls back to the REST unread-count endpoint if the socket cannot connect.
 */
export function connectNotificationSocket(input: {
  onNotification: (notification: Notification) => void;
  onStatus?: (status: RealtimeStatus) => void;
}): NotificationSocketHandle {
  let socket: WebSocket | null = null;
  let closed = false;
  let retry = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleReconnect = () => {
    if (closed) return;
    const delay = Math.min(30_000, 1_000 * 2 ** retry);
    retry += 1;
    retryTimer = setTimeout(open, delay);
  };

  const open = () => {
    const token = authStore.getAccessToken();
    if (!token || closed) return;

    const url = new URL(notificationSocketUrl);
    url.searchParams.set('token', token);

    input.onStatus?.('connecting');
    socket = new WebSocket(url.toString());

    socket.addEventListener('open', () => {
      retry = 0;
      input.onStatus?.('connected');
    });

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as {
          type?: string;
          data?: Notification;
        };
        if (payload.type === 'notification' && payload.data) {
          input.onNotification(payload.data);
        }
      } catch {
        // Ignore malformed frames.
      }
    });

    socket.addEventListener('close', () => {
      input.onStatus?.('disconnected');
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      socket?.close();
    });
  };

  open();

  return {
    close: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
      socket = null;
    },
  };
}
