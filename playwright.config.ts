import { defineConfig, devices } from '@playwright/test';
import { portaDoModoDeTeste, portaDoTeto } from './tests/e2e/modo-de-teste.ts';

// A suíte roda contra `dist/` servido pelo Worker local (wrangler dev), o mesmo runtime de Produção.
const port = 8787;
const baseURL = `http://localhost:${port}`;

/** Um `wrangler dev` sobre `dist/`, com o seu inspetor (no padrão, todos disputariam a 9229). */
const worker = (porta: number, inspetor: number, extra = '') => ({
  command: `pnpm exec wrangler dev --port ${porta} --inspector-port ${inspetor} --log-level warn ${extra}`,
  url: `http://localhost:${porta}`,
  reuseExistingServer: !process.env['CI'],
  timeout: 120_000,
  env: { WRANGLER_SEND_METRICS: 'false' },
});

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
  // Três Workers sobre o mesmo `dist/`. O primeiro é o de toda a suíte e sobe como a Produção
  // sem chaves: o formulário falha fechado nele. O segundo liga o modo de teste do formulário,
  // em que o Turnstile e o Resend são dublês (ADR 0011); só `contato.spec.ts` fala com ele. O
  // terceiro é o mesmo modo de teste, reservado ao envio acima do teto (ver `modo-de-teste.ts`).
  webServer: [
    worker(port, 9229),
    worker(portaDoModoDeTeste, 9230, '--var CONTATO_MODO:teste'),
    worker(portaDoTeto, 9231, '--var CONTATO_MODO:teste'),
  ],
});
