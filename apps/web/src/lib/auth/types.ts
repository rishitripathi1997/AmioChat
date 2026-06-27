export type AuthMode = 'mock' | 'cognito';

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  expiresAt: number;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
  /** Present after sign-in; used once to set the httpOnly refresh cookie. */
  refreshToken?: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface ConfirmSignUpInput {
  email: string;
  code: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  email: string;
  code: string;
  newPassword: string;
}

export interface AuthClient {
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>;
  confirmSignUp(input: ConfirmSignUpInput): Promise<void>;
  signIn(input: SignInInput): Promise<AuthSession>;
  forgotPassword(input: ForgotPasswordInput): Promise<void>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  refreshSession(refreshToken: string): Promise<AuthSession>;
}
