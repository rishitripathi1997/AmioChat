import type {
  AuthClient,
  AuthSession,
  ConfirmSignUpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
} from './types';

type MockAction =
  | 'signUp'
  | 'confirmSignUp'
  | 'signIn'
  | 'forgotPassword'
  | 'resetPassword';

async function callMock<T>(action: MockAction, payload: object): Promise<T> {
  const res = await fetch('/api/auth/mock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Request failed');
  }
  return data;
}

/** Browser-safe mock auth client — delegates to server API routes. */
export function createMockAuthClient(): AuthClient {
  return {
    signUp: (input: SignUpInput) =>
      callMock<{ needsConfirmation: boolean }>('signUp', input),

    confirmSignUp: (input: ConfirmSignUpInput) =>
      callMock<{ ok: boolean }>('confirmSignUp', input).then(() => undefined),

    signIn: (input: SignInInput) =>
      callMock<AuthSession>('signIn', input),

    forgotPassword: (input: ForgotPasswordInput) =>
      callMock<{ ok: boolean }>('forgotPassword', input).then(() => undefined),

    resetPassword: (input: ResetPasswordInput) =>
      callMock<{ ok: boolean }>('resetPassword', input).then(() => undefined),

    refreshSession: () =>
      Promise.reject(new Error('Use /api/auth/refresh for session restore')),
  };
}
