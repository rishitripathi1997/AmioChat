'use client';

import { useEffect, useRef, useState } from 'react';
import type { WsConnectionState } from '@/lib/ws/client';

interface ConnectionBannerProps {
  state: WsConnectionState;
}

export function ConnectionBanner({ state }: ConnectionBannerProps) {
  const wasDisconnectedRef = useRef(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    if (state === 'disconnected') {
      wasDisconnectedRef.current = true;
      setShowBackOnline(false);
      return;
    }

    if (state === 'connected' && wasDisconnectedRef.current) {
      wasDisconnectedRef.current = false;
      setShowBackOnline(true);
      const timer = setTimeout(() => setShowBackOnline(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  if (showBackOnline) {
    return (
      <div
        className="bg-[#d1f4cc] px-4 py-2 text-center text-sm text-[#008069]"
        role="status"
        aria-live="polite"
      >
        Back online
      </div>
    );
  }

  if (state === 'connected') return null;

  return (
    <div
      className="bg-[#fff0d4] px-4 py-2 text-center text-sm text-[#54656f]"
      role="status"
      aria-live="polite"
    >
      {state === 'connecting' ? 'Connecting…' : 'Disconnected. Reconnecting…'}
    </div>
  );
}
