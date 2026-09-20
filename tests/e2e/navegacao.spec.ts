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

test('o link interno é pré-buscado antes do clique, e o de página inexistente não', async ({
  page,
}) => {
  const pedidos: string[] = [];
  const falhas: string[] = [];
  page.on('request', (req) => pedidos.push(new URL(req.url()).pathname));
  page.on('response', (res) => {
    if (res.status() >= 400) falhas.push(`${res.status()} ${new URL(res.url()).pathname}`);
  });

  await page.goto('/');
  expect(pedidos, 'a página foi buscada antes de alguém demonstrar interesse').not.toContain(
    '/projetos',
  );

  // O item Contato ainda aponta para uma página que não existe (#11): o prefetch não pode
  // persegui-la. O interesse pelos Projetos vem depois e serve de marco — quando a busca
  // dele chega, a fila de ociosidade do Astro já passou pelo Contato.
  await page.locator('.nav a[href="/contato"]').hover();
  await page.locator('.nav a[href="/projetos"]').hover();
  await expect.poll(() => pedidos.includes('/projetos')).toBe(true);

  expect(pedidos).not.toContain('/contato');
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
