import { beforeEach } from 'vitest';
import { resetChimeClientForTests } from '../chime';
import { resetRepositoryForTests } from '../db';
import { resetCallEventPublisherForTests } from '../ws/call-events';
import { resetConnectionRepositoryForTests } from '../ws/connections';
import { resetRateLimitsForTests } from '../ws/rate-limit';

beforeEach(() => {
  resetRepositoryForTests();
  resetConnectionRepositoryForTests();
  resetRateLimitsForTests();
  resetCallEventPublisherForTests();
  resetChimeClientForTests();
});
