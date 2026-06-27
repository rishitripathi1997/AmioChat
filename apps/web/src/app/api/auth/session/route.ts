import { NextResponse } from 'next/server';
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

  const response = NextResponse.json({ ok: true });
  response.cookies.set(config.cookieName, cookieValue, REFRESH_COOKIE_OPTIONS);
  return response;
}

export async function DELETE() {
  const config = getAuthConfig();
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(config.cookieName);
  return response;
}
