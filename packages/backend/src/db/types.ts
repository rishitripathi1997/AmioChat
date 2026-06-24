import type {
  CallStatus,
  CallType,
  Conversation,
  Message,
  MessageType,
  PresenceStatus,
  User,
  UserPublic,
} from '@amiochat/shared';
import type { ChimeAttendeeInfo } from '../chime/types';

export interface SendMessageInput {
  convId: string;
  senderId: string;
  clientMsgId: string;
  type: MessageType;
  body?: string;
  mediaKey?: string;
}

export interface SendMessageResult {
  message: Message;
  isDuplicate: boolean;
}

export interface MarkReadResult {
  convId: string;
  userId: string;
  messageId: string;
  readAt: string;
}

export interface StoredCall {
  callId: string;
  convId: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  status: CallStatus;
  chimeMeetingId: string;
  mediaRegion: string;
  externalMeetingId: string;
  attendees: Record<string, ChimeAttendeeInfo>;
  createdAt: string;
}

export interface CreateCallRecordInput {
  convId: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  chimeMeetingId: string;
  mediaRegion: string;
  externalMeetingId: string;
  callerAttendee: ChimeAttendeeInfo;
}

export interface UserProfile extends User {
  avatarKey?: string;
}

export interface CreateConversationResult {
  conversation: Conversation;
  created: boolean;
}

export interface ListMessagesResult {
  messages: Message[];
  nextCursor: string | null;
}

export interface MediaUploadResult {
  uploadUrl: string;
  mediaKey: string;
  expiresAt: string;
}

export interface MediaDownloadResult {
  downloadUrl: string;
  expiresAt: string;
}

export interface DataRepository {
  getUserProfile(userId: string): Promise<UserProfile | null>;
  putUserProfile(profile: UserProfile): Promise<void>;
  searchUsersByEmail(query: string, excludeUserId: string): Promise<UserPublic[]>;
  listInbox(userId: string, limit: number): Promise<Conversation[]>;
  getOrCreateConversation(
    userId: string,
    participantId: string,
  ): Promise<CreateConversationResult>;
  isMember(convId: string, userId: string): Promise<boolean>;
  listMessages(
    convId: string,
    limit: number,
    cursor?: string,
    since?: string,
  ): Promise<ListMessagesResult>;
  storeMedia(mediaKey: string, data: Buffer, contentType: string): Promise<void>;
  getMedia(mediaKey: string): Promise<{ data: Buffer; contentType: string } | null>;
  createMediaUpload(
    convId: string,
    userId: string,
    filename: string,
    contentType: string,
    baseUrl: string,
  ): Promise<MediaUploadResult>;
  createMediaDownload(
    mediaKey: string,
    userId: string,
    baseUrl: string,
  ): Promise<MediaDownloadResult>;
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
  markRead(userId: string, convId: string, messageId: string): Promise<MarkReadResult>;
  updatePresence(userId: string, status: PresenceStatus): Promise<void>;
  getCall(callId: string): Promise<StoredCall | null>;
  getUserActiveCall(userId: string): Promise<StoredCall | null>;
  createCallRecord(input: CreateCallRecordInput): Promise<StoredCall>;
  updateCallStatus(callId: string, status: CallStatus): Promise<StoredCall>;
  saveCallAttendee(callId: string, userId: string, attendee: ChimeAttendeeInfo): Promise<StoredCall>;
  addSystemMessage(convId: string, body: string): Promise<Message>;
  finalizeCall(callId: string, systemMessage: string): Promise<StoredCall>;
}
