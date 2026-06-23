import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const tableName = process.env.DYNAMODB_TABLE_NAME!;

export const handler: PostConfirmationTriggerHandler = async (event) => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  const userId = event.request.userAttributes.sub;
  const email = (event.request.userAttributes.email ?? '').toLowerCase();
  const displayName =
    event.request.userAttributes.name ?? email.split('@')[0] ?? 'User';
  const now = new Date().toISOString();

  await ddb.send(
    new PutItemCommand({
      TableName: tableName,
      Item: {
        PK: { S: `USER#${userId}` },
        SK: { S: 'PROFILE' },
        entityType: { S: 'UserProfile' },
        userId: { S: userId },
        email: { S: email },
        displayName: { S: displayName },
        createdAt: { S: now },
        GSI1PK: { S: `EMAIL#${email}` },
        GSI1SK: { S: `USER#${userId}` },
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  );

  return event;
};
