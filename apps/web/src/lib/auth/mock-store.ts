import type {
  AuthSession,
  ConfirmSignUpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
} from './types';
import { seedUserProfile } from '@amiochat/backend';

interface MockStoredUser {
  userId: string;
  email: string;
  displayName: string;
  password: string;
  confirmed: boolean;
}

function getStore(): Map<string, MockStoredUser> {
  const g = globalThis as typeof globalThis & {
    __amiochatMockUsers?: Map<string, MockStoredUser>;
  };
  if (!g.__amiochatMockUsers) {
    g.__amiochatMockUsers = new Map();
  }
  return g.__amiochatMockUsers;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function issueTokens(userId: string, email: string): AuthSession['tokens'] {
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, email, iat: now, exp: now + 3600_000 }),
  ).toString('base64url');

  return {
    idToken: `mock.${payload}.sig`,
    accessToken: `mock-access.${payload}.sig`,
    expiresAt: now + 3600_000,
  };
}

function syncProfile(user: MockStoredUser) {
  seedUserProfile({
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    presence: 'online',
  });
}

function toSession(user: MockStoredUser): AuthSession {
  syncProfile(user);
  return {
    user: {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
    },
    tokens: issueTokens(user.userId, user.email),
  };
}

export function mockSignUp({ email, password, displayName }: SignUpInput) {
  const store = getStore();
  const key = normalizeEmail(email);
  if (store.has(key)) {
    throw new Error('An account with this email already exists');
  }

  store.set(key, {
    userId: crypto.randomUUID(),
    email: key,
    displayName: displayName.trim() || key.split('@')[0],
    password,
    confirmed: false,
  });

  return { needsConfirmation: true };
}

export function mockConfirmSignUp({ email, code }: ConfirmSignUpInput) {
  const store = getStore();
  const key = normalizeEmail(email);
  const user = store.get(key);
  if (!user) {
    throw new Error('User not found');
  }
  if (code !== '123456' && code.length < 4) {
    throw new Error('Invalid verification code (mock: use 123456)');
  }
  user.confirmed = true;
  store.set(key, user);
  syncProfile(user);
}

export function mockSignIn({ email, password }: SignInInput): AuthSession {
  const store = getStore();
  const key = normalizeEmail(email);
  const user = store.get(key);
  if (!user || user.password !== password) {
    throw new Error('Invalid email or password');
  }
  if (!user.confirmed) {
    throw new Error('CONFIRM_SIGN_UP');
  }
  return toSession(user);
}

export function mockForgotPassword({ email }: ForgotPasswordInput) {
  const store = getStore();
  const key = normalizeEmail(email);
  if (!store.has(key)) {
    throw new Error('If an account exists, a reset code was sent');
  }
}

export function mockResetPassword({ email, code, newPassword }: ResetPasswordInput) {
  const store = getStore();
  const key = normalizeEmail(email);
  const user = store.get(key);
  if (!user) {
    throw new Error('User not found');
  }
  if (code !== '123456') {
    throw new Error('Invalid reset code (mock: use 123456)');
  }
  user.password = newPassword;
  store.set(key, user);
}

export function mockRefreshSession(userId: string): AuthSession {
  const store = getStore();
  const user = [...store.values()].find((u) => u.userId === userId);
  if (!user || !user.confirmed) {
    throw new Error('Session expired');
  }
  return toSession(user);
}

export function createMockRefreshToken(userId: string): string {
  return Buffer.from(JSON.stringify({ userId, v: 1 })).toString('base64url');
}
