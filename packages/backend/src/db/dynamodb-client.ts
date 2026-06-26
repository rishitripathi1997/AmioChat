import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let docClient: DynamoDBDocumentClient | null = null;

export function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
}

export function getTableName(): string {
  const name = process.env.DYNAMODB_TABLE_NAME;
  if (!name) {
    throw new Error('DYNAMODB_TABLE_NAME is required');
  }
  return name;
}

export function useDynamoDb(): boolean {
  return Boolean(process.env.DYNAMODB_TABLE_NAME && process.env.USE_MEMORY_DB !== 'true');
}

export function parseDirectConvId(convId: string): [string, string] | null {
  const parts = convId.split('#');
  if (parts.length !== 3 || parts[0] !== 'direct') {
    return null;
  }
  return [parts[1]!, parts[2]!];
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function ttlSecondsFromNow(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}
