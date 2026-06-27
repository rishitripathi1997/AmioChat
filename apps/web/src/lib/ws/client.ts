'use client';

import type { WsClientEnvelope, WsServerEnvelope } from '@amiochat/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getWsUrl } from '@/lib/config/runtime';

const BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

export type WsConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface UseWsClientOptions {
  idToken: string | null;
  enabled?: boolean;
  onEvent?: (event: WsServerEnvelope) => void;
  onReconnect?: () => void;
}

export function useWsClient({
  idToken,
  enabled = true,
  onEvent,
  onReconnect,
}: UseWsClientOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const idTokenRef = useRef(idToken);
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndex = useRef(0);
  const intentionalClose = useRef(false);
  const hasConnectedOnce = useRef(false);
  const authenticatedRef = useRef(false);
  const [connectionState, setConnectionState] = useState<WsConnectionState>('disconnected');

  useEffect(() => {
    idTokenRef.current = idToken;
  }, [idToken]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!idTokenRef.current || !enabled) return;

    clearReconnectTimer();
    intentionalClose.current = false;
    authenticatedRef.current = false;
    setConnectionState('connecting');

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      ws.send(
        JSON.stringify({
          action: 'authenticate',
          payload: { token: idTokenRef.current },
        } satisfies WsClientEnvelope),
      );
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      authenticatedRef.current = false;
      setConnectionState('disconnected');

      if (!intentionalClose.current && enabled && idTokenRef.current) {
        const delay = BACKOFF_STEPS_MS[Math.min(backoffIndex.current, BACKOFF_STEPS_MS.length - 1)];
        backoffIndex.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data as string) as WsServerEnvelope;

        if (event.event === 'connected') {
          authenticatedRef.current = true;
          backoffIndex.current = 0;
          setConnectionState('connected');
          if (hasConnectedOnce.current) {
            onReconnectRef.current?.();
          } else {
            hasConnectedOnce.current = true;
          }
        }

        onEventRef.current?.(event);
      } catch {
        // ignore malformed frames
      }
    };
  }, [clearReconnectTimer, enabled]);

  useEffect(() => {
    if (!enabled || !idToken) {
      intentionalClose.current = true;
      hasConnectedOnce.current = false;
      authenticatedRef.current = false;
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
      setConnectionState('disconnected');
      return;
    }

    connect();

    const pingInterval = setInterval(() => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN && authenticatedRef.current) {
        ws.send(JSON.stringify({ action: 'ping', payload: {} }));
      }
    }, 30_000);

    return () => {
      intentionalClose.current = true;
      clearReconnectTimer();
      clearInterval(pingInterval);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [clearReconnectTimer, connect, enabled, idToken]);

  const send = useCallback((envelope: WsClientEnvelope) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN && authenticatedRef.current) {
      ws.send(JSON.stringify(envelope));
      return true;
    }
    return false;
  }, []);

  return {
    connectionState,
    connected: connectionState === 'connected',
    connecting: connectionState === 'connecting',
    send,
  };
}
