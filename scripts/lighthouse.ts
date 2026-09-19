import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';

// O Lighthouse roda no Chromium do Playwright, o mesmo motor do e2e, em vez do Chrome que
// estiver na máquina (no WSL, o chrome-launcher acha o do Windows e não conecta).
const resultado = spawnSync('pnpm', ['exec', 'lhci', 'autorun'], {
  stdio: 'inherit',
  env: { ...process.env, CHROME_PATH: chromium.executablePath() },
});

// No WSL o chrome-launcher monta o perfil do Chrome com um caminho no formato do Windows
// (C:\Users\...\lighthouse.N), que o Chromium do Linux cria como diretório dentro do cwd.
for (const entrada of readdirSync('.')) {
  if (/^[A-Z]:\\.*\\lighthouse\.\d+$/.test(entrada)) rmSync(entrada, { recursive: true });
}

process.exit(resultado.status ?? 1);
