import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

// O ícone da tela de início do iPhone é o favicon em 180 px, a quadrado cheio: o iOS arredonda
// os cantos sozinho e pinta de preto o que vier transparente.
test('apple-touch-icon.png é o favicon.svg em 180 px, sem canto transparente', async () => {
  const { default: sharp } = await import('sharp');
  const svg = readFileSync('public/favicon.svg', 'utf8').replace(/ rx="\d+"/, '');
  const esperado = await sharp(Buffer.from(svg), { density: 72 * (180 / 64) })
    .resize(180, 180)
    .raw()
    .toBuffer();
  const { data, info } = await sharp('public/apple-touch-icon.png')
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [180, 180, 4]);
  for (const [x, y] of [
    [0, 0],
    [179, 0],
    [0, 179],
    [179, 179],
  ] as const)
    assert.equal(data[(y * 180 + x) * 4 + 3], 255, `canto ${x},${y} transparente`);
  let soma = 0;
  for (let i = 0; i < data.length; i++) soma += Math.abs(data[i]! - esperado[i]!);
  assert.ok(
    soma / data.length < 1,
    `difere do favicon em ${(soma / data.length).toFixed(2)} por canal`,
  );
});
