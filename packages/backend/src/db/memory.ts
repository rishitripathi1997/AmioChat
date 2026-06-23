import { directConvId, type Conversation, type Message, type UserPublic } from '@amiochat/shared';
import type {
  CreateConversationResult,
  DataRepository,
  ListMessagesResult,
  MarkReadResult,
  SendMessageInput,
  SendMessageResult,
  UserProfile,
} from './types';
import type { PresenceStatus } from '@amiochat/shared';

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
    };
  };
  if (!g.__amiochatDb) {
    g.__amiochatDb = {
      profiles: new Map(),
      inbox: new Map(),
      messages: new Map(),
      media: new Map(),
      clientMsgIds: new Map(),
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
}

export function seedUserProfile(profile: UserProfile): void {
  const store = getGlobalStore();
  store.profiles.set(profile.userId, { ...profile });
}
