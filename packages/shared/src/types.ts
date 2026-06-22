export type MessageType = 'text' | 'image' | 'file' | 'system';
export type MessageStatus = 'sent' | 'delivered' | 'read';
export type PresenceStatus = 'online' | 'offline' | 'away';
export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'connected' | 'declined' | 'missed' | 'ended';

export interface User {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  presence?: PresenceStatus;
  lastSeenAt?: string;
}

export interface UserPublic {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Conversation {
  convId: string;
  participant: UserPublic;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
}

export interface Message {
  messageId: string;
  convId: string;
  senderId: string;
  type: MessageType;
  body?: string;
  mediaKey?: string;
  mediaUrl?: string;
  status: MessageStatus;
  createdAt: string;
}

export interface Call {
  callId: string;
  convId: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  status: CallStatus;
  chimeMeetingId: string;
}

export function directConvId(userA: string, userB: string): string {
  const [a, b] = [userA, userB].sort();
  return `direct#${a}#${b}`;
}
