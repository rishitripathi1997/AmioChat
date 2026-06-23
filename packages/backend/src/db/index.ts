import { MemoryRepository } from './memory';
import type { DataRepository } from './types';

let repository: DataRepository | null = null;

export function getRepository(): DataRepository {
  if (!repository) {
    if (process.env.USE_MEMORY_DB === 'false' && process.env.DYNAMODB_TABLE_NAME) {
      throw new Error('DynamoDB repository not implemented yet — use USE_MEMORY_DB=true');
    }
    repository = new MemoryRepository();
  }
  return repository;
}

export function resetRepositoryForTests(): void {
  repository = null;
  const g = globalThis as typeof globalThis & { __amiochatDb?: unknown };
  delete g.__amiochatDb;
}
