import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from 'aws-lambda';
import { handleApiGatewayEvent } from './router';
import { toApiGatewayResult } from '../lib/response';

export const handler: APIGatewayProxyHandlerV2 = async (
  event: APIGatewayProxyEventV2,
) => {
  const result = await handleApiGatewayEvent(event, {
    mediaBaseUrl: process.env.MEDIA_BASE_URL,
  });

  return toApiGatewayResult(result);
};
