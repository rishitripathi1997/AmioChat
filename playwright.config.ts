import { defineConfig, devices } from '@playwright/test';

/** Port 3100 avoids clashing with `npm run dev` on 3000. */
const PORT = 3100;
const HOST = 'localhost';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev:e2e',
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_WS_URL: 'ws://localhost:3002',
      CALL_NOTIFY_URL: 'http://127.0.0.1:3002/internal/publish',
    },
  },
});
