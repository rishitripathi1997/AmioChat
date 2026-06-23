import { assertMember } from './conversations';
import { getRepository } from '../db';
import type { AuthContext } from '../lib/auth';

export async function listMessages(
  auth: AuthContext,
  convId: string,
  limit: number,
  cursor?: string,
  since?: string,
) {
  await assertMember(convId, auth.userId);
  const repo = getRepository();
  return repo.listMessages(convId, limit, cursor, since);
}
