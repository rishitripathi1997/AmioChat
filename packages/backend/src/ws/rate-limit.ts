const windows = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, number> = {
  sendMessage: 30,
  typing: 60,
  callSignal: 10,
};

export function checkRateLimit(userId: string, action: string): boolean {
  const limit = LIMITS[action];
  if (!limit) return true;

  const key = `${userId}#${action}`;
  const now = Date.now();
  const windowMs = 60_000;
  const entry = windows.get(key);

  if (!entry || now >= entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

export function resetRateLimitsForTests(): void {
  windows.clear();
}
