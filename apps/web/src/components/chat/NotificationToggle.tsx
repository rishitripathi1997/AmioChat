'use client';

import { useEffect, useState } from 'react';
import {
  areBrowserNotificationsEnabled,
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  setBrowserNotificationsEnabled,
  type NotificationPermissionState,
} from '@/lib/notifications/browser';
import { useToast } from '@/components/ui/Toast';

export function NotificationToggle() {
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermissionState>('default');

  useEffect(() => {
    setEnabled(areBrowserNotificationsEnabled());
    setPermission(getNotificationPermission());
  }, []);

  if (!isNotificationSupported()) {
    return null;
  }

  const handleToggle = async () => {
    if (!enabled) {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result !== 'granted') {
        toast.error('Browser notifications were blocked. Enable them in your browser settings.');
        return;
      }
      setBrowserNotificationsEnabled(true);
      setEnabled(true);
      toast.success('Notifications enabled');
      return;
    }

    setBrowserNotificationsEnabled(false);
    setEnabled(false);
  };

  const label =
    permission === 'denied'
      ? 'Notifications blocked'
      : enabled
        ? 'Notifications on'
        : 'Enable notifications';

  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      disabled={permission === 'denied'}
      className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-[#667781] hover:bg-[#f5f6f6] disabled:cursor-not-allowed disabled:opacity-60"
      aria-pressed={enabled}
    >
      <span aria-hidden>{enabled ? '🔔' : '🔕'}</span>
      {label}
    </button>
  );
}
