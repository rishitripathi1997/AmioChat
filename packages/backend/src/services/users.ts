import type { UserProfile } from '../db/types';
import { getRepository } from '../db';
import type { AuthContext } from '../lib/auth';

export async function ensureUserProfile(auth: AuthContext): Promise<UserProfile> {
  const repo = getRepository();
  const existing = await repo.getUserProfile(auth.userId);
  if (existing) {
    return existing;
  }

  const profile: UserProfile = {
    userId: auth.userId,
    email: auth.email,
    displayName: auth.email.split('@')[0] || 'User',
    presence: 'online',
  };
  await repo.putUserProfile(profile);
  return profile;
}

export async function getCurrentUser(auth: AuthContext) {
  return ensureUserProfile(auth);
}

export async function updateCurrentUser(
  auth: AuthContext,
  input: { displayName?: string; avatarKey?: string },
) {
  const repo = getRepository();
  const profile = await ensureUserProfile(auth);

  if (input.displayName !== undefined) {
    profile.displayName = input.displayName.trim();
  }
  if (input.avatarKey !== undefined) {
    profile.avatarKey = input.avatarKey;
  }

  await repo.putUserProfile(profile);
  return profile;
}

export async function searchUsers(auth: AuthContext, query: string) {
  if (query.trim().length < 3) {
    throw new Error('VALIDATION_ERROR');
  }
  const repo = getRepository();
  const users = await repo.searchUsersByEmail(query, auth.userId);
  return { users };
}
