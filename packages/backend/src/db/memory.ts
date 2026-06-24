import { directConvId, type Conversation, type Message, type UserPublic } from '@amiochat/shared';
import type {
  CreateConversationResult,
  CreateCallRecordInput,
  DataRepository,
  ListMessagesResult,
  MarkReadResult,
  SendMessageInput,
  SendMessageResult,
  StoredCall,
  UserProfile,
} from './types';
import type { CallStatus, PresenceStatus } from '@amiochat/shared';
import type { ChimeAttendeeInfo } from '../chime/types';

function nowIso(): string {
  return new Date().toISOString();
}

function getGlobalStore() {
  const g = globalThis as typeof globalThis & {
    __amiochatDb?: {
      profiles: Map<string, UserProfile>;
      inbox: Map<string, Conversation>;
      messages: Map<string, Message[]>;
      media: Map<string, { data: Buffer; contentType: string }>;
      clientMsgIds: Map<string, string>;
      calls: Map<string, StoredCall>;
      userActiveCall: Map<string, string>;
      ringTimers: Map<string, ReturnType<typeof setTimeout>>;
    };
  };
  if (!g.__amiochatDb) {
    g.__amiochatDb = {
      profiles: new Map(),
      inbox: new Map(),
      messages: new Map(),
      media: new Map(),
      clientMsgIds: new Map(),
      calls: new Map(),
      userActiveCall: new Map(),
      ringTimers: new Map(),
    };
  }
  return g.__amiochatDb;
}

function inboxKey(userId: string, convId: string): string {
  return `${userId}#${convId}`;
}

function toPublic(profile: UserProfile): UserPublic {
  return {
    userId: profile.userId,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  };
}

export class MemoryRepository implements DataRepository {
  private store = getGlobalStore();

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return this.store.profiles.get(userId) ?? null;
  }

  async putUserProfile(profile: UserProfile): Promise<void> {
    this.store.profiles.set(profile.userId, { ...profile });
  }

  async searchUsersByEmail(query: string, excludeUserId: string): Promise<UserPublic[]> {
    const q = query.trim().toLowerCase();
    return [...this.store.profiles.values()]
      .filter((p) => p.userId !== excludeUserId && p.email.toLowerCase().includes(q))
      .slice(0, 20)
      .map(toPublic);
  }

  async listInbox(userId: string, limit: number): Promise<Conversation[]> {
    const prefix = `${userId}#`;
    return [...this.store.inbox.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, conv]) => conv)
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
      .slice(0, limit);
  }

  async getOrCreateConversation(
    userId: string,
    participantId: string,
  ): Promise<CreateConversationResult> {
    if (userId === participantId) {
      throw new Error('Cannot create conversation with yourself');
    }

    const participant = await this.getUserProfile(participantId);
    if (!participant) {
      throw new Error('NOT_FOUND');
    }

    const convId = directConvId(userId, participantId);
    const existing = this.store.inbox.get(inboxKey(userId, convId));
    if (existing) {
      return { conversation: existing, created: false };
    }

    const ts = nowIso();
    const me = await this.getUserProfile(userId);

    const convForUser: Conversation = {
      convId,
      participant: toPublic(participant),
      lastMessageAt: ts,
      lastMessagePreview: '',
      unreadCount: 0,
    };

    const convForOther: Conversation = {
      convId,
      participant: me
        ? toPublic(me)
        : { userId, email: '', displayName: 'User' },
      lastMessageAt: ts,
      lastMessagePreview: '',
      unreadCount: 0,
    };

    this.store.inbox.set(inboxKey(userId, convId), convForUser);
    this.store.inbox.set(inboxKey(participantId, convId), convForOther);
    this.store.messages.set(convId, []);

    return { conversation: convForUser, created: true };
  }

  async isMember(convId: string, userId: string): Promise<boolean> {
    return this.store.inbox.has(inboxKey(userId, convId));
  }

  async listMessages(
    convId: string,
    limit: number,
    cursor?: string,
    since?: string,
  ): Promise<ListMessagesResult> {
    let items = [...(this.store.messages.get(convId) ?? [])].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    if (since) {
      items = items.filter((m) => m.createdAt > since);
    }

    if (cursor) {
      const idx = items.findIndex((m) => m.messageId === cursor);
      if (idx >= 0) {
        items = items.slice(idx + 1);
      }
    }

    const page = items.slice(0, limit);
    const nextCursor =
      items.length > limit ? (page[page.length - 1]?.messageId ?? null) : null;

    return { messages: page, nextCursor };
  }

  async storeMedia(
    mediaKey: string,
    data: Buffer,
    contentType: string,
  ): Promise<void> {
    this.store.media.set(mediaKey, { data, contentType });
  }

  async getMedia(
    mediaKey: string,
  ): Promise<{ data: Buffer; contentType: string } | null> {
    return this.store.media.get(mediaKey) ?? null;
  }

  async createMediaUpload(
    convId: string,
    userId: string,
    filename: string,
    _contentType: string,
    baseUrl: string,
  ) {
    if (!(await this.isMember(convId, userId))) {
      throw new Error('FORBIDDEN');
    }

    const mediaKey = `attachments/${convId}/${crypto.randomUUID()}/${filename}`;
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

    return {
      uploadUrl: `${baseUrl}/media/upload?key=${encodeURIComponent(mediaKey)}`,
      mediaKey,
      expiresAt,
    };
  }

  async createMediaDownload(mediaKey: string, userId: string, baseUrl: string) {
    const convId = mediaKey.split('/')[1];
    if (!convId || !(await this.isMember(convId, userId))) {
      throw new Error('FORBIDDEN');
    }
    if (!this.store.media.has(mediaKey)) {
      throw new Error('NOT_FOUND');
    }

    return {
      downloadUrl: `${baseUrl}/media/download?key=${encodeURIComponent(mediaKey)}`,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { convId, senderId, clientMsgId, type, body, mediaKey } = input;

    if (!(await this.isMember(convId, senderId))) {
      throw new Error('FORBIDDEN');
    }

    if (type === 'text' && (!body || body.length > 4096)) {
      throw new Error('VALIDATION_ERROR');
    }
    if ((type === 'image' || type === 'file') && !mediaKey) {
      throw new Error('VALIDATION_ERROR');
    }

    const dedupeKey = `${senderId}#${clientMsgId}`;
    const existingId = this.store.clientMsgIds.get(dedupeKey);
    if (existingId) {
      const existing = (this.store.messages.get(convId) ?? []).find(
        (m) => m.messageId === existingId,
      );
      if (existing) {
        return { message: existing, isDuplicate: true };
      }
    }

    const createdAt = nowIso();
    const message = {
      messageId: crypto.randomUUID(),
      convId,
      senderId,
      type,
      body,
      mediaKey,
      status: 'sent' as const,
      createdAt,
    };

    const messages = this.store.messages.get(convId) ?? [];
    messages.push(message);
    this.store.messages.set(convId, messages);
    this.store.clientMsgIds.set(dedupeKey, message.messageId);

    const preview =
      type === 'text' ? (body ?? '').slice(0, 100) : `[${type}]`;

    for (const [key, conv] of this.store.inbox.entries()) {
      if (!key.endsWith(`#${convId}`)) continue;
      const isSender = key.startsWith(`${senderId}#`);
      conv.lastMessageAt = createdAt;
      conv.lastMessagePreview = preview;
      if (!isSender) {
        conv.unreadCount += 1;
      }
      this.store.inbox.set(key, { ...conv });
    }

    return { message, isDuplicate: false };
  }

  async markRead(
    userId: string,
    convId: string,
    messageId: string,
  ): Promise<MarkReadResult> {
    if (!(await this.isMember(convId, userId))) {
      throw new Error('FORBIDDEN');
    }

    const messages = this.store.messages.get(convId) ?? [];
    const target = messages.find((m) => m.messageId === messageId);
    if (!target) {
      throw new Error('NOT_FOUND');
    }

    const readAt = nowIso();
    for (const msg of messages) {
      if (msg.senderId !== userId && msg.createdAt <= target.createdAt) {
        msg.status = 'read';
      }
    }
    this.store.messages.set(convId, messages);

    const inboxEntry = this.store.inbox.get(inboxKey(userId, convId));
    if (inboxEntry) {
      inboxEntry.unreadCount = 0;
      this.store.inbox.set(inboxKey(userId, convId), { ...inboxEntry });
    }

    return { convId, userId, messageId, readAt };
  }

  async updatePresence(userId: string, status: PresenceStatus): Promise<void> {
    const profile = await this.getUserProfile(userId);
    if (!profile) return;
    profile.presence = status;
    if (status === 'offline') {
      profile.lastSeenAt = nowIso();
    }
    await this.putUserProfile(profile);
  }

  async getCall(callId: string): Promise<StoredCall | null> {
    return this.store.calls.get(callId) ?? null;
  }

  async getUserActiveCall(userId: string): Promise<StoredCall | null> {
    const callId = this.store.userActiveCall.get(userId);
    if (!callId) return null;
    return this.store.calls.get(callId) ?? null;
  }

  async createCallRecord(input: CreateCallRecordInput): Promise<StoredCall> {
    const callId = crypto.randomUUID();
    const record: StoredCall = {
      callId,
      convId: input.convId,
      callerId: input.callerId,
      calleeId: input.calleeId,
      type: input.type,
      status: 'ringing',
      chimeMeetingId: input.chimeMeetingId,
      mediaRegion: input.mediaRegion,
      externalMeetingId: input.externalMeetingId,
      attendees: { [input.callerId]: input.callerAttendee },
      createdAt: nowIso(),
    };

    this.store.calls.set(callId, record);
    this.store.userActiveCall.set(input.callerId, callId);
    this.store.userActiveCall.set(input.calleeId, callId);

    return record;
  }

  async updateCallStatus(callId: string, status: CallStatus): Promise<StoredCall> {
    const call = this.store.calls.get(callId);
    if (!call) throw new Error('NOT_FOUND');
    call.status = status;

    if (status === 'ended' || status === 'declined' || status === 'missed') {
      this.clearCallActive(call);
    }

    this.store.calls.set(callId, { ...call });
    return call;
  }

  async saveCallAttendee(
    callId: string,
    userId: string,
    attendee: ChimeAttendeeInfo,
  ): Promise<StoredCall> {
    const call = this.store.calls.get(callId);
    if (!call) throw new Error('NOT_FOUND');
    call.attendees[userId] = attendee;
    if (call.status === 'ringing') {
      call.status = 'connected';
    }
    this.store.calls.set(callId, { ...call });
    return call;
  }

  async addSystemMessage(convId: string, body: string): Promise<Message> {
    const createdAt = nowIso();
    const message: Message = {
      messageId: crypto.randomUUID(),
      convId,
      senderId: 'system',
      type: 'system',
      body,
      status: 'delivered',
      createdAt,
    };

    const messages = this.store.messages.get(convId) ?? [];
    messages.push(message);
    this.store.messages.set(convId, messages);

    for (const [key, conv] of this.store.inbox.entries()) {
      if (!key.endsWith(`#${convId}`)) continue;
      conv.lastMessageAt = createdAt;
      conv.lastMessagePreview = body.slice(0, 100);
      conv.unreadCount += 1;
      this.store.inbox.set(key, { ...conv });
    }

    return message;
  }

  scheduleRingTimeout(callId: string, onMissed: () => void): void {
    const existing = this.store.ringTimers.get(callId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.store.ringTimers.delete(callId);
      onMissed();
    }, 30_000);

    this.store.ringTimers.set(callId, timer);
  }

  clearRingTimeout(callId: string): void {
    const timer = this.store.ringTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      this.store.ringTimers.delete(callId);
    }
  }

  private clearCallActive(call: StoredCall): void {
    this.clearRingTimeout(call.callId);
    if (this.store.userActiveCall.get(call.callerId) === call.callId) {
      this.store.userActiveCall.delete(call.callerId);
    }
    if (this.store.userActiveCall.get(call.calleeId) === call.callId) {
      this.store.userActiveCall.delete(call.calleeId);
    }
  }

  async finalizeCall(callId: string, systemMessage: string): Promise<StoredCall> {
    const call = await this.updateCallStatus(callId, 'ended');
    await this.addSystemMessage(call.convId, systemMessage);
    return call;
  }
}

export function seedUserProfile(profile: UserProfile): void {
  const store = getGlobalStore();
  store.profiles.set(profile.userId, { ...profile });
}
