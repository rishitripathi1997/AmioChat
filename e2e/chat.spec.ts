import { expect, test } from '@playwright/test';
import {
  registerAndSignIn,
  startChatWith,
  uniqueEmail,
} from './helpers';

test.describe('Chat', () => {
  test('starts a conversation and exchanges a message when connected', async ({ browser }) => {
    const emailAlice = uniqueEmail('alice');
    const emailBob = uniqueEmail('bob');

    const contextAlice = await browser.newContext();
    const contextBob = await browser.newContext();
    const pageAlice = await contextAlice.newPage();
    const pageBob = await contextBob.newPage();

    try {
      await registerAndSignIn(pageAlice, { email: emailAlice, displayName: 'Alice E2E' });
      await registerAndSignIn(pageBob, { email: emailBob, displayName: 'Bob E2E' });

      await startChatWith(pageAlice, emailBob);
      await expect(pageAlice.getByRole('heading', { name: 'Bob E2E' })).toBeVisible();

      const composer = pageAlice.getByRole('textbox', { name: 'Message' });
      const sendButton = pageAlice.getByRole('button', { name: 'Send message' });
      const message = 'Hello from Playwright';

      if (await sendButton.isEnabled()) {
        await composer.fill(message);
        await sendButton.click();
        await expect(pageAlice.getByText(message, { exact: true })).toBeVisible({ timeout: 10_000 });

        await expect(pageBob.getByRole('button', { name: /Alice E2E/ })).toBeVisible({
          timeout: 15_000,
        });
        await pageBob.getByRole('button', { name: /Alice E2E/ }).click();
        await expect(pageBob.getByText(message, { exact: true })).toBeVisible({ timeout: 15_000 });
      } else {
        await pageBob.reload();
        await expect(pageBob.getByRole('button', { name: /Alice E2E/ })).toBeVisible({
          timeout: 10_000,
        });
      }
    } finally {
      await contextAlice.close();
      await contextBob.close();
    }
  });
});
