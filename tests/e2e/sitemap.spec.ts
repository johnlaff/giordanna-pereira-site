import { expect, test } from '@playwright/test';
import { projetos } from './projetos.ts';

const ESPERADAS = ['/', '/projetos', ...projetos.map(({ rota }) => rota)];

const caminhosDoSitemap = (xml: string) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => new URL(url ?? '').pathname);

test('o sitemap lista todas as rotas públicas, na ordem do site', async ({ request }) => {
  const resposta = await request.get('/sitemap.xml');
  expect(resposta.status()).toBe(200);
  expect(resposta.headers()['content-type']).toContain('xml');
  expect(caminhosDoSitemap(await resposta.text())).toEqual(ESPERADAS);
});

test('toda URL do sitemap responde 200, sem desvio', async ({ request }) => {
  // Um sitemap que aponta para uma página que saiu do ar gasta o rastreamento do buscador
  // com um 404 e enfraquece o sinal do resto.
  const xml = await (await request.get('/sitemap.xml')).text();
  for (const caminho of caminhosDoSitemap(xml)) {
    const resposta = await request.get(caminho, { maxRedirects: 0 });
    expect(resposta.status(), `${caminho} não respondeu 200`).toBe(200);
  }
});

test('o robots.txt libera o site e aponta para o sitemap', async ({ request }) => {
  const resposta = await request.get('/robots.txt');
  expect(resposta.status()).toBe(200);
  expect(resposta.headers()['content-type']).toContain('text/plain');

  const texto = await resposta.text();
  expect(texto).toMatch(/^User-agent: \*$/m);
  expect(texto).toMatch(/^Allow: \/$/m);
  const [, url] = /^Sitemap: (.+)$/m.exec(texto) ?? [];
  expect(new URL(url ?? '').pathname).toBe('/sitemap.xml');
});
