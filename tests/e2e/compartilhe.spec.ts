import { expect, test } from '@playwright/test';
import { tituloCompartilhado } from '../../src/components/compartilhe.ts';
import { site } from '../../src/config.ts';
import { projetos } from './projetos.ts';

// O bloco Compartilhe da Ficha. O que cada destino espera está fixado nos testes de unidade;
// aqui se verifica o que a página publicada entrega: o endereço certo em cada âncora, os dois
// botões que dependem do navegador e o caminho do teclado.

const canonica = (rota: string) => new URL(rota, site.url).href;

/** O primeiro Projeto na Ordem serve aos testes de comportamento, iguais em todas as páginas. */
const primeiro = projetos[0]!;

/** Rótulos acessíveis na ordem em que o teclado os alcança, sem o botão nativo. */
const rotulos = [
  'Compartilhar no WhatsApp',
  'Compartilhar no LinkedIn',
  'Compartilhar no Facebook',
  'Compartilhar por e-mail',
  'Copiar link',
];

/** Põe uma `navigator.share` de mentira que registra o que recebeu no próprio documento. */
const comShareNativa = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (dados: ShareData) => {
        document.documentElement.dataset['compartilhado'] = JSON.stringify(dados);
        return Promise.resolve();
      },
    });
  });
};

for (const { slug, rota, dados } of projetos) {
  test(`${slug}: cada destino leva o nome do Projeto e o endereço da página`, async ({ page }) => {
    await page.goto(rota);
    const url = canonica(rota);
    const titulo = tituloCompartilhado(dados.titulo);
    const href = async (rotulo: string) =>
      new URL(
        (await page
          .locator('.share')
          .getByRole('link', { name: rotulo, exact: true })
          .getAttribute('href')) ?? '',
      );

    // Decodificado, e não comparado byte a byte: o que importa é o que chega ao destino.
    expect((await href('Compartilhar no WhatsApp')).searchParams.get('text')).toBe(
      `${titulo} ${url}`,
    );
    expect((await href('Compartilhar no LinkedIn')).searchParams.get('url')).toBe(url);
    expect((await href('Compartilhar no Facebook')).searchParams.get('u')).toBe(url);
    const email = await href('Compartilhar por e-mail');
    expect(email.protocol).toBe('mailto:');
    expect(email.searchParams.get('subject')).toBe(titulo);
    expect(email.searchParams.get('body')).toBe(url);
  });

  test(`${slug}: o bloco fica na Ficha, abaixo da ficha técnica`, async ({ page }) => {
    await page.goto(rota);
    const bloco = page.locator('.ficha .share');
    await expect(bloco).toBeVisible();
    await expect(bloco.locator('.rotulo')).toHaveText('Compartilhe');
    // O filete que separa o bloco da ficha técnica, como no Preview.
    await expect(bloco).toHaveCSS('border-top-width', '1px');
    // A ficha técnica vem antes: o bloco fecha o painel, não o abre.
    expect(
      await bloco.evaluate((el) => {
        const dl = el.closest('.ficha')!.querySelector('dl')!;
        return el.compareDocumentPosition(dl) === Node.DOCUMENT_POSITION_PRECEDING;
      }),
    ).toBe(true);
  });
}

test('o endereço que o bloco compartilha é o mesmo que o sitemap publica', async ({
  page,
  request,
}) => {
  // As âncoras saem de `Astro.site` e o sitemap também: se um dia divergirem, o link
  // compartilhado levaria a um endereço que o buscador não conhece.
  const xml = await (await request.get('/sitemap.xml')).text();
  await page.goto(primeiro.rota);
  const href =
    (await page
      .locator('.share')
      .getByRole('link', { name: 'Compartilhar no Facebook', exact: true })
      .getAttribute('href')) ?? '';
  const url = new URL(href).searchParams.get('u') ?? '';
  expect(xml).toContain(`<loc>${url}</loc>`);
});

test('sem navigator.share o botão de compartilhamento nativo não aparece', async ({ page }) => {
  await page.goto(primeiro.rota);
  // Sem esta afirmação o teste viraria verde sozinho no dia em que o navegador ganhasse a API.
  expect(await page.evaluate(() => typeof navigator.share)).not.toBe('function');
  await expect(
    page.locator('.share').getByRole('button', { name: 'Compartilhar', exact: true }),
  ).toBeHidden();
});

test('com navigator.share o botão nativo aparece e envia o título e a URL canônica', async ({
  page,
}) => {
  await comShareNativa(page);
  await page.goto(primeiro.rota);

  const botao = page.locator('.share').getByRole('button', { name: 'Compartilhar', exact: true });
  await expect(botao).toBeVisible();
  await botao.click();

  const enviado = JSON.parse(
    (await page.locator('html').getAttribute('data-compartilhado')) ?? '{}',
  );
  expect(enviado).toEqual({
    title: tituloCompartilhado(primeiro.dados.titulo),
    url: canonica(primeiro.rota),
  });
});

test('copiar link põe a URL canônica na área de transferência e avisa por region viva', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(primeiro.rota);

  const aviso = page.locator('.share').getByRole('status');
  // Nasce vazio: uma região viva com texto desde o começo anunciaria algo que ninguém pediu.
  await expect(aviso).toHaveText('');

  await page.locator('.share').getByRole('button', { name: 'Copiar link' }).click();
  await expect(aviso).toHaveText('Link copiado');
  await expect(aviso).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(canonica(primeiro.rota));

  // O aviso é passageiro: some sozinho e não fica no caminho da leitura.
  await expect(aviso).toHaveCSS('opacity', '0', { timeout: 6000 });
});

test('sem permissão para a área de transferência o aviso ensina o caminho manual', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new Error('sem permissão')),
    });
  });
  await page.goto(primeiro.rota);

  await page.locator('.share').getByRole('button', { name: 'Copiar link' }).click();
  await expect(page.locator('.share').getByRole('status')).toHaveText('Copie da barra de endereço');
});

test('o teclado alcança a fileira inteira, com foco visível e rótulo próprio em cada controle', async ({
  page,
}) => {
  await page.goto(primeiro.rota);
  // Entra na fileira pelo teclado: o `:focus-visible` do site só pinta o anel vindo daí.
  await page.locator('.share a').first().focus();
  await page.keyboard.press('Shift+Tab');

  const alcancados: string[] = [];
  for (let i = 0; i < rotulos.length; i++) {
    await page.keyboard.press('Tab');
    alcancados.push(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''),
    );
  }
  expect(alcancados).toEqual(rotulos);
  expect(new Set(alcancados).size).toBe(rotulos.length);

  const anel = await page.evaluate(() => {
    const { outlineStyle, outlineWidth, outlineColor } = getComputedStyle(document.activeElement!);
    return { outlineStyle, outlineWidth, outlineColor };
  });
  expect(anel).toEqual({
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineColor: 'rgb(46, 58, 72)',
  });
});

test('o botão nativo escondido fica fora do caminho do teclado', async ({ page }) => {
  await page.goto(primeiro.rota);
  const controles = await page
    .locator('.share-row a, .share-row button')
    .evaluateAll((elementos) =>
      elementos.filter((el) => el.checkVisibility()).map((el) => el.getAttribute('aria-label')),
    );
  expect(controles).toEqual(rotulos);
});

test('os alvos têm o tamanho do Preview, nas duas larguras', async ({ page }) => {
  await page.goto(primeiro.rota);
  // 38 px é o que o Preview desenha em 1440 e em 375: a regra de 36 px que ele traz para a
  // tela estreita vem antes da de 38 na folha e nunca chega a valer. 38 passa com folga do
  // mínimo de 24 px da WCAG 2.2, e encolher o alvo no celular seria andar para trás.
  for (const seletor of ['.share .copiar', '.share-row a']) {
    const caixa = await page.locator(seletor).first().boundingBox();
    expect(caixa?.width).toBeCloseTo(38, 0);
    expect(caixa?.height).toBeCloseTo(38, 0);
  }
});

test('com prefers-reduced-motion o aviso e os botões trocam de estado sem transição', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(primeiro.rota);

  const duracao = (seletor: string) =>
    page
      .locator(seletor)
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(await duracao('.share .toast')).toBe('0s');
  expect(await duracao('.share-row a')).toBe('0s');

  // Sem movimento o retorno continua existindo — ele é informação, não enfeite.
  await page.locator('.share').getByRole('button', { name: 'Copiar link' }).click();
  await expect(page.locator('.share').getByRole('status')).toHaveText('Link copiado');
  await expect(page.locator('.share').getByRole('status')).toHaveCSS('opacity', '1');
});

test('sem prefers-reduced-motion o aviso entra em transição', async ({ page }) => {
  await page.goto(primeiro.rota);
  expect(
    await page.locator('.share .toast').evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0.3s');
});
