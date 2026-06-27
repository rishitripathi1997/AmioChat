import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { log } from '../lib/logger';
import { handleApiGatewayEvent } from './router';
import { json, toApiGatewayResult } from '../lib/response';

export const handler: APIGatewayProxyHandlerV2 = async (
  event: APIGatewayProxyEventV2,
) => {
  const correlationId = event.requestContext.requestId;
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  log('info', 'request.start', {
    service: 'amiochat-rest',
    correlationId,
    method,
    path,
    environment: process.env.ENVIRONMENT ?? 'local',
  });

  try {
    const result = await handleApiGatewayEvent(event, {
      mediaBaseUrl: process.env.MEDIA_BASE_URL,
    });

    log('info', 'request.complete', {
      service: 'amiochat-rest',
      correlationId,
      method,
      path,
      statusCode: result.statusCode,
    });

    return toApiGatewayResult(result);
  } catch (error) {
    log('error', 'request.failed', {
      service: 'amiochat-rest',
      correlationId,
      method,
      path,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return toApiGatewayResult(
      json(500, { code: 'INTERNAL_ERROR', message: 'Internal server error' }),
    );
  }
};
