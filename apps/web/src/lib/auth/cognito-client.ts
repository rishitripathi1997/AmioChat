'use client';

import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import type {
  AuthClient,
  AuthSession,
  ConfirmSignUpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
} from './types';

function createPool(userPoolId: string, clientId: string): CognitoUserPool {
  return new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId });
}

function userFromCognito(email: string, pool: CognitoUserPool): CognitoUser {
  return new CognitoUser({ Username: email, Pool: pool });
}

function sessionToAuth(session: import('amazon-cognito-identity-js').CognitoUserSession): AuthSession {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload() as Record<string, string>;
  return {
    user: {
      userId: payload.sub,
      email: payload.email ?? payload['cognito:username'] ?? '',
      displayName: payload.name ?? payload.email?.split('@')[0] ?? 'User',
    },
    tokens: {
      idToken: idToken.getJwtToken(),
      accessToken: session.getAccessToken().getJwtToken(),
      expiresAt: idToken.getExpiration() * 1000,
    },
  };
}

export function createCognitoAuthClient(
  userPoolId: string,
  clientId: string,
): AuthClient {
  const pool = createPool(userPoolId, clientId);

  return {
    signUp({ email, password, displayName }: SignUpInput) {
      return new Promise((resolve, reject) => {
        pool.signUp(
          email.trim().toLowerCase(),
          password,
          [new CognitoUserAttribute({ Name: 'email', Value: email.trim().toLowerCase() })],
          [],
          (err, result) => {
            if (err) return reject(err);
            resolve({ needsConfirmation: !result?.userConfirmed });
          },
        );
      });
    },

    confirmSignUp({ email, code }: ConfirmSignUpInput) {
      return new Promise((resolve, reject) => {
        const user = userFromCognito(email.trim().toLowerCase(), pool);
        user.confirmRegistration(code, false, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },

    signIn({ email, password }: SignInInput) {
      return new Promise((resolve, reject) => {
        const user = userFromCognito(email.trim().toLowerCase(), pool);
        user.authenticateUser(
          new AuthenticationDetails({
            Username: email.trim().toLowerCase(),
            Password: password,
          }),
          {
            onSuccess: (session) => resolve(sessionToAuth(session)),
            onFailure: (err) => reject(err),
            newPasswordRequired: () =>
              reject(new Error('Password change required — contact support')),
          },
        );
      });
    },

    forgotPassword({ email }: ForgotPasswordInput) {
      return new Promise((resolve, reject) => {
        const user = userFromCognito(email.trim().toLowerCase(), pool);
        user.forgotPassword({
          onSuccess: () => resolve(),
          onFailure: (err) => reject(err),
        });
      });
    },

    resetPassword({ email, code, newPassword }: ResetPasswordInput) {
      return new Promise((resolve, reject) => {
        const user = userFromCognito(email.trim().toLowerCase(), pool);
        user.confirmPassword(code, newPassword, {
          onSuccess: () => resolve(),
          onFailure: (err) => reject(err),
        });
      });
    },

    refreshSession(refreshToken: string) {
      return new Promise((resolve, reject) => {
        const user = new CognitoUser({
          Username: '_refresh_',
          Pool: pool,
        });
        user.refreshSession(
          { getToken: () => refreshToken } as never,
          (err, session) => {
            if (err || !session) return reject(err ?? new Error('Refresh failed'));
            resolve(sessionToAuth(session));
          },
        );
      });
    },
  };
}

export function getCognitoRefreshTokenFromSession(): Promise<string | null> {
  const poolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (!poolId || !clientId) return Promise.resolve(null);

  const pool = createPool(poolId, clientId);
  const current = pool.getCurrentUser();
  if (!current) return Promise.resolve(null);

  return new Promise((resolve) => {
    current.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) return resolve(null);
      resolve(session.getRefreshToken().getToken());
    });
  });
}
