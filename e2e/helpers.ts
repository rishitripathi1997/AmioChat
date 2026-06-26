import { expect, type Page } from '@playwright/test';

export const MOCK_CODE = '123456';
export const TEST_PASSWORD = 'Password1';

export function uniqueEmail(prefix: string): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${suffix}@e2e.example.com`;
}

async function waitForAuthForm(page: Page) {
  await expect(page.getByText(MOCK_CODE)).toBeVisible();
}

export async function registerUser(
  page: Page,
  opts: { email: string; displayName: string; password?: string },
) {
  const password = opts.password ?? TEST_PASSWORD;

  await page.goto('/register');
  await waitForAuthForm(page);

  const displayNameInput = page.getByRole('textbox', { name: 'Display name' });
  const emailInput = page.getByRole('textbox', { name: 'Email' });
  const passwordInput = page.getByRole('textbox', { name: 'Password' });

  await displayNameInput.fill(opts.displayName);
  await emailInput.fill(opts.email);
  await passwordInput.fill(password);

  await expect(displayNameInput).toHaveValue(opts.displayName);
  await expect(emailInput).toHaveValue(opts.email);

  const submitForm = () =>
    page.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());

  const [registerResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/auth/mock') && r.request().method() === 'POST',
    ),
    submitForm(),
  ]);

  if (!registerResponse.ok()) {
    const body = await registerResponse.text();
    throw new Error(`Register API failed (${registerResponse.status()}): ${body.slice(0, 200)}`);
  }

  await expect(page).toHaveURL(/\/confirm/, { timeout: 15_000 });

  await page.getByRole('textbox', { name: 'Verification code' }).fill(MOCK_CODE);

  const [confirmResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/auth/mock') && r.request().method() === 'POST',
    ),
    page.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit()),
  ]);

  if (!confirmResponse.ok()) {
    const body = await confirmResponse.text();
    throw new Error(`Confirm API failed (${confirmResponse.status()}): ${body.slice(0, 200)}`);
  }

  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

  return { email: opts.email, password, displayName: opts.displayName };
}

export async function signIn(page: Page, email: string, password = TEST_PASSWORD) {
  await page.goto('/login');
  await waitForAuthForm(page);

  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);

  const [signInResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/auth/mock') && r.request().method() === 'POST',
    ),
    page.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit()),
  ]);

  if (!signInResponse.ok()) {
    const body = await signInResponse.text();
    throw new Error(`Sign-in API failed (${signInResponse.status()}): ${body.slice(0, 200)}`);
  }

  await expect(page).toHaveURL(/\/chat/, { timeout: 15_000 });
  await expect(page.getByRole('searchbox', { name: 'Search conversations' })).toBeVisible();
}

export async function registerAndSignIn(
  page: Page,
  opts: { email: string; displayName: string },
) {
  const creds = await registerUser(page, opts);
  await signIn(page, creds.email, creds.password);
  return creds;
}

export async function startChatWith(page: Page, contactEmail: string) {
  await page.locator('footer').getByRole('button', { name: /New chat/i }).click();
  const dialog = page.getByRole('dialog', { name: 'New chat' });
  await dialog.getByPlaceholder('email@example.com').fill(contactEmail);
  await dialog.getByRole('button', { name: 'Search' }).click();
  await dialog.getByRole('button').filter({ hasText: contactEmail }).click();
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible();
}

export async function sendMessage(page: Page, text: string) {
  const composer = page.getByRole('textbox', { name: 'Message' });
  await composer.fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}
