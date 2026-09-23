import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp, { type Region } from 'sharp';
import { desenharCartao } from '../../src/compartilhamento/desenho.ts';

const raiz = new URL('../../', import.meta.url);

/** O pixel mais claro de uma região do Cartão, de 0 a 255. */
const maisClaro = async (jpeg: Buffer, regiao: Region) => {
  // O `stats()` mede a entrada do sharp, e não o resultado do pipeline: o recorte vem antes.
  const recorte = await sharp(jpeg).extract(regiao).greyscale().png().toBuffer();
  const { channels } = await sharp(recorte).stats();
  return channels[0]?.max ?? 0;
};

test('o Cartão é um JPEG de 1200×630, o tamanho que o WhatsApp e o LinkedIn pedem', async () => {
  const jpeg = await desenharCartao(
    {
      arquivo: 'og/x.jpg',
      fundo: 'src/assets/gineco-r04.webp',
      olho: 'Consultório',
      titulo: 'GinecoCare',
    },
    raiz,
  );
  const { format, width, height } = await sharp(jpeg).metadata();
  assert.deepEqual({ format, width, height }, { format: 'jpeg', width: 1200, height: 630 });
});

test('o título é escrito em claro sobre o véu, no canto de baixo à esquerda', async () => {
  // O Em breve tem fundo liso: onde houver branco no canto do texto, é o título.
  const semTitulo = await desenharCartao({ arquivo: 'og/x.jpg', titulo: ' ' }, raiz);
  const comTitulo = await desenharCartao({ arquivo: 'og/x.jpg', titulo: 'Mirante CESTES' }, raiz);
  const canto = { left: 72, top: 480, width: 560, height: 86 };
  assert.ok((await maisClaro(semTitulo, canto)) < 200, 'o canto sem título já é claro');
  assert.ok((await maisClaro(comTitulo, canto)) > 230, 'o título não apareceu no canto');
});

test('um título longo encolhe até caber em duas linhas, e a marca fica embaixo, sobre o véu', async () => {
  // Um nome de Projeto cadastrado no CMS pode ter qualquer tamanho. No corpo cheio, quatro
  // linhas empurrariam a marca e o olho para o alto do Cartão, onde o véu quase some.
  // O fundo liso do Em breve deixa ver onde há texto: tudo o que passa de 235 é letra.
  const jpeg = await desenharCartao(
    {
      arquivo: 'og/x.jpg',
      olho: 'Habitação de interesse social',
      titulo: 'Conjunto habitacional com equipamentos comunitários e praça central',
    },
    raiz,
  );
  assert.ok((await maisClaro(jpeg, { left: 72, top: 150, width: 800, height: 150 })) < 235);
  assert.ok((await maisClaro(jpeg, { left: 72, top: 440, width: 800, height: 120 })) > 235);
});
