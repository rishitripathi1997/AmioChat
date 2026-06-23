export interface AuthContext {
  userId: string;
  email: string;
}

export function parseToken(token: string | undefined | null): AuthContext | null {
  if (!token) return null;

  if (token.startsWith('mock.')) {
    try {
      const payloadPart = token.split('.')[1];
      const payload = JSON.parse(
        Buffer.from(payloadPart, 'base64url').toString('utf8'),
      ) as { sub?: string; email?: string };
      if (!payload.sub) return null;
      return { userId: payload.sub, email: payload.email ?? '' };
    } catch {
      return null;
    }
  }

  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as { sub?: string; email?: string };
    if (!payload.sub) return null;
    return { userId: payload.sub, email: payload.email ?? '' };
  } catch {
    return null;
  }
}

export function parseBearerToken(authHeader: string | undefined): AuthContext | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return parseToken(authHeader.slice(7));
}

export function parseApiGatewayAuth(event: {
  headers?: Record<string, string | undefined>;
  requestContext?: {
    authorizer?: { jwt?: { claims?: Record<string, string> } };
  };
}): AuthContext | null {
  const jwtClaims = event.requestContext?.authorizer?.jwt?.claims;
  if (jwtClaims?.sub) {
    return {
      userId: jwtClaims.sub,
      email: jwtClaims.email ?? jwtClaims['cognito:username'] ?? '',
    };
  }

  const authHeader =
    event.headers?.authorization ?? event.headers?.Authorization;
  return parseBearerToken(authHeader);
}
