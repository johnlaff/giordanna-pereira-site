import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prefetchDe, robotsDe, rotasPendentes, rotasPublicas, sitemapDe } from '../../src/rotas.ts';

const site = new URL('https://giordannapereira.arq.br');
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url ?? '');

test('as rotas abrem pela home e pela Grade, e seguem na Ordem dos Projetos', () => {
  assert.deepEqual(rotasPublicas(['edificio-vitalis', 'mirante-cestes']), [
    '/',
    '/projetos',
    '/projetos/edificio-vitalis',
    '/projetos/mirante-cestes',
  ]);
});

test('o sitemap publica uma URL absoluta por rota, sem barra final fora da home', () => {
  const xml = sitemapDe(rotasPublicas(['edificio-vitalis']), site);
  assert.deepEqual(locs(xml), [
    'https://giordannapereira.arq.br/',
    'https://giordannapereira.arq.br/projetos',
    'https://giordannapereira.arq.br/projetos/edificio-vitalis',
  ]);
});

test('o sitemap é XML bem formado mesmo com caractere reservado no slug', () => {
  // O slug vem do nome do arquivo no CMS: um "&" ali quebraria o sitemap inteiro em silêncio.
  const xml = sitemapDe(['/projetos/casa-a&b'], site);
  assert.ok(xml.includes('<loc>https://giordannapereira.arq.br/projetos/casa-a&amp;b</loc>'));
});

test('o robots libera o site e aponta para o sitemap do próprio domínio', () => {
  const robots = robotsDe(site);
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  const [, url] = /^Sitemap: (.+)$/m.exec(robots) ?? [];
  assert.equal(url, 'https://giordannapereira.arq.br/sitemap.xml');
});

test('nenhuma rota pendente já está publicada', () => {
  // A lista de pendentes só faz sentido enquanto a página não existe: esquecê-la depois de o
  // ticket entrar deixaria o link sem prefetch para sempre, sem ninguém notar.
  const publicadas = new Set(rotasPublicas(['edificio-vitalis', 'mirante-cestes']));
  for (const rota of rotasPendentes)
    assert.ok(!publicadas.has(rota), `${rota} já existe e não é mais pendente`);
});

test('só o link de uma página pendente fica fora do prefetch', () => {
  assert.equal(prefetchDe('/contato'), 'false');
  assert.equal(prefetchDe('/projetos'), undefined);
  assert.equal(prefetchDe('/'), undefined);
});
