import { expect, test } from '@playwright/test';
import { rotas } from './rotas.ts';

// ADR 0005: nenhuma requisição a domínio de fora além das duas origens da Cloudflare, o
// Turnstile e o beacon do Web Analytics. A suíte roda sem nenhum dos dois — o Turnstile só
// carrega quando o build tem a chave de site (ADR 0011), e o beacon é a zona que injeta —, e
// `seguranca.spec.ts` prova com dublês que a CSP os deixa rodar.
const hostsPermitidos = new Set([
  'localhost',
  '127.0.0.1',
  'challenges.cloudflare.com',
  'static.cloudflareinsights.com',
]);

for (const rota of rotas) {
  test(`só requisições ao próprio domínio em ${rota}`, async ({ page }) => {
    const hosts = new Set<string>();
    page.on('request', (req) => hosts.add(new URL(req.url()).hostname));
    await page.goto(rota);
    await page.evaluate(() => document.fonts.ready);
    for (const host of hosts) expect(hostsPermitidos, `host inesperado: ${host}`).toContain(host);
  });
}

test('fontes carregam do próprio domínio, nunca do Google Fonts', async ({ page }) => {
  const urlsDeFonte: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'font') urlsDeFonte.push(req.url());
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  expect(urlsDeFonte.length).toBeGreaterThan(0);
  for (const url of urlsDeFonte) {
    expect(new URL(url).hostname).not.toMatch(/googleapis|gstatic/);
    expect(url).toContain('/_astro/fonts/');
  }
  // `document.fonts.check()` responde true quando nenhuma face casa; por isso a verificação lê as faces carregadas.
  const familiasCarregadas = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
  );
  expect(familiasCarregadas.some((f) => f.includes('Cormorant Garamond'))).toBe(true);
  expect(familiasCarregadas.some((f) => f.includes('Jost'))).toBe(true);
});
