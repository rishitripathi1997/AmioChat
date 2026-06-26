import { useDynamoDb } from './dynamodb-client';
import { DynamoRepository } from './dynamodb';
import { MemoryRepository } from './memory';
import type { DataRepository } from './types';

let repository: DataRepository | null = null;

export function getRepository(): DataRepository {
  if (!repository) {
    repository = useDynamoDb() ? new DynamoRepository() : new MemoryRepository();
  }
  return repository;
}

export function resetRepositoryForTests(): void {
  repository = null;
  const g = globalThis as typeof globalThis & { __amiochatDb?: unknown };
  delete g.__amiochatDb;
}
