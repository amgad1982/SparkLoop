import { useEffect, useRef, useState } from 'react';
import { Centrifuge, Subscription, PublicationContext } from 'centrifuge';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../services/apiClient';

interface CentrifugoMessage {
  type: string;
  [key: string]: unknown;
}

export function useCentrifugo(channelName?: string, onMessage?: (data: CentrifugoMessage) => void) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const currentPersona = useAuthStore((state) => state.currentPersona);
  const centrifugeRef = useRef<Centrifuge | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const userSubRef = useRef<Subscription | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let isCancelled = false;

    async function initCentrifuge() {
      try {
        const tokenRes = await api.getCentrifugoToken(currentPersona.id, currentPersona.username);
        if (isCancelled) return;

        // Disconnect previous instance if exists
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
          subscriptionRef.current = null;
        }
        if (userSubRef.current) {
          userSubRef.current.unsubscribe();
          userSubRef.current = null;
        }
        if (centrifugeRef.current) {
          centrifugeRef.current.disconnect();
          centrifugeRef.current = null;
        }

        const centrifuge = new Centrifuge('ws://localhost:8000/connection/websocket', {
          token: tokenRes.token,
          data: {
            user: currentPersona.username,
            name: currentPersona.displayName,
          },
        });

        centrifuge.on('connected', () => {
          if (!isCancelled) setIsConnected(true);
        });

        centrifuge.on('disconnected', () => {
          if (!isCancelled) setIsConnected(false);
        });

        centrifuge.on('error', (ctx) => {
          console.warn('Centrifugo connection issue:', ctx);
        });

        centrifuge.connect();
        centrifugeRef.current = centrifuge;

        // Subscribe to user private channel
        const userChannel = `user:${currentPersona.id}`;
        const userSub = centrifuge.newSubscription(userChannel);
        userSub.on('publication', (ctx: PublicationContext) => {
          if (onMessageRef.current) {
            onMessageRef.current(ctx.data as CentrifugoMessage);
          }
        });
        userSub.subscribe();
        userSubRef.current = userSub;

        // Subscribe to target channel if specified
        if (channelName) {
          const sub = centrifuge.newSubscription(channelName);
          sub.on('publication', (ctx: PublicationContext) => {
            if (onMessageRef.current) {
              onMessageRef.current(ctx.data as CentrifugoMessage);
            }
          });
          sub.subscribe();
          subscriptionRef.current = sub;
        }
      } catch (err) {
        console.warn('Could not establish real-time Centrifugo connection:', err);
      }
    }

    initCentrifuge();

    return () => {
      isCancelled = true;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (userSubRef.current) {
        userSubRef.current.unsubscribe();
        userSubRef.current = null;
      }
      if (centrifugeRef.current) {
        centrifugeRef.current.disconnect();
        centrifugeRef.current = null;
      }
    };
  }, [currentPersona.id, currentPersona.username, channelName]);

  return { isConnected };
}
