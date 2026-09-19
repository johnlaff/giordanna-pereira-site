import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { parse } from 'yaml';
import { site } from '../../src/config.ts';

// O conteúdo é a fonte da verdade: a página é conferida contra o arquivo do Projeto, não
// contra strings repetidas no teste.
type Projeto = {
  titulo: string;
  tipo: string;
  descricao: string;
  ferramentas: string[];
  local: string;
  ano: string;
  area: string;
  equipe: string;
  equipeUrl?: string;
  galeria: string[];
};
const projeto: Projeto = parse(
  readFileSync('src/content/projetos/consultorio-ginecocare.yml', 'utf8'),
);
const rota = '/projetos/consultorio-ginecocare';

test('a página do Projeto abre com título, Tipo e descrição do conteúdo', async ({ page }) => {
  const resposta = await page.goto(rota);
  expect(resposta?.status()).toBe(200);
  await expect(page).toHaveTitle(`${projeto.titulo} — ${site.nome}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(projeto.titulo);
  await expect(page.locator('.page-head .kind')).toHaveText(projeto.tipo);
  await expect(page.locator('.lead')).toHaveText(projeto.descricao);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    projeto.descricao,
  );
});

test('as Ferramentas aparecem na ordem do conteúdo', async ({ page }) => {
  await page.goto(rota);
  await expect(page.locator('.chips .chip')).toHaveText(projeto.ferramentas);
});

test('a Ficha técnica lista Local, Ano, Área e Equipe', async ({ page }) => {
  await page.goto(rota);
  const ficha = page.locator('.ficha');
  await expect(ficha.getByRole('heading', { level: 2 })).toHaveText('Detalhes do projeto');
  await expect(ficha.locator('dt')).toHaveText(['Local', 'Ano', 'Área', 'Equipe']);
  await expect(ficha.locator('dd')).toHaveText([
    projeto.local,
    projeto.ano,
    projeto.area,
    projeto.equipe,
  ]);
});

test('a Equipe só vira link quando o Projeto traz a URL', async ({ page }) => {
  await page.goto(rota);
  const links = page.locator('.ficha dd a');
  await expect(links).toHaveCount(projeto.equipeUrl ? 1 : 0);
});

test('a Galeria traz todas as imagens do conteúdo, renders antes das pranchas', async ({
  page,
}) => {
  await page.goto(rota);
  const imagens = page.locator('.gal img');
  await expect(imagens).toHaveCount(projeto.galeria.length);
  for (const [i, caminho] of projeto.galeria.entries()) {
    const chave = caminho.split('/').pop()?.replace('.webp', '');
    await expect(imagens.nth(i)).toHaveAttribute('src', new RegExp(`/${chave}\\.`));
    await expect(imagens.nth(i)).toHaveAttribute('alt', `${projeto.titulo} — imagem ${i + 1}`);
  }
});

test('a Galeria é ancorada por um título, para quem navega por cabeçalhos', async ({ page }) => {
  await page.goto(rota);
  // O título é só para leitor de tela: existe na árvore de acessibilidade e não ocupa tela.
  const titulo = page.getByRole('heading', { level: 2, name: 'Galeria' });
  await expect(titulo).toBeAttached();
  const caixa = await titulo.boundingBox();
  expect(caixa?.width).toBeLessThanOrEqual(1);
  expect(caixa?.height).toBeLessThanOrEqual(1);
});

test('cada imagem sai em AVIF com alternativa WebP e variantes por largura', async ({ page }) => {
  await page.goto(rota);
  const fontesAvif = page.locator('.gal source[type="image/avif"]');
  await expect(fontesAvif).toHaveCount(projeto.galeria.length);

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
