import { expect, test, type Page } from '@playwright/test';
import { contatos, emailExibido, marca } from '../../src/config.ts';
import { rotas } from './rotas.ts';

test('home responde 200 com a marca no cabeçalho', async ({ page }) => {
  const resposta = await page.goto('/');
  expect(resposta?.status()).toBe(200);
  await expect(page).toHaveTitle(/Giordanna Pereira Arquitetura/);
  const brand = page.locator('header .brand');
  await expect(brand).toContainText(marca.nome);
  await expect(brand).toContainText(marca.cau);
});

test('rota inexistente responde 404 com caminho de volta aos Projetos', async ({ page }) => {
  const resposta = await page.goto('/nao-existe');
  expect(resposta?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Página não encontrada');
  await expect(page.getByRole('link', { name: 'Ver projetos' })).toHaveAttribute(
    'href',
    '/projetos',
  );
});

test('rodapé lista os quatro Contatos e o e-mail da configuração', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('footer .ftr-soc a');
  await expect(links).toHaveCount(contatos.length);
  for (const [i, contato] of contatos.entries()) {
    await expect(links.nth(i)).toHaveAttribute('href', contato.href);
    await expect(links.nth(i)).toHaveAccessibleName(contato.rotulo);
  }
  await expect(page.locator('footer a[href^="mailto:"]')).toHaveAttribute(
    'href',
    `mailto:${emailExibido}`,
  );
});

// Herdado do Preview: o cabeçalho não pode dançar de uma página para a outra. Na home ele é
// transparente sobre o hero e nas demais é sólido desde o servidor, e nem isso pode movê-lo.
const medirCabecalho = (page: Page) =>
  page.evaluate(() => {
    const caixa = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height].map(Math.round);
    };
    return { hdr: caixa('.hdr'), brand: caixa('.hdr .brand'), nav: caixa('.hdr .nav') };
  });

for (const largura of [1440, 1024, 375]) {
  test(`cabeçalho ocupa a mesma posição em todas as rotas em ${largura} px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto('/');
    const referencia = await medirCabecalho(page);
    for (const rota of rotas.filter((r) => r !== '/')) {
      await page.goto(rota);
      expect(await medirCabecalho(page), `cabeçalho fora do lugar em ${rota}`).toEqual(referencia);
    }
  });
}

test('link de pular para o conteúdo aparece no foco e leva ao main', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await expect(skip).toHaveAttribute('href', '#main');
});

// Herdado do Preview: nenhuma página pode terminar antes do fim da tela, deixando uma faixa
// clara embaixo do rodapé. O rodapé é a última coisa que se vê, sempre.
for (const rota of rotas) {
  test(`o rodapé fecha a tela em ${rota}`, async ({ page }) => {
    await page.goto(rota);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const fim = await page.evaluate(() => {
      const alvo = document.elementFromPoint(innerWidth / 2, innerHeight - 2);
      return {
        dentroDoRodape: alvo instanceof Element && alvo.closest('footer') !== null,
        documento: document.documentElement.scrollHeight,
        tela: innerHeight,
      };
    });
    expect(fim.documento).toBeGreaterThanOrEqual(fim.tela);
    expect(fim.dentroDoRodape).toBe(true);
  });
}

test('cabeçalho e hero começam na mesma margem lateral', async ({ page }) => {
  await page.goto('/');
  const margens = await page.evaluate(() => {
    const esquerda = (sel: string) => document.querySelector(sel)!.getBoundingClientRect().left;
    return {
      marca: esquerda('.hdr .brand'),
      hero: esquerda('.hero-content'),
      gutter: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')),
    };
  });
  expect(margens.marca).toBeCloseTo(margens.gutter, 0);
  expect(margens.hero).toBeCloseTo(margens.gutter, 0);
});
