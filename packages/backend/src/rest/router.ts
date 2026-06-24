import type { CallType } from '@amiochat/shared';
import type { AuthContext } from '../lib/auth';
import { parseApiGatewayAuth, parseBearerToken } from '../lib/auth';
import {
  badRequest,
  forbidden,
  json,
  notFound,
  unauthorized,
  type RestResponse,
} from '../lib/response';
import * as calls from '../services/calls';
import * as conversations from '../services/conversations';
import * as media from '../services/media';
import * as messages from '../services/messages';
import * as users from '../services/users';

export interface RestRequest {
  method: string;
  path: string;
  query: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
  body?: string;
}

export type { RestResponse } from '../lib/response';

export interface RestHandlerOptions {
  mediaBaseUrl?: string;
}

function parseBody<T>(body?: string): T | null {
  if (!body) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

function toUserResponse(profile: Awaited<ReturnType<typeof users.getCurrentUser>>) {
  return {
    userId: profile.userId,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    presence: profile.presence,
    lastSeenAt: profile.lastSeenAt,
  };
}

function mapError(error: unknown): RestResponse {
  const message = error instanceof Error ? error.message : 'Unknown error';

  switch (message) {
    case 'VALIDATION_ERROR':
      return badRequest('Invalid request', 'VALIDATION_ERROR');
    case 'FORBIDDEN':
      return forbidden('Not a conversation member');
    case 'NOT_FOUND':
      return notFound('Resource not found');
    case 'CALL_IN_PROGRESS':
      return json(409, { code: 'CALL_IN_PROGRESS', message: 'You are already in a call' });
    case 'CALLEE_BUSY':
      return json(409, { code: 'CALLEE_BUSY', message: 'User is already in a call' });
    case 'CALL_ENDED':
      return json(410, { code: 'CALL_ENDED', message: 'Call has already ended' });
    default:
      if (message === 'Cannot create conversation with yourself') {
        return badRequest(message, 'VALIDATION_ERROR');
      }
      return badRequest(message);
  }
}

function emptyResponse(statusCode: number): RestResponse {
  return { statusCode, headers: {}, body: '' };
}

export async function handleRestRequest(
  req: RestRequest,
  options: RestHandlerOptions = {},
): Promise<RestResponse> {
  const { method, path, query, headers, body } = req;
  const mediaBaseUrl =
    options.mediaBaseUrl ??
    process.env.MEDIA_BASE_URL ??
    'http://localhost:3000/api';

  if (method === 'GET' && path === '/health') {
    return json(200, {
      status: 'ok',
      service: 'amiochat-rest',
      environment: process.env.ENVIRONMENT ?? 'local',
    });
  }

  const auth: AuthContext | null =
    headers['x-amiochat-auth'] && headers['x-amiochat-email']
      ? {
          userId: headers['x-amiochat-auth']!,
          email: headers['x-amiochat-email']!,
        }
      : parseBearerToken(headers.authorization ?? headers.Authorization);

  if (!auth) {
    return unauthorized();
  }

  try {
    if (method === 'GET' && path === '/users/me') {
      const profile = await users.getCurrentUser(auth);
      return json(200, toUserResponse(profile));
    }

    if (method === 'PATCH' && path === '/users/me') {
      const input = parseBody<{ displayName?: string; avatarKey?: string }>(body);
      if (!input) {
        return badRequest('Invalid JSON body');
      }
      const profile = await users.updateCurrentUser(auth, input);
      return json(200, toUserResponse(profile));
    }

    if (method === 'GET' && path === '/users/search') {
      const q = query.q ?? '';
      const result = await users.searchUsers(auth, q);
      return json(200, result);
    }

    if (method === 'GET' && path === '/conversations') {
      const limit = Math.min(Number(query.limit ?? 50) || 50, 100);
      const result = await conversations.listConversations(auth, limit);
      return json(200, result);
    }

    if (method === 'POST' && path === '/conversations') {
      const input = parseBody<{ participantId?: string }>(body);
      if (!input?.participantId) {
        return badRequest('participantId is required');
      }
      const { conversation, created } = await conversations.createConversation(
        auth,
        input.participantId,
      );
      return json(created ? 201 : 200, conversation);
    }

    const messagesMatch = path.match(/^\/conversations\/([^/]+)\/messages$/);
    if (messagesMatch && method === 'GET') {
      const convId = decodeURIComponent(messagesMatch[1]);
      const limit = Math.min(Number(query.limit ?? 50) || 50, 100);
      const result = await messages.listMessages(
        auth,
        convId,
        limit,
        query.cursor,
        query.since,
      );
      return json(200, result);
    }

    if (method === 'POST' && path === '/media/upload-url') {
      const input = parseBody<{
        convId?: string;
        filename?: string;
        contentType?: string;
      }>(body);
      if (!input?.convId || !input.filename || !input.contentType) {
        return badRequest('convId, filename, and contentType are required');
      }
      const result = await media.createUploadUrl(
        auth,
        input.convId,
        input.filename,
        input.contentType,
        mediaBaseUrl,
      );
      return json(200, result);
    }

    if (method === 'POST' && path === '/media/download-url') {
      const input = parseBody<{ mediaKey?: string }>(body);
      if (!input?.mediaKey) {
        return badRequest('mediaKey is required');
      }
      const result = await media.createDownloadUrl(auth, input.mediaKey, mediaBaseUrl);
      return json(200, result);
    }

    if (method === 'POST' && path === '/calls') {
      const input = parseBody<{ convId?: string; type?: CallType }>(body);
      if (!input?.convId || !input.type) {
        return badRequest('convId and type are required');
      }
      if (input.type !== 'voice' && input.type !== 'video') {
        return badRequest('type must be voice or video');
      }
      const session = await calls.createCall(auth, input.convId, input.type);
      return json(201, session);
    }

    const joinMatch = path.match(/^\/calls\/([^/]+)\/join$/);
    if (joinMatch && method === 'POST') {
      const callId = decodeURIComponent(joinMatch[1]);
      const attendee = await calls.joinCall(auth, callId);
      return json(200, attendee);
    }

    const callMatch = path.match(/^\/calls\/([^/]+)$/);
    if (callMatch && method === 'DELETE') {
      const callId = decodeURIComponent(callMatch[1]);
      await calls.endCall(auth, callId);
      return emptyResponse(204);
    }

    return notFound(`Route not found: ${method} ${path}`);
  } catch (error) {
    return mapError(error);
  }
}

export function fromApiGatewayEvent(event: {
  rawPath: string;
  queryStringParameters?: Record<string, string | undefined> | null;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  requestContext: {
    http: { method: string };
    authorizer?: { jwt?: { claims?: Record<string, string> } };
  };
}): RestRequest {
  return {
    method: event.requestContext.http.method,
    path: event.rawPath,
    query: event.queryStringParameters ?? {},
    headers: event.headers ?? {},
    body: event.body ?? undefined,
  };
}

export async function handleApiGatewayEvent(
  event: Parameters<typeof fromApiGatewayEvent>[0],
  options?: RestHandlerOptions,
): Promise<RestResponse> {
  const req = fromApiGatewayEvent(event);
  const auth = parseApiGatewayAuth(event);

  if (auth) {
    req.headers = {
      ...req.headers,
      'x-amiochat-auth': auth.userId,
      'x-amiochat-email': auth.email,
    };
  }

  return handleRestRequest(req, options);
}
