import { describe, expect, it } from 'vitest';
import { handleRestRequest } from './router';
import { authHeaders, seedUser } from '../test/helpers';

describe('REST router', () => {
  it('returns health without auth', async () => {
    const res = await handleRestRequest({
      method: 'GET',
      path: '/health',
      query: {},
      headers: {},
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: 'ok' });
  });

  it('rejects protected routes without auth', async () => {
    const res = await handleRestRequest({
      method: 'GET',
      path: '/users/me',
      query: {},
      headers: {},
    });

    expect(res.statusCode).toBe(401);
  });

  it('creates a conversation and lists messages', async () => {
    await seedUser('user-a', 'alice@example.com', 'Alice');
    await seedUser('user-b', 'bob@example.com', 'Bob');

    const createRes = await handleRestRequest({
      method: 'POST',
      path: '/conversations',
      query: {},
      headers: authHeaders('user-a', 'alice@example.com'),
      body: JSON.stringify({ participantId: 'user-b' }),
    });

    expect(createRes.statusCode).toBe(201);
    const conv = JSON.parse(createRes.body) as { convId: string };
    expect(conv.convId).toBeTruthy();

    const listRes = await handleRestRequest({
      method: 'GET',
      path: `/conversations/${encodeURIComponent(conv.convId)}/messages`,
      query: {},
      headers: authHeaders('user-a', 'alice@example.com'),
    });

    expect(listRes.statusCode).toBe(200);
    const payload = JSON.parse(listRes.body) as { messages: unknown[] };
    expect(payload.messages).toEqual([]);
  });

  it('returns current user profile', async () => {
    const res = await handleRestRequest({
      method: 'GET',
      path: '/users/me',
      query: {},
      headers: authHeaders('user-new', 'new@example.com'),
    });

    expect(res.statusCode).toBe(200);
    const user = JSON.parse(res.body) as { userId: string; email: string };
    expect(user.userId).toBe('user-new');
    expect(user.email).toBe('new@example.com');
  });
});
