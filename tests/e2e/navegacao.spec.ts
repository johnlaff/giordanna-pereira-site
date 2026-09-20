import { expect, test } from '@playwright/test';

test('a transição entre páginas é a nativa do navegador, declarada em CSS', async ({ page }) => {
  await page.goto('/');
  const navegacao = await page.evaluate(() => {
    for (const folha of document.styleSheets) {
      let regras: CSSRuleList;
      try {
        regras = folha.cssRules;
      } catch {
        continue;
      }
      for (const regra of regras)
        if (regra.constructor.name === 'CSSViewTransitionRule')
          return (regra as CSSRule & { navigation: string }).navigation;
    }
    return null;
  });
  expect(navegacao, 'o navegador não encontrou a regra @view-transition').toBe('auto');
});

test('a página de destino é pré-buscada antes do clique, e nada que não exista', async ({
  page,
}) => {
  const pedidos: string[] = [];
  const falhas: string[] = [];
  page.on('request', (req) => pedidos.push(new URL(req.url()).pathname));
  page.on('response', (res) => {
    if (res.status() >= 400) falhas.push(`${res.status()} ${new URL(res.url()).pathname}`);
  });

  await page.goto('/');
  // O prefetch do Astro espera o navegador ficar ocioso; o link dos Projetos está no
  // cabeçalho, visível desde o primeiro quadro.
  await expect.poll(() => pedidos.includes('/projetos')).toBe(true);

  // O item Contato do cabeçalho ainda aponta para uma página que não existe (#11): buscá-la
  // sozinho gastaria um 404 em cada visita, e é o que `rotasPendentes` evita.
  expect(falhas).toEqual([]);
});

test('a navegação leva da home à Grade e de lá à página de um Projeto', async ({ page }) => {
  await page.goto('/');
  await page.locator('.nav a[href="/projetos"]').click();
  await expect(page).toHaveURL('/projetos');

  const primeiro = page.locator('.grade .card').first();
  const destino = await primeiro.getAttribute('href');
  await primeiro.click();
  await expect(page).toHaveURL(destino ?? '');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
