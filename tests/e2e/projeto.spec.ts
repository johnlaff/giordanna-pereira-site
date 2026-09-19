import { expect, test } from '@playwright/test';
import { site } from '../../src/config.ts';
import { projetos } from './projetos.ts';

// O conteúdo é a fonte da verdade: cada página é conferida contra o arquivo do seu Projeto,
// não contra strings repetidas no teste. O que vale para todos roda em cima da collection
// inteira, então um Projeto novo — inclusive cadastrado no CMS — entra sozinho na suíte.

/** A Ordem é circular: `at(-1)` devolve o último, e o índice além do fim volta ao primeiro. */
const vizinho = (indice: number) => projetos.at(indice % projetos.length)!;

const chaveDaImagem = (caminho: string) => caminho.split('/').pop()?.replace('.webp', '');

for (const [i, { slug, rota, dados }] of projetos.entries()) {
  test(`${slug}: título, Tipo, descrição, Ferramentas e Ficha técnica saem do conteúdo`, async ({
    page,
  }) => {
    const resposta = await page.goto(rota);
    expect(resposta?.status()).toBe(200);
    await expect(page).toHaveTitle(`${dados.titulo} — ${site.nome}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(dados.titulo);
    await expect(page.locator('.page-head .kind')).toHaveText(dados.tipo);
    await expect(page.locator('.lead')).toHaveText(dados.descricao);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      dados.descricao,
    );
    await expect(page.locator('.chips .chip')).toHaveText(dados.ferramentas);
    const ficha = page.locator('.ficha');
    await expect(ficha.getByRole('heading', { level: 2 })).toHaveText('Detalhes do projeto');
    await expect(ficha.locator('dt')).toHaveText(['Local', 'Ano', 'Área', 'Equipe']);
    await expect(ficha.locator('dd')).toHaveText([
      dados.local,
      dados.ano,
      dados.area,
      dados.equipe,
    ]);
    // A Equipe só vira link quando o Projeto traz a URL; o campo de texto nunca traz HTML.
    const link = ficha.locator('dd a');
    await expect(link).toHaveCount(dados.equipeUrl ? 1 : 0);
    if (dados.equipeUrl !== undefined) {
      await expect(link).toHaveAttribute('href', dados.equipeUrl);
      await expect(link).toHaveText(dados.equipe);
    }
  });

  test(`${slug}: a Galeria traz as imagens do conteúdo, ou o estado Em breve`, async ({ page }) => {
    await page.goto(rota);
    // O título da seção ancora a Galeria para quem navega por cabeçalhos, com ou sem imagem.
    await expect(page.getByRole('heading', { level: 2, name: 'Galeria' })).toBeAttached();
    await expect(page.locator('.gal img')).toHaveCount(dados.galeria.length);

    const emBreve = page.getByText('Imagens em breve');
    if (dados.galeria.length === 0) {
      await expect(emBreve).toBeVisible();
      // A faixa do Em breve não tem imagem para limitar sua largura: precisa caber na tela.
      const transbordo = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(transbordo).toBe(0);
      return;
    }
    await expect(emBreve).toHaveCount(0);
    // Renders antes das pranchas: a ordem do arquivo é a ordem da página, imagem a imagem.
    for (const [n, caminho] of dados.galeria.entries()) {
      const imagem = page.locator('.gal img').nth(n);
      await expect(imagem).toHaveAttribute('src', new RegExp(`/${chaveDaImagem(caminho)}\\.`));
      await expect(imagem).toHaveAttribute('alt', `${dados.titulo} — imagem ${n + 1}`);
    }
  });

  test(`${slug}: a navegação leva ao Projeto anterior e ao próximo na Ordem`, async ({ page }) => {
    await page.goto(rota);
    const anterior = vizinho(i - 1);
    const proximo = vizinho(i + 1);
    const links = page.locator('.pn a');
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute('href', anterior.rota);
    await expect(links.first()).toContainText(anterior.dados.titulo);
    await expect(links.last()).toHaveAttribute('href', proximo.rota);
    await expect(links.last()).toContainText(proximo.dados.titulo);
  });
}

test('seguir o próximo Projeto até o fim dá a volta e retorna ao primeiro', async ({ page }) => {
  const primeiro = vizinho(0);
  await page.goto(primeiro.rota);
  for (const { slug } of [...projetos.slice(1), primeiro]) {
    await page.locator('.pn a.next').click();
    // A barra final é indiferente aqui: quem decide a forma canônica da URL é o Worker.
    await expect(page).toHaveURL(new RegExp(`/projetos/${slug}/?$`));
  }
});

// Daqui para baixo, a página aberta em detalhe: o que vale para uma Galeria com renders e
// pranchas é verificado uma vez, no Projeto que serviu de tracer bullet.
const detalhado = projetos.find(({ slug }) => slug === 'consultorio-ginecocare');
if (detalhado === undefined) throw new Error('o Projeto do detalhe saiu da collection');
const { rota, dados } = detalhado;

test('cada imagem sai em AVIF com alternativa WebP e variantes por largura', async ({ page }) => {
  await page.goto(rota);
  const fontesAvif = page.locator('.gal source[type="image/avif"]');
  await expect(fontesAvif).toHaveCount(dados.galeria.length);

  for (const srcset of await fontesAvif.evaluateAll((fontes) =>
    fontes.map((f) => f.getAttribute('srcset') ?? ''),
  )) {
    // O descritor é o último item de cada entrada; um `4w` dentro do hash do arquivo
    // enganaria uma busca solta por largura.
    const larguras = srcset
      .split(',')
      .map((entrada) => Number(entrada.trim().split(/\s+/)[1]?.replace('w', '')));
    expect(larguras.length).toBeGreaterThan(3);
    expect([...larguras].sort((a, b) => a - b)).toEqual(larguras);
    expect(new Set(larguras).size).toBe(larguras.length);
  }

  for (const src of await page
    .locator('.gal img')
    .evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src') ?? '')))
    expect(src).toMatch(/\.webp$/);
});

test('o navegador escolhe AVIF e nenhuma imagem da Galeria falha', async ({ page }) => {
  await page.goto(rota);
  // As três primeiras carregam de imediato; as demais só depois de entrarem na tela.
  await page.locator('.gal img').last().scrollIntoViewIfNeeded();
  const estados = await page.locator('.gal img').evaluateAll(async (imgs) => {
    await Promise.all(imgs.map((i) => (i as HTMLImageElement).decode().catch(() => {})));
    return imgs.map((i) => ({
      escolhida: (i as HTMLImageElement).currentSrc,
      largura: (i as HTMLImageElement).naturalWidth,
    }));
  });
  for (const { escolhida, largura } of estados) {
    expect(escolhida).toMatch(/\.avif$/);
    expect(largura).toBeGreaterThan(0);
  }
});

test('a abertura da Galeria ocupa a largura toda e não passa de meia largura em altura', async ({
  page,
}) => {
  await page.goto(rota);
  const destaque = page.locator('.gal .item').first();
  const galeria = page.locator('.gal');
  const [caixaDestaque, caixaGaleria] = await Promise.all([
    destaque.boundingBox(),
    galeria.boundingBox(),
  ]);
  expect(caixaDestaque?.width).toBeCloseTo(caixaGaleria?.width ?? 0, 0);
  // A abertura nunca fica mais alta que 2:1; uma imagem já mais panorâmica mantém a sua proporção.
  const proporcaoOriginal = await destaque
    .locator('img')
    .evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight);
  const esperada = Math.max(proporcaoOriginal, 2);
  expect((caixaDestaque?.width ?? 0) / (caixaDestaque?.height ?? 1)).toBeCloseTo(esperada, 1);
});
