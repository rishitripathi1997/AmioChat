const STORAGE_KEY = 'amiochat.notifications.enabled';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function areBrowserNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setBrowserNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

export function shouldNotifyInBackground(): boolean {
  if (typeof document === 'undefined') return false;
  return document.hidden || !document.hasFocus();
}

interface ShowNotificationInput {
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}

export function showBrowserNotification(input: ShowNotificationInput): void {
  if (!isNotificationSupported()) return;
  if (!areBrowserNotificationsEnabled()) return;
  if (Notification.permission !== 'granted') return;
  if (!shouldNotifyInBackground()) return;

  const notification = new Notification(input.title, {
    body: input.body,
    tag: input.tag,
    icon: '/favicon.ico',
  });

  notification.onclick = () => {
    window.focus();
    input.onClick?.();
    notification.close();
  };
}
