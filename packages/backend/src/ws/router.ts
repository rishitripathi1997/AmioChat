import type {
  WsClientEnvelope,
  WsServerEnvelope,
} from '@amiochat/shared';
import { otherParticipant } from '@amiochat/shared';
import { getRepository } from '../db';
import type { AuthContext } from '../lib/auth';
import * as callService from '../services/calls';
import { getConnectionRepository } from './connections';
import type { WsPublisher } from './publisher';
import { checkRateLimit } from './rate-limit';

export interface WsHandlerContext {
  auth: AuthContext;
  connectionId: string;
  publisher: WsPublisher;
}

function errorEvent(
  code: string,
  message: string,
  requestId?: string,
): WsServerEnvelope {
  return {
    event: 'error',
    payload: { code, message, requestId },
    requestId,
  };
}

function mapError(error: unknown, requestId?: string): WsServerEnvelope {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  switch (msg) {
    case 'FORBIDDEN':
      return errorEvent('FORBIDDEN', 'Not a member of this conversation', requestId);
    case 'NOT_FOUND':
      return errorEvent('NOT_FOUND', 'Resource not found', requestId);
    case 'VALIDATION_ERROR':
      return errorEvent('VALIDATION_ERROR', 'Invalid payload', requestId);
    default:
      return errorEvent('INTERNAL_ERROR', msg, requestId);
  }
}

export async function handleConnect(ctx: WsHandlerContext): Promise<WsServerEnvelope[]> {
  const repo = getRepository();
  const connections = getConnectionRepository();

  await connections.addConnection(ctx.auth.userId, ctx.connectionId);
  await repo.updatePresence(ctx.auth.userId, 'online');

  const otherUserIds = new Set<string>();
  const inbox = await repo.listInbox(ctx.auth.userId, 100);
  for (const conv of inbox) {
    const other = otherParticipant(conv.convId, ctx.auth.userId);
    if (other) otherUserIds.add(other);
  }

  await ctx.publisher.send(ctx.connectionId, {
    event: 'connected',
    payload: {
      userId: ctx.auth.userId,
      connectionId: ctx.connectionId,
    },
  });

  for (const userId of otherUserIds) {
    await ctx.publisher.sendToUser(userId, {
      event: 'presence',
      payload: {
        userId: ctx.auth.userId,
        status: 'online',
        lastSeenAt: null,
      },
    });
  }

  return [];
}

export async function handleDisconnect(connectionId: string): Promise<void> {
  const repo = getRepository();
  const connections = getConnectionRepository();
  const userId = await connections.removeConnection(connectionId);
  if (!userId) return;

  const remaining = await connections.countUserConnections(userId);
  if (remaining === 0) {
    await repo.updatePresence(userId, 'offline');
    const profile = await repo.getUserProfile(userId);
    const inbox = await repo.listInbox(userId, 100);
    const notified = new Set<string>();

    for (const conv of inbox) {
      const other = otherParticipant(conv.convId, userId);
      if (!other || notified.has(other)) continue;
      notified.add(other);
      // presence broadcast handled by caller with publisher if needed
    }

    if (profile) {
      // offline presence is pushed from handler with publisher
    }
  }
}

export async function handleWsAction(
  ctx: WsHandlerContext,
  envelope: WsClientEnvelope,
): Promise<WsServerEnvelope[]> {
  const { action, payload, requestId } = envelope;

  if (!checkRateLimit(ctx.auth.userId, action)) {
    return [errorEvent('RATE_LIMITED', 'Too many requests', requestId)];
  }

  try {
    switch (action) {
      case 'ping':
        return [{ event: 'pong', payload: {}, requestId }];

      case 'sendMessage':
        return handleSendMessage(ctx, payload as Parameters<typeof handleSendMessage>[1], requestId);

      case 'typing':
        return handleTyping(ctx, payload as Parameters<typeof handleTyping>[1], requestId);

      case 'read':
        return handleRead(ctx, payload as Parameters<typeof handleRead>[1], requestId);

      case 'presence':
        return handlePresence(ctx, payload as Parameters<typeof handlePresence>[1], requestId);

      case 'callSignal':
        return handleCallSignal(
          ctx,
          payload as { callId?: string; signal?: string },
          requestId,
        );

      default:
        return [errorEvent('VALIDATION_ERROR', `Unknown action: ${action}`, requestId)];
    }
  } catch (error) {
    return [mapError(error, requestId)];
  }
}

async function handleSendMessage(
  ctx: WsHandlerContext,
  payload: {
    convId?: string;
    clientMsgId?: string;
    type?: string;
    body?: string;
    mediaKey?: string | null;
  },
  requestId?: string,
): Promise<WsServerEnvelope[]> {
  if (!payload.convId || !payload.clientMsgId || !payload.type) {
    return [errorEvent('VALIDATION_ERROR', 'convId, clientMsgId, and type are required', requestId)];
  }

  const repo = getRepository();
  const { message, isDuplicate } = await repo.sendMessage({
    convId: payload.convId,
    senderId: ctx.auth.userId,
    clientMsgId: payload.clientMsgId,
    type: payload.type as 'text' | 'image' | 'file',
    body: payload.body,
    mediaKey: payload.mediaKey ?? undefined,
  });

  const ack: WsServerEnvelope = {
    event: 'message.ack',
    payload: {
      clientMsgId: payload.clientMsgId,
      messageId: message.messageId,
      status: 'sent',
    },
    requestId,
  };

  if (isDuplicate) {
    return [ack];
  }

  const recipient = otherParticipant(payload.convId, ctx.auth.userId);
  if (recipient) {
    await ctx.publisher.sendToUser(recipient, {
      event: 'message.new',
      payload: {
        ...message,
        status: 'delivered',
      },
    });
  }

  return [ack];
}

async function handleTyping(
  ctx: WsHandlerContext,
  payload: { convId?: string; isTyping?: boolean },
  requestId?: string,
): Promise<WsServerEnvelope[]> {
  if (!payload.convId || payload.isTyping === undefined) {
    return [errorEvent('VALIDATION_ERROR', 'convId and isTyping are required', requestId)];
  }

  const repo = getRepository();
  if (!(await repo.isMember(payload.convId, ctx.auth.userId))) {
    throw new Error('FORBIDDEN');
  }

  const recipient = otherParticipant(payload.convId, ctx.auth.userId);
  if (recipient) {
    await ctx.publisher.sendToUser(recipient, {
      event: 'typing',
      payload: {
        convId: payload.convId,
        userId: ctx.auth.userId,
        isTyping: payload.isTyping,
      },
    });
  }

  return [];
}

async function handleRead(
  ctx: WsHandlerContext,
  payload: { convId?: string; messageId?: string },
  requestId?: string,
): Promise<WsServerEnvelope[]> {
  if (!payload.convId || !payload.messageId) {
    return [errorEvent('VALIDATION_ERROR', 'convId and messageId are required', requestId)];
  }

  const repo = getRepository();
  const result = await repo.markRead(
    ctx.auth.userId,
    payload.convId,
    payload.messageId,
  );

  const recipient = otherParticipant(payload.convId, ctx.auth.userId);
  if (recipient) {
    await ctx.publisher.sendToUser(recipient, {
      event: 'read',
      payload: result,
    });
  }

  return [];
}

async function handlePresence(
  ctx: WsHandlerContext,
  payload: { status?: 'online' | 'away' },
  requestId?: string,
): Promise<WsServerEnvelope[]> {
  if (!payload.status || !['online', 'away'].includes(payload.status)) {
    return [errorEvent('VALIDATION_ERROR', 'status must be online or away', requestId)];
  }

  const repo = getRepository();
  await repo.updatePresence(ctx.auth.userId, payload.status);

  const inbox = await repo.listInbox(ctx.auth.userId, 100);
  const notified = new Set<string>();
  for (const conv of inbox) {
    const other = otherParticipant(conv.convId, ctx.auth.userId);
    if (!other || notified.has(other)) continue;
    notified.add(other);
    await ctx.publisher.sendToUser(other, {
      event: 'presence',
      payload: {
        userId: ctx.auth.userId,
        status: payload.status,
        lastSeenAt: null,
      },
    });
  }

  return [];
}

async function handleCallSignal(
  ctx: WsHandlerContext,
  payload: { callId?: string; signal?: string },
  requestId?: string,
): Promise<WsServerEnvelope[]> {
  if (!payload.callId || !payload.signal) {
    return [errorEvent('VALIDATION_ERROR', 'callId and signal are required', requestId)];
  }

  const valid = ['accept', 'decline', 'end', 'busy'];
  if (!valid.includes(payload.signal)) {
    return [errorEvent('VALIDATION_ERROR', 'Invalid call signal', requestId)];
  }

  await callService.handleCallSignal(
    ctx.auth,
    payload.callId,
    payload.signal as 'accept' | 'decline' | 'end' | 'busy',
  );
  return [];
}

export async function broadcastOfflinePresence(
  publisher: WsPublisher,
  userId: string,
): Promise<void> {
  const repo = getRepository();
  const profile = await repo.getUserProfile(userId);
  const inbox = await repo.listInbox(userId, 100);
  const notified = new Set<string>();

  for (const conv of inbox) {
    const other = otherParticipant(conv.convId, userId);
    if (!other || notified.has(other)) continue;
    notified.add(other);
    await publisher.sendToUser(other, {
      event: 'presence',
      payload: {
        userId,
        status: 'offline',
        lastSeenAt: profile?.lastSeenAt ?? new Date().toISOString(),
      },
    });
  }
}
