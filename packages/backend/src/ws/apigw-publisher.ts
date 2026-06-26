import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import type { WsServerEnvelope } from '@amiochat/shared';
import { getConnectionRepository } from './connections';
import type { WsPublisher } from './publisher';

const ssm = new SSMClient({});

function toManagementEndpoint(url: string): string {
  return url.replace(/^wss:\/\//i, 'https://');
}

export function resolveWebSocketEndpointFromEvent(domainName: string, stage: string): string {
  return `https://${domainName}/${stage}`;
}

export async function resolveWebSocketEndpoint(): Promise<string | null> {
  const direct = process.env.WEBSOCKET_API_ENDPOINT ?? process.env.WEBSOCKET_API_URL;
  if (direct) return toManagementEndpoint(direct);

  const env = process.env.ENVIRONMENT;
  if (!env) return null;

  try {
    const result = await ssm.send(
      new GetParameterCommand({
        Name: `/amiochat/${env}/websocket-api-url`,
      }),
    );
    const value = result.Parameter?.Value;
    return value ? toManagementEndpoint(value) : null;
  } catch {
    return null;
  }
}

export function createApiGatewayPublisher(endpoint: string): WsPublisher {
  const client = new ApiGatewayManagementApiClient({ endpoint });

  async function send(connectionId: string, event: WsServerEnvelope): Promise<void> {
    try {
      await client.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify(event)),
        }),
      );
    } catch (error) {
      if (error instanceof GoneException) {
        await getConnectionRepository().removeConnection(connectionId);
        return;
      }
      throw error;
    }
  }

  return {
    send,
    async sendToUser(userId: string, event: WsServerEnvelope): Promise<void> {
      const connectionIds = await getConnectionRepository().getUserConnections(userId);
      await Promise.all(connectionIds.map((id) => send(id, event)));
    },
  };
}
