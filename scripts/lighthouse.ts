import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';

// O Lighthouse roda no Chromium do Playwright, o mesmo motor do e2e, em vez do Chrome que
// estiver na máquina (no WSL, o chrome-launcher acha o do Windows e não conecta).
const resultado = spawnSync('pnpm', ['exec', 'lhci', 'autorun'], {
  stdio: 'inherit',
  env: { ...process.env, CHROME_PATH: chromium.executablePath() },
});
process.exit(resultado.status ?? 1);
