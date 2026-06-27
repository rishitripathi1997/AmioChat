import { NextResponse } from 'next/server';
import { getAuthConfig } from '@/lib/auth/config';
import { REFRESH_COOKIE_OPTIONS } from '@/lib/auth/cookie-options';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const config = getAuthConfig();
  const body = (await request.json()) as { refreshToken?: string };

  if (!body.refreshToken) {
    return NextResponse.json({ error: 'Missing refresh token' }, { status: 400 });
  }

  let cookieValue = body.refreshToken;
  if (config.mode === 'mock') {
    const { signMockRefreshToken } = await import('@/lib/auth/mock-crypto');
    cookieValue = signMockRefreshToken(body.refreshToken, config.sessionSecret);
  }

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