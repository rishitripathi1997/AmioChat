import type { AuthMode } from './types';

export interface AuthConfig {
  mode: AuthMode;
  cognito: {
    userPoolId: string;
    clientId: string;
    region: string;
  } | null;
  sessionSecret: string;
  cookieName: string;
}

function readAuthMode(): AuthMode {
  const explicit = process.env.NEXT_PUBLIC_AUTH_MODE;
  if (explicit === 'mock' || explicit === 'cognito') {
    return explicit;
  }

  const hasCognito =
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID &&
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  return hasCognito ? 'cognito' : 'mock';
}

export function getAuthConfig(): AuthConfig {
  const mode = readAuthMode();
  const region = process.env.NEXT_PUBLIC_AWS_REGION ?? 'us-east-1';
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '';
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '';

  return {
    mode,
    cognito:
      mode === 'cognito' && userPoolId && clientId
        ? { userPoolId, clientId, region }
        : null,
    sessionSecret:
      process.env.AUTH_SESSION_SECRET ?? 'dev-only-change-me-in-production',
    cookieName: 'amiochat_refresh',
  };
}

export function getPublicAuthMode(): AuthMode {
  return getAuthConfig().mode;
}
