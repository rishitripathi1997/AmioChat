import { NextResponse } from 'next/server';
import { getAuthConfig } from '@/lib/auth/config';
import {
  mockConfirmSignUp,
  mockForgotPassword,
  mockResetPassword,
  mockSignIn,
  mockSignUp,
} from '@/lib/auth/mock-store';

export async function POST(request: Request) {
  const config = getAuthConfig();
  if (config.mode !== 'mock') {
    return NextResponse.json({ error: 'Mock API disabled' }, { status: 403 });
  }

  const body = (await request.json()) as { action?: string } & Record<string, string>;

  try {
    switch (body.action) {
      case 'signUp':
        return NextResponse.json(
          mockSignUp({
            email: body.email,
            password: body.password,
            displayName: body.displayName,
          }),
        );

      case 'confirmSignUp':
        mockConfirmSignUp({ email: body.email, code: body.code });
        return NextResponse.json({ ok: true });

      case 'signIn':
        return NextResponse.json(
          mockSignIn({ email: body.email, password: body.password }),
        );

      case 'forgotPassword':
        mockForgotPassword({ email: body.email });
        return NextResponse.json({ ok: true });

      case 'resetPassword':
        mockResetPassword({
          email: body.email,
          code: body.code,
          newPassword: body.newPassword,
        });
        return NextResponse.json({ ok: true });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
