import { getRepository } from '../db';

export async function seedUser(
  userId: string,
  email: string,
  displayName?: string,
): Promise<void> {
  const repo = getRepository();
  await repo.putUserProfile({
    userId,
    email,
    displayName: displayName ?? email.split('@')[0],
    presence: 'online',
  });
}

export function authHeaders(userId: string, email: string) {
  return {
    'x-amiochat-auth': userId,
    'x-amiochat-email': email,
  };
}
