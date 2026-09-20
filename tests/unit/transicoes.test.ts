import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const fontes = globSync('src/**/*.{astro,ts,css}').map((arquivo) => ({
  arquivo,
  texto: readFileSync(arquivo, 'utf8'),
}));

test('a transição entre páginas é a nativa do navegador, declarada em CSS', () => {
  const declara = fontes.filter(({ texto }) => /@view-transition\b/.test(texto));
  assert.deepEqual(
    declara.map(({ arquivo }) => arquivo),
    ['src/styles/global.css'],
  );
  assert.match(declara[0]?.texto ?? '', /@view-transition\s*{\s*navigation: auto;/);
});

test('nenhuma página usa o roteador de cliente do Astro', () => {
  // O `<ClientRouter />` troca a navegação do navegador por JavaScript: uma página que
  // dependesse dele deixaria de funcionar sem script, e a transição nativa não precisa dele.
  for (const { arquivo, texto } of fontes)
    assert.ok(!texto.includes('astro:transitions'), `roteador de cliente em ${arquivo}`);
});
