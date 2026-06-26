import type { WsServerEnvelope } from '@amiochat/shared';
import { describe, expect, it } from 'vitest';
import type { WsPublisher } from './publisher';
import { handleWsAction } from './router';
import { seedUser } from '../test/helpers';
import { getRepository } from '../db';

class RecordingPublisher implements WsPublisher {
  toUser: Array<{ userId: string; event: WsServerEnvelope }> = [];

  async send(): Promise<void> {}

  async sendToUser(userId: string, event: WsServerEnvelope): Promise<void> {
    this.toUser.push({ userId, event });
  }
}

describe('WebSocket router', () => {
  it('responds to ping with pong', async () => {
    const publisher = new RecordingPublisher();
    const events = await handleWsAction(
      {
        auth: { userId: 'user-a', email: 'alice@example.com' },
        connectionId: 'conn-1',
        publisher,
      },
      { action: 'ping', payload: {} },
    );

    expect(events).toEqual([{ event: 'pong', payload: {}, requestId: undefined }]);
  });

  it('sends a message and fans out to recipient', async () => {
    await seedUser('user-a', 'alice@example.com');
    await seedUser('user-b', 'bob@example.com');

    const repo = getRepository();
    const { conversation } = await repo.getOrCreateConversation('user-a', 'user-b');

    const publisher = new RecordingPublisher();
    const events = await handleWsAction(
      {
        auth: { userId: 'user-a', email: 'alice@example.com' },
        connectionId: 'conn-1',
        publisher,
      },
      {
        action: 'sendMessage',
        requestId: 'req-1',
        payload: {
          convId: conversation.convId,
          clientMsgId: 'client-ws-1',
          type: 'text',
          body: 'Hello Bob',
        },
      },
    );

    expect(events[0]?.event).toBe('message.ack');
    expect(publisher.toUser).toHaveLength(1);
    expect(publisher.toUser[0]?.userId).toBe('user-b');
    expect(publisher.toUser[0]?.event.event).toBe('message.new');
  });

  it('validates sendMessage payload', async () => {
    const publisher = new RecordingPublisher();
    const events = await handleWsAction(
      {
        auth: { userId: 'user-a', email: 'alice@example.com' },
        connectionId: 'conn-1',
        publisher,
      },
      { action: 'sendMessage', payload: { body: 'missing fields' } },
    );

    expect(events[0]?.event).toBe('error');
    expect((events[0]?.payload as { code: string }).code).toBe('VALIDATION_ERROR');
  });
});
