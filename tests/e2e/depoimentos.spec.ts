import { expect, test, type Page } from '@playwright/test';
import { depoimentos as secao } from '../../src/config.ts';
import { depoimentos } from './depoimentos.ts';

// O carrossel de Depoimentos, herdado do Preview: giro infinito por cópias nas duas pontas,
// arraste que convive com a seleção de texto e reposicionamento que espera o gesto acabar.
// São os acertos que custaram bug lá, migrados para o seam 1 — Playwright contra o site
// construído. O conteúdo vem da collection, nunca de uma lista repetida aqui.

const ULTIMO = depoimentos.length - 1;
const aguardandoTexto = depoimentos.filter(({ texto }) => texto === undefined);

const trilho = (page: Page) => page.locator('.qtrack');
const rolagem = (page: Page) => trilho(page).evaluate((el) => el.scrollLeft);

/** Os Depoimentos em cena. Uma cópia em cena conta: para quem olha, ela é o Depoimento. */
const emCena = (page: Page) =>
  page.locator('.qcard:not(.dim) b').evaluateAll((nomes) => nomes.map((n) => n.textContent ?? ''));

/** Espera a faixa parar de rolar e o carrossel assentar a posição — o salto do giro inclusive. */
const esperarParado = async (page: Page) => {
  let anterior = Number.NaN;
  await expect
    .poll(
      async () => {
        const atual = await rolagem(page);
        const parado = atual === anterior;
        anterior = atual;
        return parado;
      },
      { timeout: 10_000, intervals: [150] },
    )
    .toBe(true);
};

const abrirOsDepoimentos = async (page: Page) => {
  await page.goto('/');
  await page.locator('#depoimentos').scrollIntoViewIfNeeded();
  await expect(page.locator('.qcar')).toHaveClass(/\bin\b/);
  await esperarParado(page);
};

const andar = async (page: Page, rotulo: 'Próximo depoimento' | 'Depoimento anterior') => {
  await page.getByRole('button', { name: rotulo }).click();
  await esperarParado(page);
};

/** Um ponto na superfície do card em cena, fora do texto: a faixa que arrasta. */
const superficieDoCard = async (page: Page) => {
  const caixa = await page.locator('.qcard:not(.dim)').first().boundingBox();
  if (caixa === null) throw new Error('nenhum card em cena');
  return { x: caixa.x + caixa.width - 12, y: caixa.y + caixa.height / 2 };
};

/** Arrasta com o mouse a partir de um ponto e, se pedido, segura parado antes de soltar. */
const arrastar = async (
  page: Page,
  origem: { x: number; y: number },
  deslocamento: number,
  { segurar = 0, soltar = true } = {},
) => {
  await page.mouse.move(origem.x, origem.y);
  await page.mouse.down();
  const passos = 10;
  for (let i = 1; i <= passos; i++) {
    await page.mouse.move(origem.x + (deslocamento * i) / passos, origem.y);
    await page.waitForTimeout(16);
  }
  if (segurar > 0) await page.waitForTimeout(segurar);
  if (soltar) await page.mouse.up();
};

test('o carrossel mostra os Depoimentos da collection, na ordem do conteúdo', async ({ page }) => {
  await abrirOsDepoimentos(page);
  const cards = page.locator('.qcard:not(.clone)');
  await expect(cards).toHaveCount(depoimentos.length);
  await expect(cards.locator('b')).toHaveText(depoimentos.map(({ nome }) => nome));
  await expect(cards.locator('figcaption span')).toHaveText(depoimentos.map(({ papel }) => papel));
});

test('um Depoimento sem texto aparece como Em breve', async ({ page }) => {
  test.skip(aguardandoTexto.length === 0, 'nenhum Depoimento está aguardando texto');
  await abrirOsDepoimentos(page);
  const cards = page.locator('.qcard:not(.clone)');
  for (const [i, depoimento] of depoimentos.entries()) {
    const card = cards.nth(i);
    const paragrafo = card.locator('p');
    if (depoimento.texto !== undefined) {
      await expect(card, depoimento.nome).not.toHaveClass(/\bsoon\b/);
      await expect(paragrafo).toHaveText(depoimento.texto);
      continue;
    }
    await expect(card, depoimento.nome).toHaveClass(/\bsoon\b/);
    await expect(paragrafo).toHaveCSS('font-style', 'italic');
    const escrito = await paragrafo.evaluate((el) => el.textContent ?? '');
    // O espaço antes de "breve" é inquebrável: a palavra não cai sozinha na última linha.
    expect(escrito).toContain('\u00a0');
    expect(escrito.replace(/\u00a0/g, ' ')).toBe('Depoimento em breve.');
  }
});

test('o carrossel se anuncia como carrossel e cada card diz a sua posição', async ({ page }) => {
  await abrirOsDepoimentos(page);
  const regiao = page.locator('.qcar');
  await expect(regiao).toHaveAttribute('aria-roledescription', 'carrossel');
  await expect(regiao).toHaveAttribute('aria-label', secao.rotulo);

  const cards = page.locator('.qcard:not(.clone)');
  for (const [i] of depoimentos.entries())
    await expect(cards.nth(i)).toHaveAttribute('aria-label', `${i + 1} de ${depoimentos.length}`);

  // As cópias existem para a rolagem, não para quem ouve a página: são dezoito cards no DOM
  // e seis Depoimentos anunciados.
  const copias = page.locator('.qcard.clone');
  await expect(copias).toHaveCount(depoimentos.length * 2);
  for (const copia of await copias.all()) {
    await expect(copia).toHaveAttribute('aria-hidden', 'true');
    await expect(copia).toHaveAttribute('inert', '');
  }
});

test('o que está fora da janela do carrossel não é lido nem recebe foco', async ({ page }) => {
  await abrirOsDepoimentos(page);
  const fora = page.locator('.qcard:not(.clone).dim');
  expect(await fora.count()).toBeGreaterThan(0);
  for (const card of await fora.all()) {
    await expect(card).toHaveAttribute('aria-hidden', 'true');
    await expect(card).toHaveAttribute('inert', '');
  }
  for (const card of await page.locator('.qcard:not(.clone):not(.dim)').all()) {
    await expect(card).toHaveAttribute('aria-hidden', 'false');
    await expect(card).not.toHaveAttribute('inert', '');
  }
});

test('o carrossel abre no primeiro Depoimento', async ({ page }) => {
  await abrirOsDepoimentos(page);
  expect((await emCena(page))[0]).toBe(depoimentos[0]?.nome);
});

test('a seta avança um Depoimento e uma volta inteira devolve o começo', async ({ page }) => {
  await abrirOsDepoimentos(page);
  const começo = await emCena(page);

  await andar(page, 'Próximo depoimento');
  expect((await emCena(page))[0]).toBe(depoimentos[1]?.nome);

  for (let i = 1; i < depoimentos.length; i++) await andar(page, 'Próximo depoimento');
  expect(await emCena(page)).toEqual(começo);
});

test('a seta para trás, no primeiro Depoimento, mostra o último', async ({ page }) => {
  await abrirOsDepoimentos(page);
  await andar(page, 'Depoimento anterior');
  expect((await emCena(page))[0]).toBe(depoimentos[ULTIMO]?.nome);
  await andar(page, 'Próximo depoimento');
  expect((await emCena(page))[0]).toBe(depoimentos[0]?.nome);
});

type Amostra = { posicao: number; emCena: string[] };

/** Acompanha a faixa quadro a quadro enquanto ela cruza uma das pontas do giro. */
const cruzarAPonta = async (page: Page, rotulo: 'Próximo depoimento' | 'Depoimento anterior') => {
  const coleta = page.evaluate(
    (duracao) =>
      new Promise<Amostra[]>((resolve) => {
        const faixa = document.querySelector('.qtrack')!;
        const amostras: Amostra[] = [];
        const relogio = setInterval(() => {
          const janela = faixa.getBoundingClientRect();
          amostras.push({
            posicao: faixa.scrollLeft,
            // Quem está em cena se mede pela geometria, e não pela classe `dim`: o que
            // importa é o que o olho alcança no quadro, não o estado que o script ainda vai
            // aplicar.
            emCena: [...document.querySelectorAll('.qcard')]
              .filter((card) => {
                const caixa = card.getBoundingClientRect();
                return caixa.right > janela.left + 6 && caixa.left < janela.right - 6;
              })
              .map((card) => card.querySelector('b')?.textContent ?? ''),
          });
        }, 16);
        setTimeout(() => {
          clearInterval(relogio);
          resolve(amostras);
        }, duracao);
      }),
    1600,
  );
  await andar(page, rotulo);
  return coleta;
};

test('o salto que fecha o giro não aparece na tela', async ({ page }) => {
  await abrirOsDepoimentos(page);
  const { passo, volta } = await trilho(page).evaluate((faixa) => {
    const cards = [...faixa.children] as HTMLElement[];
    const passo = cards[1]!.offsetLeft - cards[0]!.offsetLeft;
    // A lista aparece três vezes na faixa: as cópias da frente, os Depoimentos e as de trás.
    return { passo, volta: (cards.length / 3) * passo };
  });

  // Onde a posição pula uma volta inteira, o que está na tela tem de ser o mesmo antes e
  // depois: é isso que faz o giro parecer contínuo em vez de teleporte.
  const conferir = (amostras: Amostra[], ponta: string) => {
    const saltos = amostras
      .map((para, i) => ({ de: amostras[i - 1], para }))
      .filter(({ de, para }) => de !== undefined && Math.abs(para.posicao - de.posicao) > volta / 2)
      .map(({ de, para }) => ({ de: de!, para }));
    expect(saltos.length, `o giro não fechou na ponta ${ponta}`).toBeGreaterThan(0);
    for (const { de, para } of saltos) {
      expect(para.emCena, `o salto mudou o que estava na tela (${ponta})`).toEqual(de.emCena);
      // Uma volta exata, com a folga de meio card: o quadro do salto pode ter avançado
      // alguns pixels da animação que vinha antes dele.
      expect(Math.abs(Math.abs(para.posicao - de.posicao) - volta)).toBeLessThan(passo / 2);
    }
  };

  conferir(await cruzarAPonta(page, 'Depoimento anterior'), 'do começo');
  // A volta para trás deixou o carrossel no último Depoimento; daqui a seguinte cruza o fim.
  conferir(await cruzarAPonta(page, 'Próximo depoimento'), 'do fim');
});

test('as setas do teclado andam de Depoimento em Depoimento', async ({ page }) => {
  await abrirOsDepoimentos(page);
  await trilho(page).focus();
  await expect(trilho(page)).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await esperarParado(page);
  expect((await emCena(page))[0]).toBe(depoimentos[1]?.nome);

  await page.keyboard.press('ArrowLeft');
  await esperarParado(page);
  expect((await emCena(page))[0]).toBe(depoimentos[0]?.nome);
});

/**
 * Quantas posições distintas a faixa mostrou ao trocar de Depoimento: uma animação passa por
 * várias, um salto vai direto ao destino. O clique parte de dentro da página, junto com o
 * relógio da amostragem, para a medida não depender da ida e volta do comando.
 */
const posicoesAoAndar = (page: Page, rotulo: string) =>
  page.evaluate(async (nome) => {
    const faixa = document.querySelector('.qtrack')!;
    const posicoes: number[] = [];
    const relogio = setInterval(() => posicoes.push(Math.round(faixa.scrollLeft)), 16);
    document.querySelector<HTMLElement>(`.qbtn[aria-label="${nome}"]`)!.click();
    await new Promise((pronto) => setTimeout(pronto, 900));
    clearInterval(relogio);
    return new Set(posicoes).size;
  }, rotulo);

test('com prefers-reduced-motion o carrossel troca de Depoimento sem deslizar', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await abrirOsDepoimentos(page);
  await expect(page.locator('.qcard').first()).toHaveCSS('transition-property', 'none');

  // Antes e depois, nada no meio.
  expect(await posicoesAoAndar(page, 'Próximo depoimento')).toBeLessThanOrEqual(2);
  await esperarParado(page);
  expect((await emCena(page))[0]).toBe(depoimentos[1]?.nome);
});

test('sem prefers-reduced-motion o carrossel desliza até o próximo Depoimento', async ({
  page,
}) => {
  await abrirOsDepoimentos(page);
  expect(await posicoesAoAndar(page, 'Próximo depoimento')).toBeGreaterThan(3);
  await esperarParado(page);
  expect((await emCena(page))[0]).toBe(depoimentos[1]?.nome);
});

test.describe('com o mouse', () => {
  test.skip(({ isMobile }) => isMobile === true, 'gestos de mouse não existem no celular');

  test('o reposicionamento espera o ponteiro soltar', async ({ page }) => {
    await abrirOsDepoimentos(page);
    // Arrastar para a direita a partir do primeiro card leva a faixa para as cópias da
    // frente, onde o giro precisa saltar. Com o botão pressionado, o salto tem de esperar.
    await arrastar(page, await superficieDoCard(page), 250, { soltar: false });
    const durante = await rolagem(page);
    await page.waitForTimeout(400);
    expect(Math.abs((await rolagem(page)) - durante)).toBeLessThanOrEqual(2);

    await page.mouse.up();
    await esperarParado(page);
    expect((await emCena(page))[0]).toBe(depoimentos[ULTIMO]?.nome);
  });

  test('arrastar pela superfície do card move o carrossel e não seleciona texto', async ({
    page,
  }) => {
    await abrirOsDepoimentos(page);
    const origem = await superficieDoCard(page);
    expect(
      await page.evaluate(
        ({ x, y }) => getComputedStyle(document.elementFromPoint(x, y)!).cursor,
        origem,
      ),
    ).toBe('grab');

    const antes = await rolagem(page);
    await arrastar(page, origem, -300, { soltar: false });
    const durante = await page.evaluate(() => ({
      cursor: getComputedStyle(document.querySelector('.qtrack')!).cursor,
      arrastando: document.querySelector('.qtrack')!.classList.contains('drag'),
      selecionado: getSelection()?.toString().length ?? 0,
    }));
    await page.mouse.up();
    await esperarParado(page);

    expect(durante).toEqual({ cursor: 'grabbing', arrastando: true, selecionado: 0 });
    expect(await rolagem(page)).toBeGreaterThan(antes);
    expect(await page.evaluate(() => getSelection()?.toString().length ?? 0)).toBe(0);
    // O cursor volta ao repouso: nada de mão fechada presa depois do gesto.
    await expect(trilho(page)).not.toHaveClass(/\bdrag\b/);
  });

  test('o texto do card é selecionável e não arrasta o carrossel', async ({ page }) => {
    await abrirOsDepoimentos(page);
    const comTexto = depoimentos.findIndex(({ texto }) => texto !== undefined);
    const paragrafo = page.locator('.qcard:not(.clone)').nth(comTexto).locator('p');
    const caixa = await paragrafo.boundingBox();
    if (caixa === null) throw new Error('o card com texto não está na página');
    // O gesto começa e termina dentro do parágrafo: o card com texto pode ser o primeiro da faixa,
    // colado na borda esquerda da tela, e um arraste que sai da janela não seleciona nada.
    const origem = { x: caixa.x + caixa.width - 40, y: caixa.y + 20 };

    const cursor = await page.evaluate(
      ({ x, y }) => getComputedStyle(document.elementFromPoint(x, y)!).cursor,
      origem,
    );
    expect(['auto', 'text', 'default']).toContain(cursor);

    const antes = await rolagem(page);
    await arrastar(page, origem, -(caixa.width - 80));
    expect(await rolagem(page)).toBe(antes);
    expect(await page.evaluate(() => getSelection()?.toString().length ?? 0)).toBeGreaterThan(0);
    await expect(trilho(page)).not.toHaveClass(/\bdrag\b/);
  });

  test('movimento abaixo do limiar não move o carrossel', async ({ page }) => {
    await abrirOsDepoimentos(page);
    const antes = await rolagem(page);
    const { x, y } = await superficieDoCard(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 3, y + 1);
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(await rolagem(page)).toBe(antes);
  });
});

test.describe('no toque', () => {
  test.skip(({ isMobile }) => isMobile !== true, 'o gesto de toque só existe no celular');

  test('o dedo cruza a ponta do carrossel sem quebrar o giro', async ({ page }) => {
    await abrirOsDepoimentos(page);
    const caixa = await trilho(page).boundingBox();
    if (caixa === null) throw new Error('a faixa do carrossel não está na página');
    const cdp = await page.context().newCDPSession(page);
    const x = caixa.x + caixa.width / 2;
    const y = caixa.y + caixa.height / 2;

    // Deslizar para a direita a partir do primeiro card: o dedo passa para as cópias da
    // frente e fica parado antes de sair da tela, quando o giro finalmente pode saltar.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + i * 18, y }],
      });
      await page.waitForTimeout(16);
    }
    const durante = await rolagem(page);
    await page.waitForTimeout(400);
    expect(Math.abs((await rolagem(page)) - durante)).toBeLessThanOrEqual(2);

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await esperarParado(page);
    expect((await emCena(page))[0]).toBe(depoimentos[ULTIMO]?.nome);
    await cdp.detach();
  });
});
