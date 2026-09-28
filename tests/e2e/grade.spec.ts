import { expect, test, type Page } from '@playwright/test';
import { projetos as textos } from '../../src/config.ts';
import { projetos, temCapa } from './projetos.ts';

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

/**
 * As linhas que a grade deve formar com `colunas` colunas, pelo total de Projetos do conteúdo.
 * A sobra da divisão não fica no fim: vira destaque no começo. Em três colunas, sobrando um,
 * o primeiro Projeto ocupa a linha inteira; sobrando dois, os dois primeiros dividem a linha.
 * Em duas colunas, com um total ímpar, o primeiro ocupa as duas. O total vem do conteúdo, e
 * não de um número escrito aqui, porque a Giordanna cadastra Projetos pelo CMS.
 */
const linhasEsperadas = (colunas: number): number[][] => {
  const indices = projetos.map((_, i) => i);
  const sobra = indices.length % colunas;
  const primeira = indices.slice(0, sobra === 0 ? colunas : sobra);
  const linhas = [primeira];
  for (let i = primeira.length; i < indices.length; i += colunas)
    linhas.push(indices.slice(i, i + colunas));
  return linhas;
};

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

test('só as Capas da primeira linha carregam de imediato, e a que abre a Grade com prioridade', async ({
  page,
}) => {
  await page.goto('/projetos');
  // A primeira linha da grade de três colunas é a que aparece antes de rolar: as Capas abaixo
  // dela não podem disputar banda com as de cima. Quantas são depende do destaque.
  const naPrimeiraLinha = linhasEsperadas(3)[0]!.length;
  const cards = page.locator('.grade .card');
  for (const [i, projeto] of projetos.entries()) {
    if (!temCapa(projeto)) continue;
    const capa = cards.nth(i).locator('img');
    await expect(capa).toHaveAttribute('loading', i < naPrimeiraLinha ? 'eager' : 'lazy');
    if (i === 0) await expect(capa).toHaveAttribute('fetchpriority', 'high');
    else await expect(capa).not.toHaveAttribute('fetchpriority');
  }
});

test('o item Projetos do cabeçalho marca a página atual', async ({ page }) => {
  await page.goto('/projetos');
  await expect(page.locator('.nav a[aria-current="page"]')).toHaveText('Projetos');
});

// Numa coluna, cada Projeto fica na sua linha; em duas e três, a sobra vira destaque no começo.
test('em 1440 px a grade tem três colunas, e a primeira linha fecha a largura toda', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/projetos');
  const linhas = linhasEsperadas(3);
  expect(await linhasDaGrade(page)).toEqual(linhas);

  // Com destaque ou sem, o último card da primeira linha termina na borda direita da grade.
  const grade = await page.locator('.grade').boundingBox();
  const ultimo = await page
    .locator('.card-wrap')
    .nth(linhas[0]!.length - 1)
    .boundingBox();
  expect(ultimo!.x + ultimo!.width).toBeCloseTo(grade!.x + grade!.width, 0);
});

test('em 768 px a grade tem duas colunas', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/projetos');
  expect(await linhasDaGrade(page)).toEqual(linhasEsperadas(2));
});

test('em 375 px a grade vira uma coluna', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/projetos');
  expect(await linhasDaGrade(page)).toEqual(projetos.map((_, i) => [i]));
});

// A Capa é a do conteúdo: a definida no arquivo, ou a primeira imagem da Galeria. Um Projeto
// cadastrado sem nenhuma das duas mostra o Em breve desenhado pelo site, nunca um buraco.
for (const projeto of projetos) {
  const { rota } = projeto;
  const comCapa = temCapa(projeto);
  test(`o card de ${rota} mostra ${comCapa ? 'a Capa' : 'o Em breve'}`, async ({ page }) => {
    await page.goto('/projetos');
    const card = page.locator(`.grade .card[href="${rota}"]`);
    await expect(card.locator('img')).toHaveCount(comCapa ? 1 : 0);
    await expect(card.getByText('Imagens em breve')).toHaveCount(comCapa ? 0 : 1);
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

    for (const projeto of projetos) {
      const card = page.locator(`.grade .card[href="${projeto.rota}"]`);
      await expect(card.locator('.texto')).toHaveCSS('opacity', '1');
      // Sobre a Capa o nome precisa da penumbra para ter contraste; sobre o painel do Em
      // breve, que o site desenha claro, o nome é escrito em tinta e nada o escurece.
      const penumbra = card.locator('.penumbra');
      await expect(penumbra).toHaveCSS('display', temCapa(projeto) ? 'block' : 'none');
      if (temCapa(projeto))
        await expect(penumbra).toHaveCSS('background-color', 'rgba(35, 45, 56, 0.5)');
    }
  });

  test('a marca sobre a Capa aparece montada, com os quatro pontos no lugar', async ({ page }) => {
    await page.goto('/projetos');
    const marca = page.locator('.grade .card:has(img) .marca').first();
    // No toque o estado revelado é o normal: os pontos que, com cursor, vêm dos cantos ao
    // passar o mouse já precisam estar no centro, dentro da caixa da marca.
    const pontos = marca.locator('i');
    await expect(pontos).toHaveCount(4);
    for (const ponto of await pontos.all())
      await expect(ponto).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    // Caixa e pontos medidos no mesmo quadro: a página ainda pode estar se movendo na entrada.
    const foraDaCaixa = await marca.evaluate((el) => {
      const caixa = el.getBoundingClientRect();
      return [...el.children].filter((ponto) => {
        const r = ponto.getBoundingClientRect();
        return (
          r.left < caixa.left - 0.5 ||
          r.top < caixa.top - 0.5 ||
          r.right > caixa.right + 0.5 ||
          r.bottom > caixa.bottom + 0.5
        );
      }).length;
    });
    expect(foraDaCaixa).toBe(0);
  });
});
