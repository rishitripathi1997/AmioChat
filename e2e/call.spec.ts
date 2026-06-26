import { expect, test } from '@playwright/test';
import {
  registerAndSignIn,
  startChatWith,
  uniqueEmail,
} from './helpers';

test.describe('Calls', () => {
  test('shows incoming call overlay to callee', async ({ browser }) => {
    const emailAlice = uniqueEmail('caller');
    const emailBob = uniqueEmail('callee');

    const contextAlice = await browser.newContext();
    const contextBob = await browser.newContext();
    const pageAlice = await contextAlice.newPage();
    const pageBob = await contextBob.newPage();

    try {
      await registerAndSignIn(pageBob, { email: emailBob, displayName: 'Callee E2E' });
      await registerAndSignIn(pageAlice, { email: emailAlice, displayName: 'Caller E2E' });

      await startChatWith(pageAlice, emailBob);
      await pageAlice.getByRole('button', { name: 'Voice call' }).click();

      await expect(pageBob.getByText('Incoming voice call')).toBeVisible({ timeout: 15_000 });
      await expect(pageBob.getByRole('button', { name: 'Decline' })).toBeVisible();
      await pageBob.getByRole('button', { name: 'Decline' }).click();

      await expect(pageBob.getByText('Incoming voice call')).toBeHidden({ timeout: 10_000 });
    } finally {
      await contextAlice.close();
      await contextBob.close();
    }
  });
});
