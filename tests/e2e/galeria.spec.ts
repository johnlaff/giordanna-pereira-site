import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { projetos } from './projetos.ts';

// A Galeria aberta em detalhe, no Projeto que serviu de tracer bullet: linhas justificadas,
// variantes por largura e o lightbox. O que vale para toda Galeria — contagem de imagens,
// ordem e estado Em breve — é conferido em `projeto.spec.ts`, em cima da collection inteira.

const detalhado = projetos.find(({ slug }) => slug === 'consultorio-ginecocare');
if (detalhado === undefined) throw new Error('o Projeto do detalhe saiu da collection');
const { rota, dados } = detalhado;

const TAGS_AXE = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

// O PhotoSwipe mantém a imagem anterior e a próxima no DOM, fora da tela; a que está em cena é
// a do slide visível. Enquanto a imagem grande carrega, quem aparece é a miniatura esticada,
// e é ela que a animação de abertura move.
const EM_CENA = '.pswp__item[aria-hidden="false"] .pswp__img';
const CARREGADA = '.pswp__item[aria-hidden="false"] img.pswp__img:not(.pswp__img--placeholder)';

const imagemDoLightbox = (page: Page) => page.locator(CARREGADA);

const abrirLightbox = async (page: Page, indice = 0) => {
  await page.locator('.gal .item').nth(indice).click();
  await expect(page.locator('.pswp')).toBeVisible();
  await expect(imagemDoLightbox(page)).toBeVisible();
};

/**
 * A largura da imagem do lightbox a cada quadro enquanto a ação acontece. Uma animação passa
 * por larguras intermediárias; sem ela, a imagem aparece direto no tamanho final.
 */
const larguraQuadroAQuadro = async (page: Page, acao: () => Promise<void>) => {
  const coleta = page.evaluate(
    ({ duracao, seletor }) =>
      new Promise<number[]>((resolve) => {
        const larguras: number[] = [];
        const relogio = setInterval(() => {
          const img = document.querySelector(seletor);
          if (img !== null) larguras.push(Math.round(img.getBoundingClientRect().width));
        }, 16);
        setTimeout(() => {
          clearInterval(relogio);
          resolve(larguras);
        }, duracao);
      }),
    { duracao: 1500, seletor: EM_CENA },
  );
  await acao();
  return coleta;
};

/** As variantes de um `srcset`, da menor para a maior. */
const variantes = (srcset: string) =>
  srcset
    .split(',')
    .map((entrada) => entrada.trim().split(/\s+/))
    .map(([url, descritor]) => ({ url: url ?? '', largura: Number(descritor?.replace('w', '')) }))
    .sort((a, b) => a.largura - b.largura);

const srcsetDoLightbox = (page: Page) =>
  imagemDoLightbox(page).evaluate((img: HTMLImageElement) => img.srcset);

test('cada imagem sai em AVIF com alternativa WebP e variantes por largura', async ({ page }) => {
  await page.goto(rota);
  const fontesAvif = page.locator('.gal source[type="image/avif"]');
  await expect(fontesAvif).toHaveCount(dados.galeria.length);

  for (const srcset of await fontesAvif.evaluateAll((fontes) =>
    fontes.map((f) => f.getAttribute('srcset') ?? ''),
  )) {
    // O descritor é o último item de cada entrada; um `4w` dentro do hash do arquivo
    // enganaria uma busca solta por largura.
    const larguras = variantes(srcset).map(({ largura }) => largura);
    expect(larguras.length).toBeGreaterThan(3);
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
  const abertura = page.locator('.gal .item').first();
  const galeria = page.locator('.gal');
  const [caixaAbertura, caixaGaleria] = await Promise.all([
    abertura.boundingBox(),
    galeria.boundingBox(),
  ]);
  expect(caixaAbertura?.width).toBeCloseTo(caixaGaleria?.width ?? 0, 0);
  // A abertura nunca fica mais alta que 2:1; uma imagem já mais panorâmica mantém a sua proporção.
  const proporcaoOriginal = await abertura
    .locator('img')
    .evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight);
  const esperada = Math.max(proporcaoOriginal, 2);
  expect((caixaAbertura?.width ?? 0) / (caixaAbertura?.height ?? 1)).toBeCloseTo(esperada, 1);
});

test.describe('sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  // Antes do arranjo — e para sempre, sem JavaScript — a Galeria se sustenta só no CSS e na
  // proporção que o `width` e o `height` da imagem dão. Nada de `style` no HTML: a CSP o barra.
  test('a abertura não passa de meia largura e recorta a imagem no centro', async ({ page }) => {
    await page.goto(rota);
    const abertura = page.locator('.gal .item').first();
    const caixa = await abertura.boundingBox();
    const imagem = await abertura.locator('img').boundingBox();
    expect((caixa?.width ?? 0) / (caixa?.height ?? 1)).toBeCloseTo(2, 1);
    expect((imagem?.y ?? 0) + (imagem?.height ?? 0) / 2).toBeCloseTo(
      (caixa?.y ?? 0) + (caixa?.height ?? 0) / 2,
      0,
    );
    expect(await page.locator('.gal [style]').count()).toBe(0);
  });
});

test('as linhas da Galeria preenchem a largura toda, com uma só altura por linha', async ({
  page,
}) => {
  await page.goto(rota);
  await page.locator('.gal .item').last().scrollIntoViewIfNeeded();
  const linhas = await page.locator('.gal').evaluate((galeria) => {
    const borda = galeria.getBoundingClientRect();
    const porTopo = new Map<number, { direita: number; altura: number }[]>();
    for (const item of galeria.children) {
      const caixa = item.getBoundingClientRect();
      const topo = Math.round(caixa.top);
      const linha = porTopo.get(topo) ?? [];
      linha.push({
        direita: Math.round(caixa.right - borda.left),
        altura: Math.round(caixa.height),
      });
      porTopo.set(topo, linha);
    }
    return [...porTopo.values()].map((linha) => ({
      fim: Math.max(...linha.map(({ direita }) => direita)),
      alturas: [...new Set(linha.map(({ altura }) => altura))],
      largura: Math.round(borda.width),
    }));
  });

  expect(linhas.length).toBeGreaterThan(1);
  for (const { fim, alturas, largura } of linhas) {
    expect(Math.abs(fim - largura), `linha termina em ${fim} de ${largura}`).toBeLessThanOrEqual(2);
    expect(alturas, 'alturas diferentes na mesma linha').toHaveLength(1);
  }
});

// O arranjo reescreve o `sizes` de cada imagem, e só acerta a variante se rodar antes de o
// navegador escolhê-la. O script da Galeria chega num arquivo só: se ele importasse outro, o
// arranjo esperaria mais uma ida à rede e as imagens sairiam na variante do HTML, maior que a
// caixa. Foi o que o Sveltia provocou ao entrar no build, pelo carregador de módulos que os
// dois dividiriam (ADR 0014).
test('o script da Galeria não espera outro arquivo para arranjar as imagens', async ({
  page,
  request,
}) => {
  await page.goto(rota);
  const fontes = await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).src));
  const daGaleria = fontes.filter((fonte) => fonte.includes('Galeria'));
  expect(daGaleria).toHaveLength(1);
  const codigo = await (await request.get(daGaleria[0]!)).text();
  expect(codigo).not.toMatch(/(?:^|[;}\s])import\s*[{\w*][^;]*?from\s*["']/);
});

// A caixa de cada imagem sai do arranjo em linhas, não de uma fração fixa da largura: uma
// imagem sozinha na linha ocupa a Galeria inteira. Vale para todo Projeto, porque é o arranjo
// que decide, e ele muda com as proporções do conteúdo. Numa tela sem retina, a imagem pedida
// é uma vez e meia a caixa: o downscale curto do navegador borra menos que o encode no
// tamanho exato.
for (const { slug, rota: rotaDoProjeto, dados: projeto } of projetos.filter(
  ({ dados: { galeria } }) => galeria.length > 0,
)) {
  test(`${slug}: cada imagem carrega a variante que a caixa dela justifica`, async ({ page }) => {
    await page.goto(rotaDoProjeto);
    // Cada imagem precisa entrar na tela para o navegador escolher a variante dela.
    for (const item of await page.locator('.gal .item').all()) await item.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page
          .locator('.gal img')
          .evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).currentSrc !== '')),
      )
      .toBe(true);

    const escolhas = await page.locator('.gal .item').evaluateAll((itens) => {
      const imagens = itens.map((item) => item.querySelector('img')!);
      return itens.map((item, i) => ({
        escolhida: imagens[i]!.currentSrc,
        srcset:
          item.querySelector<HTMLSourceElement>('source[type="image/avif"]')?.srcset ??
          imagens[i]!.srcset,
        caixa: Math.round(
          imagens[i]!.getBoundingClientRect().width *
            window.devicePixelRatio *
            (window.devicePixelRatio < 1.5 ? 1.5 : 1),
        ),
      }));
    });

    expect(escolhas).toHaveLength(projeto.galeria.length);
    for (const { escolhida, srcset, caixa } of escolhas) {
      const disponiveis = variantes(srcset);
      const ideal = disponiveis.find((v) => v.largura >= caixa) ?? disponiveis.at(-1)!;
      const carregada = disponiveis.find((v) => escolhida.endsWith(v.url));
      expect(carregada, `variante fora do srcset: ${escolhida}`).toBeDefined();
      expect(
        carregada!.largura,
        `${escolhida} tem ${carregada!.largura}px para uma caixa que pede ${caixa}px`,
      ).toBeGreaterThanOrEqual(ideal.largura);
      expect(
        carregada!.largura,
        `${escolhida} é maior do que a caixa justifica`,
      ).toBeLessThanOrEqual(ideal.largura * 1.6);
    }
  });
}

// O arranjo calcula a altura, mas quem pinta é o CSS: o teto de recorte só vale se sobreviver
// à folha de estilo. Por isso a medida é a caixa renderizada, não o número que o JavaScript
// escreveu — e vale para todo Projeto, porque é o conteúdo que decide o quanto se perde.
for (const { slug, rota: rotaDoProjeto } of projetos.filter(
  ({ dados: { galeria } }) => galeria.length > 0,
)) {
  test(`${slug}: nenhuma imagem perde mais de um quarto da altura`, async ({ page }) => {
    await page.goto(rotaDoProjeto);
    for (const item of await page.locator('.gal .item').all()) await item.scrollIntoViewIfNeeded();
    const perdas = await page.locator('.gal .item').evaluateAll((itens) =>
      itens.map((item) => {
        const caixa = item.getBoundingClientRect();
        const proporcao = Number((item as HTMLElement).dataset.proporcao);
        const daCaixa = caixa.width / caixa.height;
        return {
          proporcao,
          perda: 1 - Math.min(daCaixa, proporcao) / Math.max(daCaixa, proporcao),
        };
      }),
    );
    for (const { proporcao, perda } of perdas)
      expect(
        perda,
        `imagem de proporção ${proporcao} perde ${(perda * 100).toFixed(1)}%`,
      ).toBeLessThanOrEqual(0.26);
  });
}

test('onde há cursor, a Galeria não mostra a pista de toque', async ({ page, isMobile }) => {
  test.skip(isMobile === true, 'a pista existe justamente no toque');
  await page.goto(rota);
  await expect(page.getByText('Toque numa imagem para abrir e ampliar')).toBeHidden();
});

test('a Galeria não empurra nada para fora da tela', async ({ page }) => {
  await page.goto(rota);
  await page.locator('.gal .item').last().scrollIntoViewIfNeeded();
  const transbordo = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(transbordo).toBe(0);
});

test('o lightbox abre na imagem clicada, com a legenda de posição e o título', async ({ page }) => {
  await page.goto(rota);
  await abrirLightbox(page, 1);
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', new RegExp(dados.titulo));
  await expect(page.locator('.lb-legenda b')).toHaveText(`2 / ${dados.galeria.length}`);
  await expect(page.locator('.lb-legenda span')).toHaveText(dados.titulo);
});

test('as setas percorrem a Galeria em loop, do primeiro ao último', async ({ page }) => {
  await page.goto(rota);
  await abrirLightbox(page, 0);
  const contador = page.locator('.lb-legenda b');
  await expect(contador).toHaveText(`1 / ${dados.galeria.length}`);
  await page.keyboard.press('ArrowLeft');
  await expect(contador).toHaveText(`${dados.galeria.length} / ${dados.galeria.length}`);
  await page.keyboard.press('ArrowRight');
  await expect(contador).toHaveText(`1 / ${dados.galeria.length}`);
});

test('Escape fecha o lightbox e devolve o foco à imagem de onde ele abriu', async ({ page }) => {
  await page.goto(rota);
  await abrirLightbox(page, 2);
  await page.keyboard.press('Escape');
  await expect(page.locator('.pswp')).toHaveCount(0);
  await expect(page.locator('.gal .item').nth(2)).toBeFocused();
});

test('Esc fecha o lightbox mesmo antes de a abertura terminar', async ({ page }) => {
  await page.goto(rota);
  const lightbox = page.locator('.pswp');
  // A primeira abertura baixa o módulo do lightbox e fecha do jeito comum.
  await abrirLightbox(page, 0);
  await page.keyboard.press('Escape');
  await expect(lightbox).toHaveCount(0);

  // Esc no intervalo entre o clique e a tela cheia existir: a abertura é cancelada.
  await page.locator('.gal .item').first().click();
  await page.keyboard.press('Escape');
  await expect(lightbox).toHaveCount(0);

  // Esc com a animação de abertura em curso: o fechamento espera ela terminar.
  await page.locator('.gal .item').first().click();
  await lightbox.waitFor({ state: 'attached' });
  await page.keyboard.press('Escape');
  await expect(lightbox).toHaveCount(0);
});

test('axe não encontra violação com o lightbox aberto', async ({ page }) => {
  await page.goto(rota);
  await abrirLightbox(page, 0);
  const resultado = await new AxeBuilder({ page }).withTags(TAGS_AXE).analyze();
  expect(resultado.violations).toEqual([]);
});

test('o foco fica preso no diálogo enquanto o lightbox está aberto', async ({ page }) => {
  const noDialogo = () => page.evaluate(() => document.activeElement?.closest('.pswp') !== null);
  await page.goto(rota);
  await abrirLightbox(page, 0);
  // Focar o que está atrás do lightbox devolve o foco ao diálogo, e a tabulação o mantém lá.
  await page.locator('.gal .item').nth(3).focus();
  expect(await noDialogo(), 'o foco escapou para a página atrás').toBe(true);
  // Uma volta inteira pelos controles, e mais uma: o ciclo se fecha dentro do diálogo.
  for (let passo = 0; passo < 8; passo++) {
    await page.keyboard.press('Tab');
    expect(await noDialogo(), `a tabulação levou o foco para fora no passo ${passo + 1}`).toBe(
      true,
    );
  }
  for (let passo = 0; passo < 8; passo++) {
    await page.keyboard.press('Shift+Tab');
    expect(await noDialogo(), `Shift+Tab levou o foco para fora no passo ${passo + 1}`).toBe(true);
  }
});

test('aberto pelo teclado, o lightbox devolve o foco à imagem ao fechar', async ({ page }) => {
  await page.goto(rota);
  const imagem = page.locator('.gal .item').nth(1);
  await imagem.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pswp')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.pswp')).toHaveCount(0);
  await expect(imagem).toBeFocused();
});

test('com prefers-reduced-motion a abertura não é animada', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(rota);
  const larguras = await larguraQuadroAQuadro(page, () => abrirLightbox(page, 0));
  expect(larguras.length).toBeGreaterThan(5);
  expect(new Set(larguras).size, 'a imagem passou por tamanhos intermediários').toBe(1);
});

test('sem essa preferência, a abertura anima a partir da miniatura', async ({ page }) => {
  await page.goto(rota);
  const larguras = await larguraQuadroAQuadro(page, () => abrirLightbox(page, 0));
  expect(new Set(larguras).size, 'a abertura não animou').toBeGreaterThan(2);
});

test('o lightbox carrega a variante que a tela justifica, sem requisição falha', async ({
  page,
}) => {
  const falhas: string[] = [];
  page.on('response', (resposta) => {
    if (resposta.status() >= 400) falhas.push(`${resposta.status()} ${resposta.url()}`);
  });
  await page.goto(rota);
  await abrirLightbox(page, 0);

  const { escolhida, srcset, largura, dpr } = await imagemDoLightbox(page).evaluate(
    (img: HTMLImageElement) => ({
      escolhida: img.currentSrc,
      srcset: img.srcset,
      // O PhotoSwipe põe em `sizes` a largura em que a imagem está sendo exibida.
      largura: parseFloat(img.sizes),
      dpr: window.devicePixelRatio,
    }),
  );

  const disponiveis = variantes(srcset);
  // A variante ideal é a menor que cobre os pixels do aparelho; se nenhuma cobre, a maior.
  const ideal = disponiveis.find((v) => v.largura >= largura * dpr) ?? disponiveis.at(-1)!;
  const carregada = disponiveis.find((v) => escolhida.endsWith(v.url));
  expect(carregada, `variante fora do srcset: ${escolhida}`).toBeDefined();
  expect(carregada!.largura, 'imagem menor do que a tela justifica').toBeGreaterThanOrEqual(
    ideal.largura,
  );
  expect(carregada!.largura, 'variante maior do que o necessário').toBeLessThanOrEqual(
    ideal.largura * 1.6,
  );
  expect(falhas).toEqual([]);
});

// Em tela de toque não existe cursor nem hover: a Galeria anuncia em texto o que a imagem faz,
// e a tela cheia usa cada pixel de largura que tem.
test.describe('em tela de toque', () => {
  test.skip(({ isMobile }) => isMobile !== true, 'a pista de toque não existe onde há cursor');

  test('a Galeria diz que a imagem abre em tela cheia', async ({ page }) => {
    await page.goto(rota);
    await expect(page.getByText('Toque numa imagem para abrir e ampliar')).toBeVisible();
  });

  test('a imagem em tela cheia vai de borda a borda', async ({ page }) => {
    await page.goto(rota);
    await abrirLightbox(page, 0);
    const caixa = await imagemDoLightbox(page).boundingBox();
    const tela = page.viewportSize()!;
    expect(caixa?.x).toBeLessThanOrEqual(1);
    expect(caixa?.width).toBeCloseTo(tela.width, 0);
  });

  test('ampliar enche a tela, em vez de saltar para o tamanho real', async ({ page }) => {
    await page.goto(rota);
    await abrirLightbox(page, 0);
    const imagem = imagemDoLightbox(page);
    const tela = page.viewportSize()!;
    await page.locator('.pswp__button--zoom').click();
    await expect
      .poll(async () => (await imagem.boundingBox())?.height ?? 0)
      .toBeGreaterThan(tela.height * 0.8);
    // Encheu a altura disponível e transbordou a largura: a imagem é lida de perto, aos pedaços.
    const ampliada = (await imagem.boundingBox())!;
    expect(ampliada.width).toBeGreaterThan(tela.width);
  });
});

// Zoom com mouse: no celular, o mesmo gesto é o duplo toque, coberto pelo PhotoSwipe.
test.describe('com mouse', () => {
  test.skip(({ isMobile }) => isMobile === true, 'gestos de mouse não existem no celular');

  test('o clique amplia a imagem e o seguinte devolve ao ajuste', async ({ page }) => {
    await page.goto(rota);
    await abrirLightbox(page, 0);
    const imagem = imagemDoLightbox(page);
    const ajustada = (await imagem.boundingBox())?.width ?? 0;
    expect(ajustada).toBeGreaterThan(0);

    await imagem.click();
    await expect
      .poll(async () => (await imagem.boundingBox())?.width ?? 0)
      .toBeGreaterThan(ajustada * 1.5);

    await imagem.click();
    await expect
      .poll(async () => Math.round((await imagem.boundingBox())?.width ?? 0))
      .toBe(Math.round(ajustada));
  });

  test('a roda do mouse amplia a imagem', async ({ page }) => {
    await page.goto(rota);
    await abrirLightbox(page, 0);
    const imagem = imagemDoLightbox(page);
    const ajustada = (await imagem.boundingBox())?.width ?? 0;
    await imagem.hover();
    await page.mouse.wheel(0, -240);
    await expect
      .poll(async () => (await imagem.boundingBox())?.width ?? 0)
      .toBeGreaterThan(ajustada * 1.05);
  });

  test('com prefers-reduced-motion o zoom não é animado', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(rota);
    await abrirLightbox(page, 0);
    const imagem = imagemDoLightbox(page);
    const larguras = await larguraQuadroAQuadro(page, () => imagem.click());
    // Só o ajuste e o dobro dele: sem passo intermediário entre os dois.
    expect(new Set(larguras).size, 'o zoom passou por tamanhos intermediários').toBeLessThanOrEqual(
      2,
    );
  });

  test('com a imagem ampliada, arrastar move a imagem', async ({ page }) => {
    await page.goto(rota);
    await abrirLightbox(page, 0);
    const imagem = imagemDoLightbox(page);
    const ajustada = (await imagem.boundingBox())?.width ?? 0;
    await imagem.click();
    await expect
      .poll(async () => (await imagem.boundingBox())?.width ?? 0)
      .toBeGreaterThan(ajustada * 1.5);

    const antes = (await imagem.boundingBox())!;
    const centro = { x: antes.x + antes.width / 2, y: antes.y + antes.height / 2 };
    await page.mouse.move(centro.x, centro.y);
    await page.mouse.down();
    await page.mouse.move(centro.x - 150, centro.y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await imagem.boundingBox())?.x ?? 0).toBeLessThan(antes.x - 50);
  });

  test('a imagem ampliada sobe para a maior variante disponível', async ({ page }) => {
    await page.goto(rota);
    await abrirLightbox(page, 0);
    const imagem = imagemDoLightbox(page);
    const maior = variantes(await srcsetDoLightbox(page)).at(-1)!;
    await imagem.click();
    await expect
      .poll(() => imagem.evaluate((img: HTMLImageElement) => img.currentSrc))
      .toContain(maior.url);
  });
});

test.describe('em tela QHD', () => {
  test.use({ viewport: { width: 2560, height: 1440 } });
  test.skip(({ isMobile }) => isMobile === true, 'o celular tem a sua própria medição');

  test('a prancha ampliada carrega a variante de 2560 px', async ({ page }) => {
    await page.goto(rota);
    // A última imagem da Galeria é uma prancha, o arquivo mais largo do Projeto.
    await abrirLightbox(page, dados.galeria.length - 1);
    const imagem = imagemDoLightbox(page);
    const maior = variantes(await srcsetDoLightbox(page)).at(-1)!;
    expect(maior.largura).toBe(2560);
    await imagem.click();
    await expect
      .poll(() => imagem.evaluate((img: HTMLImageElement) => img.currentSrc))
      .toContain(maior.url);
  });
});

// A prancha em alta (ADR 0015): a página e a tela cheia ficam nas variantes de até 2560 px, e só
// o zoom pede a prancha inteira, sem perda, até o tamanho real dela — onde o texto se lê.
test.describe('a prancha em alta', () => {
  const miniCasa = projetos.find(({ slug }) => slug === 'mini-casa');
  if (miniCasa === undefined) throw new Error('a Mini Casa saiu da collection');
  // A segunda imagem da Mini Casa é a planta, em 7680 px.
  const PLANTA = 1;
  const INTEIRA = 7680;

  test('a página não pede mais que 2560 px de nenhuma imagem', async ({ page }) => {
    await page.goto(miniCasa.rota);
    const srcsets = await page
      .locator('.gal source, .gal img')
      .evaluateAll((fontes) => fontes.map((f) => f.getAttribute('srcset') ?? ''));
    for (const srcset of srcsets)
      expect(Math.max(...variantes(srcset).map(({ largura }) => largura))).toBeLessThanOrEqual(
        2560,
      );
  });

  test('a tela cheia só pede a prancha inteira quando o zoom passa da maior variante', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile === true, 'a roda do mouse não existe no celular');
    const pedidas: string[] = [];
    page.on('request', (pedido) => pedidas.push(pedido.url()));
    await page.goto(miniCasa.rota);
    await abrirLightbox(page, PLANTA);
    const imagem = imagemDoLightbox(page);
    const inteira = variantes(await srcsetDoLightbox(page)).at(-1)!;
    expect(inteira.largura).toBe(INTEIRA);
    expect(pedidas.some((url) => url.endsWith(inteira.url))).toBe(false);

    // A roda amplia até o teto, que é o tamanho real da prancha.
    await imagem.hover();
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -400);
    await expect
      .poll(async () => Math.round((await imagem.boundingBox())?.width ?? 0))
      .toBe(INTEIRA);
    await expect
      .poll(() => imagem.evaluate((img: HTMLImageElement) => img.currentSrc))
      .toContain(inteira.url);
  });

  test('a prancha inteira chega sem perda, do tamanho do arquivo do repositório', async ({
    page,
  }) => {
    await page.goto(miniCasa.rota);
    await abrirLightbox(page, PLANTA);
    const inteira = variantes(await srcsetDoLightbox(page)).at(-1)!;
    const resposta = await page.request.get(inteira.url);
    expect(resposta.ok()).toBe(true);
    expect(resposta.headers()['content-type']).toBe('image/webp');
    const bytes = await resposta.body();
    // Um WebP sem perda começa o bloco de imagem por VP8L; o com perda, por "VP8 ".
    expect(bytes.subarray(12, 16).toString('ascii')).toBe('VP8L');
  });
});
