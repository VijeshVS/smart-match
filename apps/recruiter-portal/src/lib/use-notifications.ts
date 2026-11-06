import { useCallback, useEffect, useRef, useState } from 'react';
import {
  connectNotificationSocket,
  notificationsApi,
  toApiClientError,
  type Notification,
  type RealtimeStatus,
} from '@talent-ai/api-client';

const PAGE_SIZE = 12;

export interface NotificationsState {
  items: Notification[];
  unread: number;
  status: RealtimeStatus;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * Loads the notification inbox and keeps it live through the notification
 * service WebSocket. Falls back silently to the REST inbox when the socket is
 * unavailable, so the UI never blocks on realtime.
 */
export function useNotifications(enabled: boolean): NotificationsState {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        notificationsApi.list({ page: 1, limit: PAGE_SIZE }),
        notificationsApi.unreadCount(),
      ]);
      if (!mounted.current) return;
      setItems(list.data);
      setUnread(count);
      setError(null);
    } catch (cause) {
      if (!mounted.current) return;
      setError(toApiClientError(cause).message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    void refresh();

    const socket = connectNotificationSocket({
      onStatus: (next) => {
        if (mounted.current) setStatus(next);
      },
      onNotification: (notification) => {
        if (!mounted.current) return;
        setItems((current) => [
          notification,
          ...current.filter((item) => item.id !== notification.id),
        ].slice(0, PAGE_SIZE));
        setUnread((current) => current + 1);
      },
    });

    return () => socket.close();
  }, [enabled, refresh]);

  const markRead = useCallback(async (id: string) => {
    const previous = items;
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    setUnread((current) => Math.max(0, current - 1));

    try {
      await notificationsApi.markRead(id, true);
    } catch {
      setItems(previous);
      setUnread((current) => current + 1);
    }
  }, [items]);

  const markAllRead = useCallback(async () => {
    const unreadItems = items.filter((item) => !item.read);
    if (unreadItems.length === 0) return;
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnread(0);
    await Promise.all(unreadItems.map((item) => notificationsApi.markRead(item.id, true)));
  }, [items]);

  return { items, unread, status, loading, error, refresh, markRead, markAllRead };
}
