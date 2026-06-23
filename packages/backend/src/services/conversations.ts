import { getRepository } from '../db';
import type { AuthContext } from '../lib/auth';

export async function listConversations(auth: AuthContext, limit: number) {
  const repo = getRepository();
  const conversations = await repo.listInbox(auth.userId, limit);
  return { conversations };
}

export async function createConversation(
  auth: AuthContext,
  participantId: string,
) {
  const repo = getRepository();
  return repo.getOrCreateConversation(auth.userId, participantId);
}

export async function assertMember(convId: string, userId: string) {
  const repo = getRepository();
  if (!(await repo.isMember(convId, userId))) {
    throw new Error('FORBIDDEN');
  }
}
