/**
 * Runtime config for local dev vs deployed (Amplify + API Gateway).
 * Local: /api/v1 proxy + ws://localhost:3002
 * Deployed: NEXT_PUBLIC_API_URL + NEXT_PUBLIC_WS_URL from Terraform/SSM
 */

export function getApiBaseUrl(): string {
  const external = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (external) return external;
  return '/api/v1';
}

export function getWsUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3002';
}

export function isDirectApiMode(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_URL);
}

export function isCognitoMode(): boolean {
  const explicit = process.env.NEXT_PUBLIC_AUTH_MODE;
  if (explicit === 'mock' || explicit === 'cognito') {
    return explicit === 'cognito';
  }
  return Boolean(
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID &&
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
  );
}
