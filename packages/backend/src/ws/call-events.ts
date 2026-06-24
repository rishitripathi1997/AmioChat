import type { WsServerEnvelope } from '@amiochat/shared';

export interface CallEventPublisher {
  sendToUser(userId: string, event: WsServerEnvelope): Promise<void>;
}

let publisher: CallEventPublisher | null = null;

export function setCallEventPublisher(p: CallEventPublisher): void {
  publisher = p;
}

export async function publishCallEvent(
  userId: string,
  event: WsServerEnvelope,
): Promise<void> {
  if (publisher) {
    await publisher.sendToUser(userId, event);
    return;
  }

  const notifyUrl = process.env.CALL_NOTIFY_URL;
  if (!notifyUrl) return;

  try {
    await fetch(notifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, event }),
    });
  } catch {
    // best-effort for local dev bridge
  }
}

export function resetCallEventPublisherForTests(): void {
  publisher = null;
}
