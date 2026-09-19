import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { test } from 'node:test';

// ADR 0004: o repositório guarda WebP de no máximo 2560 px; os originais em alta ficam no
// Drive. Um arquivo acima de 2 MB é sinal de que um original entrou no lugar do derivado.
const TETO_EM_BYTES = 2 * 1024 * 1024;

test('nenhuma imagem de src/assets passa de 2 MB', () => {
  const arquivos = readdirSync('src/assets');
  assert.ok(arquivos.length > 0);
  for (const arquivo of arquivos) {
    const { size } = statSync(`src/assets/${arquivo}`);
    assert.ok(size <= TETO_EM_BYTES, `${arquivo} tem ${(size / 1024 / 1024).toFixed(2)} MB`);
  }
});

test('src/assets só guarda WebP', () => {
  for (const arquivo of readdirSync('src/assets'))
    assert.ok(arquivo.endsWith('.webp'), `formato inesperado: ${arquivo}`);
});
