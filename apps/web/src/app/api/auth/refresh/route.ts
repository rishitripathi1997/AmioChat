import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthConfig } from '@/lib/auth/config';
import { mockRefreshSession } from '@/lib/auth/mock-store';
import { verifyMockRefreshToken } from '@/lib/auth/mock-crypto';
import { getServerAuthClient } from '@/lib/auth/server';

export async function POST() {
  const config = getAuthConfig();
  const jar = await cookies();
  const refreshCookie = jar.get(config.cookieName)?.value;

  if (!refreshCookie) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  try {
    let session;

    if (config.mode === 'mock') {
      const userId = verifyMockRefreshToken(refreshCookie, config.sessionSecret);
      if (!userId) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
      session = mockRefreshSession(userId);
    } else {
      session = await getServerAuthClient().refreshSession(refreshCookie);
    }

    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }
}
