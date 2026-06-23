import type {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import type { WsClientEnvelope } from '@amiochat/shared';
import { parseToken } from '../lib/auth';
import { getConnectionRepository } from './connections';
import { NoopPublisher, type WsPublisher } from './publisher';
import {
  broadcastOfflinePresence,
  handleConnect,
  handleDisconnect,
  handleWsAction,
} from './router';

function wsResponse(statusCode: number, body?: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    body: body ? JSON.stringify(body) : undefined,
  };
}

function getUserIdFromAuthorizer(event: APIGatewayProxyWebsocketEventV2): string | undefined {
  const ctx = event.requestContext as APIGatewayProxyWebsocketEventV2['requestContext'] & {
    authorizer?: { jwt?: { claims?: Record<string, string> } };
  };
  return ctx.authorizer?.jwt?.claims?.sub;
}

function getTokenFromQuery(event: APIGatewayProxyWebsocketEventV2): string | undefined {
  const params = event.queryStringParameters;
  return params?.token ?? undefined;
}

function createLambdaPublisher(_event: APIGatewayProxyWebsocketEventV2): WsPublisher {
  // ApiGatewayManagementApi fan-out wired when deployed; noop until endpoint is configured.
  return new NoopPublisher();
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const routeKey = event.requestContext.routeKey;
  const connectionId = event.requestContext.connectionId;
  const publisher = createLambdaPublisher(event);

  switch (routeKey) {
    case '$connect': {
      let userId = getUserIdFromAuthorizer(event);
      if (!userId) {
        const auth = parseToken(getTokenFromQuery(event));
        userId = auth?.userId;
      }
      if (!userId) {
        return wsResponse(401, { code: 'UNAUTHORIZED', message: 'Missing user identity' });
      }

      await handleConnect({
        auth: { userId, email: '' },
        connectionId,
        publisher,
      });
      return wsResponse(200);
    }

    case '$disconnect': {
      const connections = getConnectionRepository();
      const userId = await connections.removeConnection(connectionId);
      await handleDisconnect(connectionId);
      if (userId) {
        const remaining = await connections.countUserConnections(userId);
        if (remaining === 0) {
          await broadcastOfflinePresence(publisher, userId);
        }
      }
      return wsResponse(200);
    }

    default: {
      const connections = getConnectionRepository();
      const userId = await connections.getConnectionUser(connectionId);
      if (!userId) {
        return wsResponse(401, { code: 'UNAUTHORIZED', message: 'Unknown connection' });
      }

      let envelope: WsClientEnvelope;
      try {
        envelope = JSON.parse(event.body ?? '{}') as WsClientEnvelope;
      } catch {
        return wsResponse(200, {
          event: 'error',
          payload: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' },
        });
      }

      const events = await handleWsAction(
        { auth: { userId, email: '' }, connectionId, publisher },
        envelope,
      );

      for (const outbound of events) {
        await publisher.send(connectionId, outbound);
      }

      return wsResponse(200);
    }
  }
};
