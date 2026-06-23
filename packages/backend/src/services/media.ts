import { assertMember } from './conversations';
import { getRepository } from '../db';
import type { AuthContext } from '../lib/auth';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export async function createUploadUrl(
  auth: AuthContext,
  convId: string,
  filename: string,
  contentType: string,
  baseUrl: string,
) {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error('VALIDATION_ERROR');
  }
  await assertMember(convId, auth.userId);
  const repo = getRepository();
  return repo.createMediaUpload(convId, auth.userId, filename, contentType, baseUrl);
}

export async function createDownloadUrl(
  auth: AuthContext,
  mediaKey: string,
  baseUrl: string,
) {
  const repo = getRepository();
  return repo.createMediaDownload(mediaKey, auth.userId, baseUrl);
}

export async function storeUploadedMedia(
  mediaKey: string,
  data: Buffer,
  contentType: string,
) {
  const repo = getRepository();
  await repo.storeMedia(mediaKey, data, contentType);
}

export async function getUploadedMedia(mediaKey: string) {
  const repo = getRepository();
  return repo.getMedia(mediaKey);
}
