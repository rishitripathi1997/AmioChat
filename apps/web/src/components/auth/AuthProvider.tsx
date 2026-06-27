'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getPublicAuthMode } from '@/lib/auth/config';
import { createCognitoAuthClient, getCognitoRefreshTokenFromSession } from '@/lib/auth/cognito-client';
import { createMockAuthClient } from '@/lib/auth/mock-client';
import type {
  AuthClient,
  AuthSession,
  AuthUser,
  ConfirmSignUpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
} from '@/lib/auth/types';

interface AuthContextValue {
  mode: 'mock' | 'cognito';
  user: AuthUser | null;
  idToken: string | null;
  loading: boolean;
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>;
  confirmSignUp: (input: ConfirmSignUpInput) => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (input: ForgotPasswordInput) => Promise<void>;
  resetPassword: (input: ResetPasswordInput) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getClientAuth(): AuthClient {
  const mode = getPublicAuthMode();
  if (mode === 'cognito') {
    const poolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!;
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;
    return createCognitoAuthClient(poolId, clientId);
  }
  return createMockAuthClient();
}

async function persistSession(session: AuthSession, refreshToken?: string) {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken:
        refreshToken ??
        (getPublicAuthMode() === 'mock'
          ? session.user.userId
          : await getCognitoRefreshTokenFromSession()),
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Failed to persist session');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mode = getPublicAuthMode();
  const client = useMemo(() => getClientAuth(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((session: AuthSession | null) => {
    if (!session) {
      setUser(null);
      setIdToken(null);
      return;
    }
    setUser(session.user);
    setIdToken(session.tokens.idToken);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (res.ok) {
          const session = (await res.json()) as AuthSession;
          if (!cancelled) applySession(session);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const signIn = useCallback(
    async (input: SignInInput) => {
      const session = await client.signIn(input);
      await persistSession(session, session.refreshToken);
      applySession(session);
    },
    [applySession, client],
  );

  const signUp = useCallback(
    (input: SignUpInput) => client.signUp(input),
    [client],
  );

  const confirmSignUp = useCallback(
    (input: ConfirmSignUpInput) => client.confirmSignUp(input),
    [client],
  );

  const forgotPassword = useCallback(
    (input: ForgotPasswordInput) => client.forgotPassword(input),
    [client],
  );

  const resetPassword = useCallback(
    (input: ResetPasswordInput) => client.resetPassword(input),
    [client],
  );

  const signOut = useCallback(async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    applySession(null);
  }, [applySession]);

  const value: AuthContextValue = {
    mode,
    user,
    idToken,
    loading,
    signUp,
    confirmSignUp,
    signIn,
    signOut,
    forgotPassword,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
