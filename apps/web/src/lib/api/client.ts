import type {
  CallSessionResponse,
  CallType,
  ChimeAttendeeInfo,
  Conversation,
  Message,
  User,
  UserPublic,
} from '@amiochat/shared';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  idToken: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new ApiError(
      res.status,
      err.code ?? 'API_ERROR',
      err.message ?? res.statusText,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function getCurrentUser(idToken: string) {
  return request<User>('/users/me', idToken);
}

export function updateCurrentUser(
  idToken: string,
  input: { displayName?: string; avatarKey?: string },
) {
  return request<User>('/users/me', idToken, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function searchUsers(idToken: string, query: string) {
  return request<{ users: UserPublic[] }>(
    `/users/search?q=${encodeURIComponent(query)}`,
    idToken,
  );
}

export function listConversations(idToken: string, limit = 50) {
  return request<{ conversations: Conversation[] }>(
    `/conversations?limit=${limit}`,
    idToken,
  );
}

export function createConversation(idToken: string, participantId: string) {
  return request<Conversation>('/conversations', idToken, {
    method: 'POST',
    body: JSON.stringify({ participantId }),
  });
}

export function listMessages(
  idToken: string,
  convId: string,
  params: { limit?: number; cursor?: string; since?: string } = {},
) {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.since) qs.set('since', params.since);
  const suffix = qs.toString() ? `?${qs}` : '';
  return request<{ messages: Message[]; nextCursor: string | null }>(
    `/conversations/${encodeURIComponent(convId)}/messages${suffix}`,
    idToken,
  );
}

export function createUploadUrl(
  idToken: string,
  input: { convId: string; filename: string; contentType: string },
) {
  return request<{ uploadUrl: string; mediaKey: string; expiresAt: string }>(
    '/media/upload-url',
    idToken,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function uploadMedia(
  idToken: string,
  convId: string,
  file: File,
): Promise<{ mediaKey: string }> {
  const { uploadUrl, mediaKey } = await createUploadUrl(idToken, {
    convId,
    filename: file.name,
    contentType: file.type,
  });

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new ApiError(uploadRes.status, 'UPLOAD_FAILED', 'Failed to upload file');
  }

  return { mediaKey };
}

export function createDownloadUrl(idToken: string, mediaKey: string) {
  return request<{ downloadUrl: string; expiresAt: string }>(
    '/media/download-url',
    idToken,
    { method: 'POST', body: JSON.stringify({ mediaKey }) },
  );
}

export function getHealth() {
  return fetch(`${API_BASE}/health`).then((r) => r.json());
}

export function createCall(idToken: string, convId: string, type: CallType) {
  return request<CallSessionResponse>('/calls', idToken, {
    method: 'POST',
    body: JSON.stringify({ convId, type }),
  });
}

export function joinCall(idToken: string, callId: string) {
  return request<ChimeAttendeeInfo & { chimeMeeting: CallSessionResponse['chimeMeeting'] }>(
    `/calls/${encodeURIComponent(callId)}/join`,
    idToken,
    { method: 'POST', body: '{}' },
  );
}

export function endCall(idToken: string, callId: string) {
  return request<void>(`/calls/${encodeURIComponent(callId)}`, idToken, {
    method: 'DELETE',
  });
}
