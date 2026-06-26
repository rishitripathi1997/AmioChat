import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { getDocClient, getTableName, nowIso, ttlSecondsFromNow } from '../db/dynamodb-client';
import type { ConnectionRepository } from './connections';

export class DynamoConnectionRepository implements ConnectionRepository {
  private table = getTableName();
  private doc = getDocClient();

  async addConnection(userId: string, connectionId: string): Promise<void> {
    const connectedAt = nowIso();
    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.table,
              Item: {
                PK: `USER#${userId}`,
                SK: `CONN#${connectionId}`,
                entityType: 'Connection',
                connectionId,
                userId,
                connectedAt,
                ttl: ttlSecondsFromNow(86_400),
              },
            },
          },
          {
            Put: {
              TableName: this.table,
              Item: {
                PK: `CONN#${connectionId}`,
                SK: 'META',
                entityType: 'ConnectionMeta',
                connectionId,
                userId,
                ttl: ttlSecondsFromNow(86_400),
              },
            },
          },
        ],
      }),
    );
  }

  async removeConnection(connectionId: string): Promise<string | null> {
    const { Item } = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: `CONN#${connectionId}`, SK: 'META' },
      }),
    );
    if (!Item?.userId) return null;

    const userId = Item.userId as string;
    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: this.table,
              Key: { PK: `CONN#${connectionId}`, SK: 'META' },
            },
          },
          {
            Delete: {
              TableName: this.table,
              Key: { PK: `USER#${userId}`, SK: `CONN#${connectionId}` },
            },
          },
        ],
      }),
    );
    return userId;
  }

  async getUserConnections(userId: string): Promise<string[]> {
    const { Items = [] } = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'CONN#',
        },
      }),
    );
    return Items.map((item) => item.connectionId as string);
  }

  async getConnectionUser(connectionId: string): Promise<string | null> {
    const { Item } = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: `CONN#${connectionId}`, SK: 'META' },
      }),
    );
    return (Item?.userId as string | undefined) ?? null;
  }

  async countUserConnections(userId: string): Promise<number> {
    const ids = await this.getUserConnections(userId);
    return ids.length;
  }
}
