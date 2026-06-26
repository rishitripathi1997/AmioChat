import { expect, test } from '@playwright/test';
import { MOCK_CODE, registerUser, signIn, TEST_PASSWORD, uniqueEmail } from './helpers';

test.describe('Auth', () => {
  test('shows mock auth hint on login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(MOCK_CODE)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('blocks unauthenticated access to chat', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/chat');
    await expect(page.getByRole('searchbox', { name: 'Search conversations' })).not.toBeVisible();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('registers, confirms, and signs in', async ({ page }) => {
    const email = uniqueEmail('auth');
    await registerUser(page, { email, displayName: 'Auth User' });
    await signIn(page, email, TEST_PASSWORD);
    await expect(page.getByText('Auth User')).toBeVisible();
  });
});
