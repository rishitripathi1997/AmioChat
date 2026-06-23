import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getAuthConfig } from './config';
import type { AuthClient, AuthSession } from './types';

export function getServerAuthClient(): AuthClient {
  const config = getAuthConfig();
  if (config.mode === 'cognito' && config.cognito) {
    return createCognitoServerClient(config.cognito);
  }
  throw new Error('Server auth client is only used in cognito mode');
}

function createCognitoServerClient(cognito: {
  userPoolId: string;
  clientId: string;
  region: string;
}): AuthClient {
  const client = new CognitoIdentityProviderClient({ region: cognito.region });

  return {
    signUp: () =>
      Promise.reject(new Error('Sign up must be performed in the browser')),
    confirmSignUp: () =>
      Promise.reject(new Error('Confirm sign up must be performed in the browser')),
    signIn: () =>
      Promise.reject(new Error('Sign in must be performed in the browser')),
    forgotPassword: () =>
      Promise.reject(new Error('Forgot password must be performed in the browser')),
    resetPassword: () =>
      Promise.reject(new Error('Reset password must be performed in the browser')),

    async refreshSession(refreshToken: string): Promise<AuthSession> {
      const result = await client.send(
        new InitiateAuthCommand({
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          ClientId: cognito.clientId,
          AuthParameters: { REFRESH_TOKEN: refreshToken },
        }),
      );

      const auth = result.AuthenticationResult;
      if (!auth?.IdToken || !auth.AccessToken) {
        throw new Error('Failed to refresh session');
      }

      const payload = JSON.parse(
        Buffer.from(auth.IdToken.split('.')[1], 'base64url').toString('utf8'),
      ) as { sub: string; email?: string; name?: string; exp?: number };

      return {
        user: {
          userId: payload.sub,
          email: payload.email ?? '',
          displayName: payload.name ?? payload.email?.split('@')[0] ?? 'User',
        },
        tokens: {
          idToken: auth.IdToken,
          accessToken: auth.AccessToken,
          expiresAt: (payload.exp ?? 0) * 1000,
        },
      };
    },
  };
}

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};
