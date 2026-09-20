import { expect, test } from '@playwright/test';
import { rotas } from './rotas.ts';

/**
 * A forma canônica da URL é sem barra final (ADR 0007). O teste é em nível de requisição, não
 * de página: um redirecionamento aqui não quebra nada visível, e é justamente por isso que
 * precisa de rede de proteção. Ele cobra uma viagem extra em toda navegação interna, faz o
 * prefetch buscar o desvio em vez da página, e divide o sinal que o sitemap dá ao buscador.
 */
const REDIRECIONAMENTOS = [301, 302, 303, 307, 308];

for (const rota of rotas) {
  test(`${rota} responde na primeira requisição, sem redirecionar`, async ({ request }) => {
    const resposta = await request.get(rota, { maxRedirects: 0 });
    expect(
      REDIRECIONAMENTOS,
      `${rota} redirecionou para ${resposta.headers()['location']}`,
    ).not.toContain(resposta.status());
  });
}

for (const canonica of rotas.filter((rota) => rota.startsWith('/projetos'))) {
  test(`${canonica}/ redireciona para a forma sem barra`, async ({ request }) => {
    const resposta = await request.get(`${canonica}/`, { maxRedirects: 0 });
    expect(REDIRECIONAMENTOS).toContain(resposta.status());
    const destino = resposta.headers()['location'] ?? '';
    expect(new URL(destino, 'http://localhost').pathname).toBe(canonica);
  });
}
