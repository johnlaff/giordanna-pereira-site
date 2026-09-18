import { defineConfig, devices } from '@playwright/test';

// A suíte roda contra `dist/` servido pelo Worker local (wrangler dev), o mesmo runtime de Produção.
const port = 8787;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Chromium completo (headless novo) em vez do headless shell: mesmo motor de texto do Chrome dos visitantes.
    channel: 'chromium',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `pnpm exec wrangler dev --port ${port} --log-level warn`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
