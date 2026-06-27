import type {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import type { WsClientEnvelope } from '@amiochat/shared';
import { parseToken } from '../lib/auth';
import { log } from '../lib/logger';
import {
  createApiGatewayPublisher,
  resolveWebSocketEndpointFromEvent,
} from './apigw-publisher';
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

function createLambdaPublisher(event: APIGatewayProxyWebsocketEventV2): WsPublisher {
  const { domainName, stage } = event.requestContext;
  if (domainName && stage) {
    return createApiGatewayPublisher(resolveWebSocketEndpointFromEvent(domainName, stage));
  }
  return new NoopPublisher();
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const routeKey = event.requestContext.routeKey;
  const connectionId = event.requestContext.connectionId;
  const correlationId = event.requestContext.requestId;
  const publisher = createLambdaPublisher(event);

  log('info', 'ws.event', {
    service: 'amiochat-ws',
    correlationId,
    routeKey,
    connectionId,
    environment: process.env.ENVIRONMENT ?? 'local',
  });

  try {
    switch (routeKey) {
      case '$connect':
        return wsResponse(200);

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

        let envelope: WsClientEnvelope;
        try {
          envelope = JSON.parse(event.body ?? '{}') as WsClientEnvelope;
        } catch {
          return wsResponse(200, {
            event: 'error',
            payload: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' },
          });
        }

        if (envelope.action === 'authenticate') {
          const token = (envelope.payload as { token?: string } | undefined)?.token;
          const auth = parseToken(token);
          if (!auth) {
            await publisher.send(connectionId, {
              event: 'error',
              payload: { code: 'UNAUTHORIZED', message: 'Invalid token', requestId: envelope.requestId },
              requestId: envelope.requestId,
            });
            return wsResponse(401);
          }

          await handleConnect({
            auth,
            connectionId,
            publisher,
          });

          log('info', 'ws.authenticated', {
            service: 'amiochat-ws',
            correlationId,
            connectionId,
            userId: auth.userId,
          });

          return wsResponse(200);
        }

        const userId = await connections.getConnectionUser(connectionId);
        if (!userId) {
          await publisher.send(connectionId, {
            event: 'error',
            payload: {
              code: 'UNAUTHORIZED',
              message: 'Connection not authenticated',
              requestId: envelope.requestId,
            },
            requestId: envelope.requestId,
          });
          return wsResponse(401);
        }

        const events = await handleWsAction(
          { auth: { userId, email: '' }, connectionId, publisher },
          envelope,
        );

        for (const outbound of events) {
          await publisher.send(connectionId, outbound);
        }

        if (envelope.action === 'sendMessage') {
          log('info', 'ws.sendMessage', {
            service: 'amiochat-ws',
            correlationId,
            connectionId,
            userId,
            requestId: envelope.requestId,
          });
        }

        return wsResponse(200);
      }
    }
  } catch (error) {
    log('error', 'ws.failed', {
      service: 'amiochat-ws',
      correlationId,
      routeKey,
      connectionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return wsResponse(500);
  }
};
