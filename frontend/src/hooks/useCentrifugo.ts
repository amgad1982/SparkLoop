import { useEffect, useRef, useState, useCallback } from 'react';
import { Centrifuge, Subscription, PublicationContext } from 'centrifuge';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../services/apiClient';

export interface CentrifugoMessage {
  type: string;
  [key: string]: unknown;
}

// Global shared Centrifugo client and subscription registry
let globalCentrifuge: Centrifuge | null = null;
let currentClientUserId: string | null = null;
let connectionPromise: Promise<Centrifuge | null> | null = null;
const channelSubscribers = new Map<string, Set<(data: CentrifugoMessage) => void>>();
const activeSubscriptions = new Map<string, Subscription>();
const connectionStateListeners = new Set<(connected: boolean) => void>();

function notifyConnectionState(connected: boolean) {
  connectionStateListeners.forEach((listener) => {
    try {
      listener(connected);
    } catch (e) {
      console.error('Error in Centrifugo connection state listener:', e);
    }
  });
}

function subscribeToChannel(client: Centrifuge, channel: string) {
  if (activeSubscriptions.has(channel)) return;

  const sub = client.newSubscription(channel);
  sub.on('publication', (ctx: PublicationContext) => {
    const data = ctx.data as CentrifugoMessage;
    const listeners = channelSubscribers.get(channel);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (e) {
          console.error(`Error in Centrifugo listener for channel ${channel}:`, e);
        }
      });
    }
  });

  sub.subscribe();
  activeSubscriptions.set(channel, sub);
}

async function getOrCreateCentrifuge(
  userId: string,
  username: string,
  displayName: string
): Promise<Centrifuge | null> {
  if (globalCentrifuge && currentClientUserId === userId) {
    return globalCentrifuge;
  }

  if (connectionPromise && currentClientUserId === userId) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      if (globalCentrifuge) {
        activeSubscriptions.forEach((sub) => sub.unsubscribe());
        activeSubscriptions.clear();
        globalCentrifuge.disconnect();
        globalCentrifuge = null;
      }

      currentClientUserId = userId;
      const tokenRes = await api.getCentrifugoToken();

      // Resolve dynamic WebSocket URL (supports environment variable, backend config, and HTTPS/WSS auto-upgrade)
      let wsEndpoint = tokenRes?.websocketUrl || (import.meta.env.VITE_WS_URL as string) || '';
      if (!wsEndpoint) {
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        wsEndpoint = host === 'localhost' || host === '127.0.0.1'
          ? 'ws://localhost:8000/connection/websocket'
          : `${isHttps ? 'wss:' : 'ws:'}//${typeof window !== 'undefined' ? window.location.host : 'localhost'}/connection/websocket`;
      }

      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && wsEndpoint.startsWith('ws://') && !wsEndpoint.includes('localhost') && !wsEndpoint.includes('127.0.0.1')) {
        wsEndpoint = wsEndpoint.replace(/^ws:\/\//i, 'wss://');
      }

      const client = new Centrifuge(wsEndpoint, {
        token: tokenRes.token,
        data: {
          user: username,
          name: displayName,
        },
      });

      client.on('connected', () => {
        notifyConnectionState(true);
      });

      client.on('disconnected', () => {
        notifyConnectionState(false);
      });

      client.on('error', (ctx) => {
        console.warn('Centrifugo connection issue:', ctx);
      });

      client.connect();
      globalCentrifuge = client;

      // Subscribe to user private channel
      const userChannel = `user:${userId}`;
      subscribeToChannel(client, userChannel);

      // Re-subscribe all registered channels
      channelSubscribers.forEach((_, channel) => {
        subscribeToChannel(client, channel);
      });

      return client;
    } catch (err) {
      console.warn('Could not establish real-time Centrifugo connection:', err);
      notifyConnectionState(false);
      return null;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

export function useCentrifugo(
  channelName?: string,
  onMessage?: (data: CentrifugoMessage) => void
) {
  const [isConnected, setIsConnected] = useState<boolean>(() => {
    return globalCentrifuge?.state === 'connected';
  });

  const currentPersona = useAuthStore((state) => state.currentPersona);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const handleStateChange = (connected: boolean) => {
      setIsConnected(connected);
    };

    connectionStateListeners.add(handleStateChange);
    setIsConnected(globalCentrifuge?.state === 'connected');

    return () => {
      connectionStateListeners.delete(handleStateChange);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    getOrCreateCentrifuge(
      currentPersona.id,
      currentPersona.username,
      currentPersona.displayName
    ).then((client) => {
      if (isCancelled || !client) return;

      if (channelName) {
        if (!channelSubscribers.has(channelName)) {
          channelSubscribers.set(channelName, new Set());
        }

        const listener = (data: CentrifugoMessage) => {
          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        };

        channelSubscribers.get(channelName)!.add(listener);
        subscribeToChannel(client, channelName);

        return () => {
          const listeners = channelSubscribers.get(channelName);
          if (listeners) {
            listeners.delete(listener);
            if (listeners.size === 0) {
              channelSubscribers.delete(channelName);
              const sub = activeSubscriptions.get(channelName);
              if (sub) {
                sub.unsubscribe();
                activeSubscriptions.delete(channelName);
              }
            }
          }
        };
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [currentPersona.id, currentPersona.username, currentPersona.displayName, channelName]);

  return { isConnected };
}
