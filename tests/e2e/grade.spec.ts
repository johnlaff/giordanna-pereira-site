import { expect, test, type Page } from '@playwright/test';
import { projetos as textos } from '../../src/config.ts';
import { projetos } from './projetos.ts';

/**
 * As linhas da grade, lidas da página: cada linha é a lista de índices dos cards que dividem
 * a mesma altura. É assim que a grade se verifica sem depender de nomes de classe ou de
 * medidas exatas — o que importa é quantos Projetos cabem lado a lado em cada largura.
 */
const linhasDaGrade = (page: Page) =>
  page.locator('.card-wrap').evaluateAll((elementos) => {
    const linhas: number[][] = [];
    let topoAtual: number | null = null;
    elementos.forEach((elemento, i) => {
      const topo = Math.round(elemento.getBoundingClientRect().top);
      if (topoAtual === null || Math.abs(topo - topoAtual) > 2) {
        linhas.push([]);
        topoAtual = topo;
      }
      linhas.at(-1)?.push(i);
    });
    return linhas;
  });

test('a Grade lista todos os Projetos na Ordem, cada um levando à sua página', async ({ page }) => {
  await page.goto('/projetos');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(textos.titulo);

  const cards = page.locator('.grade .card');
  await expect(cards).toHaveCount(projetos.length);
  for (const [i, projeto] of projetos.entries()) {
    await expect(cards.nth(i)).toHaveAttribute('href', projeto.rota);
    await expect(cards.nth(i)).toHaveAccessibleName(
      `${projeto.dados.titulo} — ${projeto.dados.tipo}`,
    );
  }
});

test('o item Projetos do cabeçalho marca a página atual', async ({ page }) => {
  await page.goto('/projetos');
  await expect(page.locator('.nav a[aria-current="page"]')).toHaveText('Projetos');
});

// Com dez Projetos sobra um na grade de três colunas, e é ele que abre a página na linha
// inteira; em duas colunas o total é par e ninguém se destaca; numa coluna, cada um na sua.
test('em 1440 px a grade tem três colunas, com o primeiro Projeto na linha inteira', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/projetos');
  expect(await linhasDaGrade(page)).toEqual([[0], [1, 2, 3], [4, 5, 6], [7, 8, 9]]);

  const grade = await page.locator('.grade').boundingBox();
  const destaque = await page.locator('.card-wrap').first().boundingBox();
  expect(destaque?.width).toBeCloseTo(grade?.width ?? 0, 0);
});

test('em 768 px a grade tem duas colunas', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/projetos');
  expect(await linhasDaGrade(page)).toEqual([
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [8, 9],
  ]);
});

test('em 375 px a grade vira uma coluna', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/projetos');
  expect(await linhasDaGrade(page)).toEqual(projetos.map((_, i) => [i]));
});

// A Capa é a do conteúdo: a definida no arquivo, ou a primeira imagem da Galeria. Um Projeto
// cadastrado sem nenhuma das duas mostra o Em breve desenhado pelo site, nunca um buraco.
for (const { rota, dados } of projetos) {
  const temCapa = dados.capa !== undefined || dados.galeria.length > 0;
  test(`o card de ${rota} mostra ${temCapa ? 'a Capa' : 'o Em breve'}`, async ({ page }) => {
    await page.goto('/projetos');
    const card = page.locator(`.grade .card[href="${rota}"]`);
    await expect(card.locator('img')).toHaveCount(temCapa ? 1 : 0);
    await expect(card.getByText('Imagens em breve')).toHaveCount(temCapa ? 0 : 1);
  });
}

test.describe('tela com cursor', () => {
  test.skip(({ isMobile }) => isMobile === true, 'aqui não há mouse para passar sobre o card');

  test('o nome do Projeto só aparece sobre a Capa ao passar o mouse', async ({ page }) => {
    await page.goto('/projetos');
    const card = page.locator('.grade .card').first();
    const nome = card.locator('.texto');

    await expect(nome).toHaveCSS('opacity', '0');
    await card.hover();
    await expect(nome).toHaveCSS('opacity', '1');
  });

  test('e aparece também para quem chega pelo teclado', async ({ page }) => {
    await page.goto('/projetos');
    const card = page.locator('.grade .card').first();

    // Até o foco cair no primeiro card: pular para o conteúdo, marca, três itens da nav.
    for (let tecla = 0; tecla < 12; tecla++) {
      await page.keyboard.press('Tab');
      if (await card.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(card).toBeFocused();
    await expect(card.locator('.texto')).toHaveCSS('opacity', '1');
  });
});

test.describe('tela de toque', () => {
  test.skip(({ isMobile }) => isMobile !== true, 'o estado de toque só vale sem cursor');

  test('sem hover, o nome do Projeto fica visível desde o começo', async ({ page }) => {
    await page.goto('/projetos');
    // A regra que decide isso é `@media (hover: none)`; se a emulação de toque deixar de
    // refletir a consulta, o teste viraria um falso verde e é melhor falhar aqui.
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);

    for (const { rota, dados } of projetos) {
      const card = page.locator(`.grade .card[href="${rota}"]`);
      await expect(card.locator('.texto')).toHaveCSS('opacity', '1');
      // Sobre a Capa o nome precisa do véu para ter contraste; sobre o painel do Em breve,
      // que o site desenha claro, o nome é escrito em tinta e véu nenhum entra.
      const temCapa = dados.capa !== undefined || dados.galeria.length > 0;
      const veu = card.locator('.veu');
      await expect(veu).toHaveCSS('display', temCapa ? 'block' : 'none');
      if (temCapa) await expect(veu).toHaveCSS('background-color', 'rgba(35, 45, 56, 0.5)');
    }
  });
});
