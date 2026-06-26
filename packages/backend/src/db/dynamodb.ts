import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { directConvId, type Conversation, type Message, type UserPublic } from '@amiochat/shared';
import type { CallStatus, PresenceStatus } from '@amiochat/shared';
import type { ChimeAttendeeInfo } from '../chime/types';
import {
  getDocClient,
  getTableName,
  nowIso,
  parseDirectConvId,
  ttlSecondsFromNow,
} from './dynamodb-client';
import type {
  CreateCallRecordInput,
  CreateConversationResult,
  DataRepository,
  ListMessagesResult,
  MarkReadResult,
  SendMessageInput,
  SendMessageResult,
  StoredCall,
  UserProfile,
} from './types';

const s3 = new S3Client({});

function toPublic(profile: UserProfile): UserPublic {
  return {
    userId: profile.userId,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  };
}

function profileFromItem(item: Record<string, unknown>): UserProfile {
  return {
    userId: item.userId as string,
    email: item.email as string,
    displayName: item.displayName as string,
    avatarUrl: item.avatarUrl as string | undefined,
    avatarKey: item.avatarKey as string | undefined,
    presence: item.presence as PresenceStatus | undefined,
    lastSeenAt: item.lastSeenAt as string | undefined,
    createdAt: item.createdAt as string | undefined,
    updatedAt: item.updatedAt as string | undefined,
  } as UserProfile;
}

function messageFromItem(item: Record<string, unknown>): Message {
  return {
    messageId: item.messageId as string,
    convId: item.convId as string,
    senderId: item.senderId as string,
    type: item.type as Message['type'],
    body: item.body as string | undefined,
    mediaKey: item.mediaKey as string | undefined,
    status: item.status as Message['status'],
    createdAt: item.createdAt as string,
  };
}

function callFromItem(item: Record<string, unknown>): StoredCall {
  const attendees = item.attendees;
  return {
    callId: item.callId as string,
    convId: item.convId as string,
    callerId: item.callerId as string,
    calleeId: item.calleeId as string,
    type: item.type as StoredCall['type'],
    status: item.status as CallStatus,
    chimeMeetingId: item.chimeMeetingId as string,
    mediaRegion: item.mediaRegion as string,
    externalMeetingId: item.externalMeetingId as string,
    attendees:
      typeof attendees === 'string'
        ? (JSON.parse(attendees) as Record<string, ChimeAttendeeInfo>)
        : ((attendees as Record<string, ChimeAttendeeInfo>) ?? {}),
    createdAt: item.createdAt as string,
  };
}

function getMediaBucket(): string {
  const bucket = process.env.MEDIA_BUCKET_NAME;
  if (!bucket) {
    throw new Error('MEDIA_BUCKET_NAME is required');
  }
  return bucket;
}

export class DynamoRepository implements DataRepository {
  private table = getTableName();
  private doc = getDocClient();

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { Item } = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      }),
    );
    if (!Item) return null;

    const profile = profileFromItem(Item);
    const presence = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: `USER#${userId}`, SK: 'PRESENCE' },
      }),
    );
    if (presence.Item) {
      profile.presence = presence.Item.status as PresenceStatus;
      profile.lastSeenAt = presence.Item.lastSeenAt as string | undefined;
    }
    return profile;
  }

  async putUserProfile(profile: UserProfile): Promise<void> {
    const now = nowIso();
    await this.doc.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          PK: `USER#${profile.userId}`,
          SK: 'PROFILE',
          entityType: 'UserProfile',
          userId: profile.userId,
          email: profile.email.toLowerCase(),
          displayName: profile.displayName,
          avatarKey: profile.avatarKey,
          avatarUrl: profile.avatarUrl,
          createdAt: (profile as UserProfile & { createdAt?: string }).createdAt ?? now,
          updatedAt: now,
          GSI1PK: `EMAIL#${profile.email.toLowerCase()}`,
          GSI1SK: `USER#${profile.userId}`,
        },
      }),
    );
  }

  async searchUsersByEmail(query: string, excludeUserId: string): Promise<UserPublic[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const { Items = [] } = await this.doc.send(
      new ScanCommand({
        TableName: this.table,
        FilterExpression: 'entityType = :type AND contains(email, :q)',
        ExpressionAttributeValues: {
          ':type': 'UserProfile',
          ':q': q,
        },
        Limit: 40,
      }),
    );

    return Items.map((item) => toPublic(profileFromItem(item)))
      .filter((user) => user.userId !== excludeUserId)
      .slice(0, 20);
  }

  async listInbox(userId: string, limit: number): Promise<Conversation[]> {
    const { Items = [] } = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'CONV#',
        },
      }),
    );

    const sorted = Items.sort((a, b) =>
      String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)),
    ).slice(0, limit);

    const conversations: Conversation[] = [];
    for (const item of sorted) {
      const otherUserId = item.otherUserId as string;
      const otherProfile = await this.getUserProfile(otherUserId);
      conversations.push({
        convId: item.convId as string,
        participant: otherProfile
          ? toPublic(otherProfile)
          : { userId: otherUserId, email: '', displayName: 'User' },
        lastMessageAt: item.lastMessageAt as string,
        lastMessagePreview: item.lastMessagePreview as string,
        unreadCount: Number(item.unreadCount ?? 0),
      });
    }
    return conversations;
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
    const existing = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: `USER#${userId}`, SK: `CONV#${convId}` },
      }),
    );

    if (existing.Item) {
      return {
        conversation: {
          convId,
          participant: toPublic(participant),
          lastMessageAt: existing.Item.lastMessageAt as string,
          lastMessagePreview: existing.Item.lastMessagePreview as string,
          unreadCount: Number(existing.Item.unreadCount ?? 0),
        },
        created: false,
      };
    }

    const ts = nowIso();

    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.table,
                Item: {
                  PK: `CONV#${convId}`,
                  SK: 'META',
                  entityType: 'Conversation',
                  convId,
                  type: 'direct',
                  participantIds: [userId, participantId],
                  createdAt: ts,
                },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            {
              Put: {
                TableName: this.table,
                Item: {
                  PK: `CONV#${convId}`,
                  SK: `MEMBER#${userId}`,
                  entityType: 'Member',
                  userId,
                  joinedAt: ts,
                },
              },
            },
            {
              Put: {
                TableName: this.table,
                Item: {
                  PK: `CONV#${convId}`,
                  SK: `MEMBER#${participantId}`,
                  entityType: 'Member',
                  userId: participantId,
                  joinedAt: ts,
                },
              },
            },
            {
              Put: {
                TableName: this.table,
                Item: {
                  PK: `USER#${userId}`,
                  SK: `CONV#${convId}`,
                  entityType: 'InboxEntry',
                  convId,
                  otherUserId: participantId,
                  lastMessageAt: ts,
                  lastMessagePreview: '',
                  unreadCount: 0,
                },
              },
            },
            {
              Put: {
                TableName: this.table,
                Item: {
                  PK: `USER#${participantId}`,
                  SK: `CONV#${convId}`,
                  entityType: 'InboxEntry',
                  convId,
                  otherUserId: userId,
                  lastMessageAt: ts,
                  lastMessagePreview: '',
                  unreadCount: 0,
                },
              },
            },
          ],
        }),
      );
    } catch {
      const retry = await this.doc.send(
        new GetCommand({
          TableName: this.table,
          Key: { PK: `USER#${userId}`, SK: `CONV#${convId}` },
        }),
      );
      if (retry.Item) {
        return {
          conversation: {
            convId,
            participant: toPublic(participant),
            lastMessageAt: retry.Item.lastMessageAt as string,
            lastMessagePreview: retry.Item.lastMessagePreview as string,
            unreadCount: Number(retry.Item.unreadCount ?? 0),
          },
          created: false,
        };
      }
      throw new Error('Failed to create conversation');
    }

    return {
      conversation: {
        convId,
        participant: toPublic(participant),
        lastMessageAt: ts,
        lastMessagePreview: '',
        unreadCount: 0,
      },
      created: true,
    };
  }

  async isMember(convId: string, userId: string): Promise<boolean> {
    const { Item } = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: `CONV#${convId}`, SK: `MEMBER#${userId}` },
      }),
    );
    return Boolean(Item);
  }

  async listMessages(
    convId: string,
    limit: number,
    cursor?: string,
    since?: string,
  ): Promise<ListMessagesResult> {
    const expressionValues: Record<string, string> = {
      ':pk': `CONV#${convId}`,
      ':prefix': 'MSG#',
    };

    let keyCondition = 'PK = :pk AND begins_with(SK, :prefix)';
    if (since) {
      keyCondition = 'PK = :pk AND SK > :since';
      expressionValues[':since'] = `MSG#${since}`;
      delete expressionValues[':prefix'];
    }

    const { Items = [] } = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: expressionValues,
        ScanIndexForward: false,
      }),
    );

    let messages = Items.map((item) => messageFromItem(item)).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    if (cursor) {
      const idx = messages.findIndex((m) => m.messageId === cursor);
      if (idx >= 0) {
        messages = messages.slice(idx + 1);
      }
    }

    const page = messages.slice(0, limit);
    const nextCursor =
      messages.length > limit ? (page[page.length - 1]?.messageId ?? null) : null;

    return { messages: page, nextCursor };
  }

  async storeMedia(mediaKey: string, data: Buffer, contentType: string): Promise<void> {
    await s3.send(
      new PutObjectCommand({
        Bucket: getMediaBucket(),
        Key: mediaKey,
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async getMedia(
    mediaKey: string,
  ): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const result = await s3.send(
        new GetObjectCommand({
          Bucket: getMediaBucket(),
          Key: mediaKey,
        }),
      );
      if (!result.Body) return null;
      const data = Buffer.from(await result.Body.transformToByteArray());
      return { data, contentType: result.ContentType ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  async createMediaUpload(
    convId: string,
    userId: string,
    filename: string,
    contentType: string,
    _baseUrl: string,
  ) {
    if (!(await this.isMember(convId, userId))) {
      throw new Error('FORBIDDEN');
    }

    const mediaKey = `attachments/${convId}/${crypto.randomUUID()}/${filename}`;
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: getMediaBucket(),
        Key: mediaKey,
        ContentType: contentType,
      }),
      { expiresIn: 900 },
    );

    return { uploadUrl, mediaKey, expiresAt };
  }

  async createMediaDownload(mediaKey: string, userId: string, _baseUrl: string) {
    const convId = mediaKey.split('/')[1];
    if (!convId || !(await this.isMember(convId, userId))) {
      throw new Error('FORBIDDEN');
    }

    try {
      await s3.send(
        new HeadObjectCommand({
          Bucket: getMediaBucket(),
          Key: mediaKey,
        }),
      );
    } catch {
      throw new Error('NOT_FOUND');
    }

    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: getMediaBucket(),
        Key: mediaKey,
      }),
      { expiresIn: 900 },
    );

    return { downloadUrl, expiresAt };
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

    const dedupeKey = {
      PK: `CONV#${convId}`,
      SK: `DEDUP#${senderId}#${clientMsgId}`,
    };
    const existingDedupe = await this.doc.send(
      new GetCommand({ TableName: this.table, Key: dedupeKey }),
    );
    if (existingDedupe.Item?.messageId) {
      const existing = await this.getMessageById(convId, existingDedupe.Item.messageId as string);
      if (existing) {
        return { message: existing, isDuplicate: true };
      }
    }

    const createdAt = nowIso();
    const messageId = crypto.randomUUID();
    const message: Message = {
      messageId,
      convId,
      senderId,
      type,
      body,
      mediaKey,
      status: 'sent',
      createdAt,
    };

    const preview = type === 'text' ? (body ?? '').slice(0, 100) : `[${type}]`;
    const members = parseDirectConvId(convId);
    if (!members) {
      throw new Error('VALIDATION_ERROR');
    }

    const transactItems = [
      {
        Put: {
          TableName: this.table,
          Item: {
            PK: `CONV#${convId}`,
            SK: `MSG#${createdAt}#${messageId}`,
            entityType: 'Message',
            ...message,
          },
        },
      },
      {
        Put: {
          TableName: this.table,
          Item: {
            ...dedupeKey,
            entityType: 'MessageDedup',
            messageId,
          },
        },
      },
      ...members.map((memberId) => {
        const isSender = memberId === senderId;
        return {
          Update: {
            TableName: this.table,
            Key: { PK: `USER#${memberId}`, SK: `CONV#${convId}` },
            UpdateExpression: isSender
              ? 'SET lastMessageAt = :ts, lastMessagePreview = :preview'
              : 'SET lastMessageAt = :ts, lastMessagePreview = :preview ADD unreadCount :one',
            ExpressionAttributeValues: isSender
              ? { ':ts': createdAt, ':preview': preview }
              : { ':ts': createdAt, ':preview': preview, ':one': 1 },
          },
        };
      }),
    ];

    await this.doc.send(new TransactWriteCommand({ TransactItems: transactItems }));
    return { message, isDuplicate: false };
  }

  async markRead(userId: string, convId: string, messageId: string): Promise<MarkReadResult> {
    if (!(await this.isMember(convId, userId))) {
      throw new Error('FORBIDDEN');
    }

    const target = await this.getMessageById(convId, messageId);
    if (!target) {
      throw new Error('NOT_FOUND');
    }

    const { Items = [] } = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `CONV#${convId}`,
          ':prefix': 'MSG#',
        },
      }),
    );

    for (const item of Items) {
      const msg = messageFromItem(item);
      if (msg.senderId !== userId && msg.createdAt <= target.createdAt && msg.status !== 'read') {
        await this.doc.send(
          new UpdateCommand({
            TableName: this.table,
            Key: { PK: item.PK, SK: item.SK },
            UpdateExpression: 'SET #status = :read',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':read': 'read' },
          }),
        );
      }
    }

    await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { PK: `USER#${userId}`, SK: `CONV#${convId}` },
        UpdateExpression: 'SET unreadCount = :zero',
        ExpressionAttributeValues: { ':zero': 0 },
      }),
    );

    return { convId, userId, messageId, readAt: nowIso() };
  }

  async updatePresence(userId: string, status: PresenceStatus): Promise<void> {
    const profile = await this.getUserProfile(userId);
    if (!profile) return;

    const lastSeenAt = status === 'offline' ? nowIso() : undefined;
    await this.doc.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          PK: `USER#${userId}`,
          SK: 'PRESENCE',
          entityType: 'Presence',
          status,
          lastSeenAt,
          ttl: ttlSecondsFromNow(300),
        },
      }),
    );
  }

  async getCall(callId: string): Promise<StoredCall | null> {
    const { Item } = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: `CALL#${callId}`, SK: 'META' },
      }),
    );
    return Item ? callFromItem(Item) : null;
  }

  async getUserActiveCall(userId: string): Promise<StoredCall | null> {
    const { Item } = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: `USER#${userId}`, SK: 'ACTIVE_CALL' },
      }),
    );
    if (!Item?.callId) return null;
    return this.getCall(Item.callId as string);
  }

  async createCallRecord(input: CreateCallRecordInput): Promise<StoredCall> {
    const callId = crypto.randomUUID();
    const createdAt = nowIso();
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
      createdAt,
    };

    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.table,
              Item: {
                PK: `CALL#${callId}`,
                SK: 'META',
                entityType: 'Call',
                ...record,
              },
            },
          },
          {
            Put: {
              TableName: this.table,
              Item: {
                PK: `USER#${input.callerId}`,
                SK: 'ACTIVE_CALL',
                entityType: 'ActiveCall',
                callId,
              },
            },
          },
          {
            Put: {
              TableName: this.table,
              Item: {
                PK: `USER#${input.calleeId}`,
                SK: 'ACTIVE_CALL',
                entityType: 'ActiveCall',
                callId,
              },
            },
          },
        ],
      }),
    );

    return record;
  }

  async updateCallStatus(callId: string, status: CallStatus): Promise<StoredCall> {
    const call = await this.getCall(callId);
    if (!call) throw new Error('NOT_FOUND');

    call.status = status;
    await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { PK: `CALL#${callId}`, SK: 'META' },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
      }),
    );

    if (status === 'ended' || status === 'declined' || status === 'missed') {
      await this.clearActiveCall(call);
    }

    return call;
  }

  async saveCallAttendee(
    callId: string,
    userId: string,
    attendee: ChimeAttendeeInfo,
  ): Promise<StoredCall> {
    const call = await this.getCall(callId);
    if (!call) throw new Error('NOT_FOUND');

    call.attendees[userId] = attendee;
    if (call.status === 'ringing') {
      call.status = 'connected';
    }

    await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { PK: `CALL#${callId}`, SK: 'META' },
        UpdateExpression: 'SET attendees = :attendees, #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':attendees': call.attendees,
          ':status': call.status,
        },
      }),
    );

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

    const preview = body.slice(0, 100);
    const members = parseDirectConvId(convId);
    if (!members) {
      throw new Error('VALIDATION_ERROR');
    }

    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.table,
              Item: {
                PK: `CONV#${convId}`,
                SK: `MSG#${createdAt}#${message.messageId}`,
                entityType: 'Message',
                ...message,
              },
            },
          },
          ...members.map((memberId) => ({
            Update: {
              TableName: this.table,
              Key: { PK: `USER#${memberId}`, SK: `CONV#${convId}` },
              UpdateExpression:
                'SET lastMessageAt = :ts, lastMessagePreview = :preview ADD unreadCount :one',
              ExpressionAttributeValues: {
                ':ts': createdAt,
                ':preview': preview,
                ':one': 1,
              },
            },
          })),
        ],
      }),
    );

    return message;
  }

  async finalizeCall(callId: string, systemMessage: string): Promise<StoredCall> {
    const call = await this.updateCallStatus(callId, 'ended');
    await this.addSystemMessage(call.convId, systemMessage);
    return call;
  }

  private async getMessageById(convId: string, messageId: string): Promise<Message | null> {
    const { Items = [] } = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: 'messageId = :messageId',
        ExpressionAttributeValues: {
          ':pk': `CONV#${convId}`,
          ':prefix': 'MSG#',
          ':messageId': messageId,
        },
      }),
    );
    const item = Items[0];
    return item ? messageFromItem(item) : null;
  }

  private async clearActiveCall(call: StoredCall): Promise<void> {
    for (const userId of [call.callerId, call.calleeId]) {
      try {
        await this.doc.send(
          new DeleteCommand({
            TableName: this.table,
            Key: { PK: `USER#${userId}`, SK: 'ACTIVE_CALL' },
            ConditionExpression: 'callId = :callId',
            ExpressionAttributeValues: { ':callId': call.callId },
          }),
        );
      } catch {
        // ignore missing or stale active-call pointer
      }
    }
  }
}
