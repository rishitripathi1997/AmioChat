'use client';

import type { WsClientEnvelope, WsServerEnvelope } from '@amiochat/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3002';
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
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndex = useRef(0);
  const intentionalClose = useRef(false);
  const [connectionState, setConnectionState] = useState<WsConnectionState>('disconnected');

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
    if (!idToken || !enabled) return;

    clearReconnectTimer();
    intentionalClose.current = false;
    setConnectionState('connecting');

    const url = `${WS_URL}?token=${encodeURIComponent(idToken)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffIndex.current = 0;
      setConnectionState('connected');
      if (wsRef.current !== ws) return;
      onReconnectRef.current?.();
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      setConnectionState('disconnected');

      if (!intentionalClose.current && enabled && idToken) {
        const delay = BACKOFF_STEPS_MS[Math.min(backoffIndex.current, BACKOFF_STEPS_MS.length - 1)];
        backoffIndex.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data as string) as WsServerEnvelope;
        onEventRef.current?.(event);
      } catch {
        // ignore malformed frames
      }
    };
  }, [clearReconnectTimer, enabled, idToken]);

  useEffect(() => {
    if (!enabled || !idToken) {
      intentionalClose.current = true;
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
      setConnectionState('disconnected');
      return;
    }

    connect();

    const pingInterval = setInterval(() => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
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
    if (ws?.readyState === WebSocket.OPEN) {
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
