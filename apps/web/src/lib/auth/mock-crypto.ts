import { createHmac } from 'crypto';
import { createMockRefreshToken } from './mock-store';

export function signMockRefreshToken(userId: string, secret: string): string {
  const body = createMockRefreshToken(userId);
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyMockRefreshToken(
  token: string,
  secret: string,
): string | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (sig !== expected) return null;
  try {
    const { userId } = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as { userId: string };
    return userId;
  } catch {
    return null;
  }
}
