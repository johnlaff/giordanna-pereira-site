import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { rotas } from './rotas.ts';

// WCAG 2.2 AA é o alvo do site; best-practice entra porque o Preview já passava nele.
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

for (const rota of rotas) {
  test(`axe sem violações em ${rota}`, async ({ page }) => {
    await page.goto(rota);
    // O axe julga a página assentada. Um bloco `.rv` acima da dobra — os dois do contato — sobe
    // e aparece logo ao carregar, e no meio da transição a cor dele ainda está misturada com o
    // fundo: medido ali, o contraste sai falso. Só as transições contam; as animações sem fim
    // da home (o hero, o carrossel) não terminam nunca.
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (animacao) => !(animacao instanceof CSSTransition) || animacao.playState !== 'running',
        ),
    );
    const resultado = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(resultado.violations).toEqual([]);
  });
}
