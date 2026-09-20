import { expect, test, type Page } from '@playwright/test';
import { contatos, cta, familiaridade, hero, sobre } from '../../src/config.ts';
import { corDoPixel, lerPng, luminancia } from './pixels.ts';

// A home é a página que o Preview aprovado define em maior detalhe. O que esta suíte guarda
// são os acertos que já custaram bug lá: a variante que o hero baixa em cada tela, o escuro
// atrás do cabeçalho transparente e o movimento que precisa sumir com `prefers-reduced-motion`.

/** A variante que o navegador de fato escolheu, com a largura anunciada no `srcset`. */
const varianteDoHero = async (page: Page) => {
  const imagem = page.locator('.hero-img img');
  await expect(imagem).toHaveJSProperty('complete', true);
  return imagem.evaluate((el) => {
    const img = el as HTMLImageElement;
    const srcsets = [
      ...[...(img.closest('picture')?.querySelectorAll('source') ?? [])].map((f) => f.srcset),
      img.srcset,
    ];
    for (const srcset of srcsets)
      for (const entrada of srcset.split(',')) {
        const [url = '', descritor = ''] = entrada.trim().split(/\s+/);
        if (url !== '' && new URL(url, location.href).href === img.currentSrc)
          return { url, largura: Number(descritor.replace('w', '')) };
      }
    throw new Error(`variante fora do srcset: ${img.currentSrc}`);
  });
};

/** Abre a home na tela pedida e devolve as URLs de imagem que o navegador chegou a buscar. */
const abrirEm = async (page: Page, largura: number, altura: number) => {
  await page.setViewportSize({ width: largura, height: altura });
  const buscadas: string[] = [];
  page.on('response', (resposta) => {
    if (resposta.request().resourceType() === 'image') buscadas.push(resposta.url());
  });
  await page.goto('/');
  await page.waitForLoadState('load');
  return buscadas;
};

/** A variante escolhida, conferida contra o que a rede de fato buscou. */
const varianteBuscada = async (page: Page, buscadas: string[]) => {
  const variante = await varianteDoHero(page);
  const absoluta = new URL(variante.url, page.url()).href;
  expect(buscadas, 'a variante do hero não apareceu na rede').toContain(absoluta);
  return variante.largura;
};

test('o hero abre a home com o título, a legenda e o atalho às redes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${hero.titulo} ${hero.enfase}`);
  await expect(page.locator('.hero-sub')).toHaveText(hero.subtitulo);
  await expect(page.locator('.hero-cap')).toHaveText(hero.legenda);

  const redes = page.getByRole('navigation', { name: 'Redes sociais' }).getByRole('link');
  await expect(redes).toHaveCount(contatos.length);
  for (const [i, contato] of contatos.entries())
    await expect(redes.nth(i)).toHaveAttribute('href', contato.href);
});

test('a imagem do hero carrega de imediato e com prioridade', async ({ page }) => {
  await page.goto('/');
  const imagem = page.locator('.hero-img img');
  await expect(imagem).toHaveAttribute('fetchpriority', 'high');
  await expect(imagem).not.toHaveAttribute('loading', 'lazy');
  await expect(imagem).toHaveAttribute('alt', hero.alt);
});

test('em desktop o hero baixa uma variante de pelo menos 1920 px', async ({ page }) => {
  const buscadas = await abrirEm(page, 1440, 900);
  expect(await varianteBuscada(page, buscadas)).toBeGreaterThanOrEqual(1920);
});

test('em tela grande o hero baixa a variante nativa de 2304 px', async ({ page }) => {
  const buscadas = await abrirEm(page, 2560, 1440);
  expect(await varianteBuscada(page, buscadas)).toBe(2304);
});

test('em tela de celular o hero não baixa uma variante de desktop', async ({ page }) => {
  // 375 px de tela a três pontos por pixel pedem 1192 px de imagem: a de 1280 serve, e as de
  // 1920 e 2304 seriam peso jogado fora no 4G. É esse desperdício que o teto guarda.
  const buscadas = await abrirEm(page, 375, 812);
  expect(await varianteBuscada(page, buscadas)).toBeLessThanOrEqual(1280);
});

test('com prefers-reduced-motion o hero fica parado', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const animacao = (seletor: string) =>
    page.locator(seletor).evaluate((el) => getComputedStyle(el).animationName);
  expect(await animacao('.hero-img')).toBe('none');
  expect(await animacao('.scrollcue b')).toBe('none');
});

test('sem prefers-reduced-motion o hero tem o Ken Burns', async ({ page }) => {
  await page.goto('/');
  const animacao = await page.locator('.hero-img').evaluate((el) => {
    const { animationName, width } = getComputedStyle(el);
    return { animationName, largura: parseFloat(width), tela: innerWidth };
  });
  expect(animacao.animationName).not.toBe('none');
  // 106% da largura da tela: a folga lateral que o Ken Burns percorre sem mostrar o fundo.
  expect(animacao.largura).toBeCloseTo(animacao.tela * 1.06, 0);
});

test('Sobre traz a apresentação e as quatro credenciais', async ({ page }) => {
  await page.goto('/');
  const secao = page.locator('.about');
  await expect(secao.getByRole('heading', { level: 2 })).toHaveText(
    `${sobre.titulo} ${sobre.enfase}`,
  );
  await expect(secao.locator('p')).toHaveCount(sobre.paragrafos.length);
  for (const [i, paragrafo] of sobre.paragrafos.entries())
    await expect(secao.locator('p').nth(i)).toHaveText(paragrafo);

  const rotulos = secao.locator('.cred dt');
  await expect(rotulos).toHaveText(sobre.credenciais.map(({ rotulo }) => rotulo));
  await expect(secao.locator('img')).toHaveAttribute('alt', sobre.retratoAlt);
});

test('a moldura do retrato fica atrás da foto e continua visível', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const foto = page.locator('.about-photo');
  await foto.scrollIntoViewIfNeeded();
  await expect(foto).toHaveClass(/\bin\b/);
  await expect(foto.locator('img')).toHaveJSProperty('complete', true);
  // A moldura entra junto com a foto: sem esperar a transição, o pixel ainda está em branco.
  await page.waitForTimeout(1200);

  const { direita, meio, escala } = await foto.evaluate((el) => {
    const caixa = el.getBoundingClientRect();
    return { direita: caixa.right, meio: caixa.top + caixa.height / 2, escala: devicePixelRatio };
  });
  const tela = lerPng(await page.screenshot());
  // A moldura sobra 14 px à direita da foto e tem 1 px de traço; a amostra varre essa faixa.
  const faixa = [12, 13, 14].map((recuo) =>
    corDoPixel(tela, Math.round((direita + recuo) * escala), Math.round(meio * escala)),
  );

  expect(await foto.evaluate((el) => getComputedStyle(el).isolation)).toBe('isolate');
  // Areia sobre o navy da seção dá por volta de (110, 110, 109); o navy puro, (46, 58, 72).
  expect(Math.max(...faixa.map(({ r }) => r))).toBeGreaterThan(85);
});

test('Familiaridade lista as ferramentas da maior para a menor', async ({ page }) => {
  await page.goto('/');
  const ferramentas = page.locator('.tools-grid .tool');
  await expect(ferramentas).toHaveText(familiaridade.itens.map(({ nome }) => nome));

  const niveis = await ferramentas.evaluateAll((itens) =>
    itens.map((item) => Number(item.className.match(/\bt(\d)\b/)?.[1])),
  );
  expect(niveis).toEqual(familiaridade.itens.map(({ nivel }) => nivel));
  expect([...niveis]).toEqual([...niveis].sort((a, b) => a - b));
});

test('a chamada do fim da home leva à Grade de projetos', async ({ page }) => {
  await page.goto('/');
  const convite = page.locator('.cta').getByRole('link', { name: cta.rotulo });
  await expect(convite).toHaveAttribute('href', cta.href);
  await expect(page.locator('.cta').getByRole('heading', { level: 2 })).toHaveText(
    `${cta.titulo} ${cta.enfase}`,
  );
});

// Contraste mínimo de 4,5:1 (WCAG 2.2 AA) entre o texto do cabeçalho, rgb(241, 242, 240), e a
// faixa atrás dele: em cinza de 0 a 255, o fundo não pode passar de 110.
const TETO_DA_FAIXA = 110;

/**
 * A luminância média da faixa que fica atrás do cabeçalho, no pior quadro do Ken Burns: a
 * aproximação muda o que aparece ali, então a medida congela a animação em três pontos do
 * ciclo e fica com o mais claro dos três.
 */
const faixaDoCabecalho = async (page: Page) => {
  const alturaDaFaixa = await page
    .locator('.hdr')
    .evaluate((el) => el.getBoundingClientRect().bottom);
  const escala = await page.evaluate(() => devicePixelRatio);

  const medidas: number[] = [];
  for (const segundos of [0, 13, 26]) {
    await page.addStyleTag({
      content: `.hero-img{animation-play-state:paused;animation-delay:-${segundos}s}`,
    });
    const tela = lerPng(await page.screenshot());
    let soma = 0;
    let pontos = 0;
    for (let y = 0; y < Math.round(alturaDaFaixa * escala); y++)
      for (let x = 0; x < tela.largura; x++) {
        soma += luminancia(corDoPixel(tela, x, y));
        pontos++;
      }
    medidas.push(soma / pontos);
  }
  return Math.max(...medidas);
};

test('a faixa atrás do cabeçalho é escura mesmo antes de o render pintar', async ({ page }) => {
  await page.route('**/_astro/**.{avif,webp}', (rota) => rota.abort());
  await page.goto('/');
  expect(await faixaDoCabecalho(page)).toBeLessThan(TETO_DA_FAIXA);
});

test('a faixa atrás do cabeçalho continua escura com o render no lugar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero-img img')).toHaveJSProperty('complete', true);
  expect(await faixaDoCabecalho(page)).toBeLessThan(TETO_DA_FAIXA);
});
