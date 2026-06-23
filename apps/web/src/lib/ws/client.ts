'use client';

import type { WsClientEnvelope, WsServerEnvelope } from '@amiochat/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3002';

export interface UseWsClientOptions {
  idToken: string | null;
  enabled?: boolean;
  onEvent?: (event: WsServerEnvelope) => void;
}

export function useWsClient({ idToken, enabled = true, onEvent }: UseWsClientOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !idToken) {
      setConnected(false);
      return;
    }

    const url = `${WS_URL}?token=${encodeURIComponent(idToken)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data as string) as WsServerEnvelope;
        onEventRef.current?.(event);
      } catch {
        // ignore malformed frames
      }
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'ping', payload: {} }));
      }
    }, 30_000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
      wsRef.current = null;
    };
  }, [enabled, idToken]);

  const send = useCallback((envelope: WsClientEnvelope) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(envelope));
    }
  }, []);

  return { connected, send };
}
