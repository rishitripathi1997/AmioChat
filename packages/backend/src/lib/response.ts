import type { APIGatewayProxyResultV2 } from 'aws-lambda';

export interface RestResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function json(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): RestResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export function toApiGatewayResult(response: RestResponse): APIGatewayProxyResultV2 {
  return response;
}

export function ok(body: unknown): RestResponse {
  return json(200, body);
}

export function notImplemented(path: string, method: string): RestResponse {
  return json(501, {
    code: 'NOT_IMPLEMENTED',
    message: `${method} ${path} is not implemented yet (Phase 4.4)`,
  });
}

export function unauthorized(message = 'Missing or invalid token'): RestResponse {
  return json(401, { code: 'UNAUTHORIZED', message });
}

export function badRequest(
  message: string,
  code = 'BAD_REQUEST',
): RestResponse {
  return json(400, { code, message });
}

export function forbidden(message = 'Forbidden'): RestResponse {
  return json(403, { code: 'FORBIDDEN', message });
}

export function notFound(message = 'Not found'): RestResponse {
  return json(404, { code: 'NOT_FOUND', message });
}
