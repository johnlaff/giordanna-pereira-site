import { expect, test } from '@playwright/test';
import { rotas } from './rotas.ts';

/**
 * A varredura herdada do Preview (`sweep.js`): nenhuma rota, em nenhuma largura, pode ter um
 * elemento mais largo que a tela nem empurrar a página para o lado. É o teste que pega o
 * estouro que passa despercebido numa conferência a olho, porque só aparece numa largura
 * intermediária — e o que garante que a Grade nova não introduza um.
 *
 * Cinco larguras: as quatro da conferência visual (§5 do HANDOFF) e mais a tela estreita de
 * 320 px, onde uma medida fixa esquecida estoura primeiro. As rotas são as de `rotas.ts`:
 * treze hoje, e as catorze do Preview quando a página de contato entrar (#11).
 */
const LARGURAS = [1440, 1024, 768, 375, 320];

/**
 * A única exceção esperada, como no Preview: a imagem do hero é maior que a tela de propósito
 * — é o que dá folga ao movimento lento de aproximação — e o bloco que a contém a recorta.
 */
const EXCECOES = ['.hero-img'];

test.describe('varredura de larguras', () => {
  // A varredura escolhe as suas próprias larguras, então rodá-la duas vezes só dobraria o
  // tempo da suíte para repetir o mesmo veredito.
  test.skip(({ isMobile }) => isMobile === true, 'as larguras são as da varredura');

  for (const rota of rotas) {
    test(`nada é mais largo que a tela em ${rota}`, async ({ page }) => {
      for (const largura of LARGURAS) {
        await page.setViewportSize({ width: largura, height: 900 });
        await page.goto(rota);
        await page.evaluate(() => document.fonts.ready);

        const estouro = await page.evaluate((excecoes) => {
          const tela = document.documentElement.clientWidth;
          const nome = (el: Element) =>
            el.tagName.toLowerCase() + (el.className ? `.${String(el.className).trim()}` : '');
          return {
            tela,
            pagina: document.documentElement.scrollWidth,
            largos: [...document.querySelectorAll('body *')]
              .filter((el) => !excecoes.some((seletor) => el.closest(seletor) !== null))
              .filter((el) => el.getBoundingClientRect().width > tela + 1)
              .map(nome),
          };
        }, EXCECOES);

        expect(estouro.largos, `elementos mais largos que ${largura} px em ${rota}`).toEqual([]);
        expect(
          estouro.pagina,
          `a página rola para o lado em ${largura} px em ${rota}`,
        ).toBeLessThanOrEqual(estouro.tela + 1);
      }
    });
  }
});
