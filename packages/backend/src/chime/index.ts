import { AwsChimeClient } from './aws';
import { MockChimeClient } from './mock';
import type { ChimeClient } from './types';

let client: ChimeClient | null = null;

export function getChimeClient(): ChimeClient {
  if (!client) {
    const useAws =
      process.env.USE_MOCK_CHIME !== 'true' &&
      (process.env.CHIME_MEDIA_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
    client = useAws
      ? new AwsChimeClient(process.env.CHIME_MEDIA_REGION ?? 'us-east-1')
      : new MockChimeClient();
  }
  return client;
}

export function resetChimeClientForTests(): void {
  client = null;
}
