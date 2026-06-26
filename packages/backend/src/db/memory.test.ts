import { describe, expect, it } from 'vitest';
import { directConvId } from '@amiochat/shared';
import { getRepository } from '../db';
import { seedUser } from '../test/helpers';

describe('MemoryRepository', () => {
  it('creates a direct conversation for two users', async () => {
    await seedUser('user-a', 'alice@example.com', 'Alice');
    await seedUser('user-b', 'bob@example.com', 'Bob');

    const repo = getRepository();
    const { conversation, created } = await repo.getOrCreateConversation('user-a', 'user-b');

    expect(created).toBe(true);
    expect(conversation.convId).toBe(directConvId('user-a', 'user-b'));
    expect(conversation.participant.userId).toBe('user-b');

    const again = await repo.getOrCreateConversation('user-a', 'user-b');
    expect(again.created).toBe(false);
  });

  it('deduplicates messages by clientMsgId', async () => {
    await seedUser('user-a', 'alice@example.com');
    await seedUser('user-b', 'bob@example.com');

    const repo = getRepository();
    const { conversation } = await repo.getOrCreateConversation('user-a', 'user-b');

    const first = await repo.sendMessage({
      convId: conversation.convId,
      senderId: 'user-a',
      clientMsgId: 'client-1',
      type: 'text',
      body: 'Hello',
    });

    const duplicate = await repo.sendMessage({
      convId: conversation.convId,
      senderId: 'user-a',
      clientMsgId: 'client-1',
      type: 'text',
      body: 'Hello',
    });

    expect(duplicate.isDuplicate).toBe(true);
    expect(duplicate.message.messageId).toBe(first.message.messageId);

    const { messages } = await repo.listMessages(conversation.convId, 50);
    expect(messages).toHaveLength(1);
  });

  it('increments unread count for recipient', async () => {
    await seedUser('user-a', 'alice@example.com');
    await seedUser('user-b', 'bob@example.com');

    const repo = getRepository();
    const { conversation } = await repo.getOrCreateConversation('user-a', 'user-b');

    await repo.sendMessage({
      convId: conversation.convId,
      senderId: 'user-a',
      clientMsgId: 'client-2',
      type: 'text',
      body: 'Ping',
    });

    const bobInbox = await repo.listInbox('user-b', 10);
    const thread = bobInbox.find((c) => c.convId === conversation.convId);
    expect(thread?.unreadCount).toBe(1);
  });
});
