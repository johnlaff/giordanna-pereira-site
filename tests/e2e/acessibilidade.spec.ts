import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { rotas } from './rotas.ts';

// WCAG 2.2 AA é o alvo do site; best-practice entra porque o Preview já passava nele.
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

for (const rota of rotas) {
  test(`axe sem violações em ${rota}`, async ({ page }) => {
    await page.goto(rota);
    const resultado = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(resultado.violations).toEqual([]);
  });
}
