import type { MessageType, PresenceStatus } from './types';

export type WsClientAction =
  | 'authenticate'
  | 'sendMessage'
  | 'typing'
  | 'read'
  | 'presence'
  | 'callSignal'
  | 'ping';

export type WsServerEventName =
  | 'connected'
  | 'message.new'
  | 'message.ack'
  | 'typing'
  | 'read'
  | 'presence'
  | 'call.incoming'
  | 'call.updated'
  | 'pong'
  | 'error';

export interface WsClientEnvelope<T = unknown> {
  action: WsClientAction;
  payload: T;
  requestId?: string;
}

export interface WsServerEnvelope<T = unknown> {
  event: WsServerEventName;
  payload: T;
  requestId?: string;
}

export interface SendMessagePayload {
  convId: string;
  clientMsgId: string;
  type: MessageType;
  body?: string;
  mediaKey?: string | null;
}

export interface TypingPayload {
  convId: string;
  isTyping: boolean;
}

export interface ReadPayload {
  convId: string;
  messageId: string;
}

export interface PresencePayload {
  status: Exclude<PresenceStatus, 'offline'>;
}

export interface CallSignalPayload {
  callId: string;
  signal: 'accept' | 'decline' | 'end' | 'busy';
  payload?: Record<string, unknown>;
}

export function parseDirectConvParticipants(convId: string): string[] {
  const parts = convId.split('#');
  if (parts[0] !== 'direct' || parts.length !== 3) {
    return [];
  }
  return [parts[1], parts[2]];
}

export function otherParticipant(convId: string, userId: string): string | null {
  const participants = parseDirectConvParticipants(convId);
  return participants.find((id) => id !== userId) ?? null;
}
