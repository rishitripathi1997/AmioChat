import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthConfig } from '@/lib/auth/config';
import { signMockRefreshToken } from '@/lib/auth/mock-crypto';
import { REFRESH_COOKIE_OPTIONS } from '@/lib/auth/server';

export async function POST(request: Request) {
  const config = getAuthConfig();
  const body = (await request.json()) as { refreshToken?: string };

  if (!body.refreshToken) {
    return NextResponse.json({ error: 'Missing refresh token' }, { status: 400 });
  }

  const cookieValue =
    config.mode === 'mock'
      ? signMockRefreshToken(body.refreshToken, config.sessionSecret)
      : body.refreshToken;

  const jar = await cookies();
  jar.set(config.cookieName, cookieValue, REFRESH_COOKIE_OPTIONS);

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const config = getAuthConfig();
  const jar = await cookies();
  jar.delete(config.cookieName);
  return NextResponse.json({ ok: true });
}
