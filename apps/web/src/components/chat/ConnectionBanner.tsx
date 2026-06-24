import type { WsConnectionState } from '@/lib/ws/client';

interface ConnectionBannerProps {
  state: WsConnectionState;
}

export function ConnectionBanner({ state }: ConnectionBannerProps) {
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
