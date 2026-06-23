import type {
  Conversation,
  Message,
  MessageType,
  PresenceStatus,
  User,
  UserPublic,
} from '@amiochat/shared';

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
}
