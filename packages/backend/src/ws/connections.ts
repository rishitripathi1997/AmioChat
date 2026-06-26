import { useDynamoDb } from '../db/dynamodb-client';
import { DynamoConnectionRepository } from './dynamodb-connections';

export interface ConnectionRepository {
  addConnection(userId: string, connectionId: string): Promise<void>;
  removeConnection(connectionId: string): Promise<string | null>;
  getUserConnections(userId: string): Promise<string[]>;
  getConnectionUser(connectionId: string): Promise<string | null>;
  countUserConnections(userId: string): Promise<number>;
}

function getStore() {
  const g = globalThis as typeof globalThis & {
    __amiochatConnections?: {
      byConnection: Map<string, string>;
      byUser: Map<string, Set<string>>;
    };
  };
  if (!g.__amiochatConnections) {
    g.__amiochatConnections = {
      byConnection: new Map(),
      byUser: new Map(),
    };
  }
  return g.__amiochatConnections;
}

export class MemoryConnectionRepository implements ConnectionRepository {
  private store = getStore();

  async addConnection(userId: string, connectionId: string): Promise<void> {
    this.store.byConnection.set(connectionId, userId);
    const set = this.store.byUser.get(userId) ?? new Set();
    set.add(connectionId);
    this.store.byUser.set(userId, set);
  }

  async removeConnection(connectionId: string): Promise<string | null> {
    const userId = this.store.byConnection.get(connectionId) ?? null;
    if (!userId) return null;

    this.store.byConnection.delete(connectionId);
    const set = this.store.byUser.get(userId);
    set?.delete(connectionId);
    if (set?.size === 0) {
      this.store.byUser.delete(userId);
    }
    return userId;
  }

  async getUserConnections(userId: string): Promise<string[]> {
    return [...(this.store.byUser.get(userId) ?? [])];
  }

  async getConnectionUser(connectionId: string): Promise<string | null> {
    return this.store.byConnection.get(connectionId) ?? null;
  }

  async countUserConnections(userId: string): Promise<number> {
    return this.store.byUser.get(userId)?.size ?? 0;
  }
}

let connections: ConnectionRepository | null = null;

export function getConnectionRepository(): ConnectionRepository {
  if (!connections) {
    connections = useDynamoDb()
      ? new DynamoConnectionRepository()
      : new MemoryConnectionRepository();
  }
  return connections;
}

export function resetConnectionRepositoryForTests(): void {
  connections = null;
  const g = globalThis as typeof globalThis & { __amiochatConnections?: unknown };
  delete g.__amiochatConnections;
}
