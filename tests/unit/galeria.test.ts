import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CORTE_MAXIMO,
  RECORTE_MAXIMO,
  alturaAlvo,
  linhasDaGaleria,
} from '../../src/components/galeria.linhas.ts';

// A Galeria monta linhas justificadas: cada linha ocupa a largura toda, todas as imagens de
// uma linha têm a mesma altura e a proporção de cada imagem é preservada — salvo o corte
// combinado na faixa de abertura e no teto de altura. O contrato é medido aqui em números,
// sem navegador; a página confere no Playwright que o DOM recebe o que estes testes descrevem.

const GAP = 18;
const LARGURA = 1136;
/** Renders do Consultório GinecoCare (2106 × 1174) e as pranchas (2560 × ~1810). */
const RENDER = 2106 / 1174;
const PRANCHA = 2560 / 1810;
const medidas = (largura = LARGURA, abertura = false) => ({ largura, gap: GAP, abertura });

/** Quanto da imagem a caixa esconde: `object-fit: cover` corta o excedente do lado maior. */
const perdaDe = ({ largura, altura }: { largura: number; altura: number }, proporcao: number) => {
  const caixa = largura / altura;
  return 1 - Math.min(caixa, proporcao) / Math.max(caixa, proporcao);
};

const larguraDaLinha = (linha: { largura: number }[]) =>
  linha.reduce((soma, caixa) => soma + caixa.largura, 0) + (linha.length - 1) * GAP;

test('cada linha ocupa a largura da Galeria, descontados os espaços entre as imagens', () => {
  const linhas = linhasDaGaleria(Array(7).fill(RENDER), medidas());
  assert.ok(linhas.length > 1);
  for (const linha of linhas) assert.equal(larguraDaLinha(linha), LARGURA);
});

test('as imagens de uma linha têm a mesma altura', () => {
  for (const linha of linhasDaGaleria([RENDER, PRANCHA, RENDER, PRANCHA, RENDER], medidas()))
    assert.equal(new Set(linha.map((caixa) => caixa.altura)).size, 1);
});

test('a Galeria devolve cada imagem uma única vez, na ordem do conteúdo', () => {
  const total = 11;
  const indices = linhasDaGaleria(Array(total).fill(RENDER), medidas(LARGURA, true))
    .flat()
    .map((caixa) => caixa.indice);
  assert.deepEqual(
    indices,
    Array.from({ length: total }, (_, i) => i),
  );
});

test('a altura da linha fica perto da altura-alvo da largura da Galeria', () => {
  for (const largura of [1136, 920, 688, 327]) {
    const alvo = alturaAlvo(largura);
    for (const linha of linhasDaGaleria(Array(9).fill(RENDER), medidas(largura))) {
      assert.ok(linha[0]!.altura <= alvo * CORTE_MAXIMO, `${linha[0]!.altura} acima do teto`);
      assert.ok(linha[0]!.altura > alvo * 0.6, `${linha[0]!.altura} bem abaixo do alvo ${alvo}`);
    }
  }
});

test('a altura-alvo diminui com a largura da Galeria', () => {
  assert.equal(alturaAlvo(1136), 380);
  assert.equal(alturaAlvo(920), 300);
  assert.equal(alturaAlvo(327), 230);
});

test('a primeira imagem paisagem abre a Galeria sozinha, em faixa de no máximo meia largura', () => {
  const [abertura] = linhasDaGaleria([RENDER, RENDER, RENDER], medidas(LARGURA, true));
  assert.equal(abertura?.length, 1);
  assert.equal(abertura?.[0]?.largura, LARGURA);
  assert.equal(abertura?.[0]?.altura, Math.round(LARGURA / 2));
  assert.equal(abertura?.[0]?.cortada, true);
});

test('uma abertura quase quadrada cede altura em vez de comer o render', () => {
  const quaseQuadrada = 898 / 722; // primeira imagem da Mini Casa
  const [abertura] = linhasDaGaleria([quaseQuadrada, PRANCHA], medidas(LARGURA, true));
  const natural = LARGURA / quaseQuadrada;
  assert.ok(LARGURA / 2 < natural * (1 - RECORTE_MAXIMO), 'a faixa 2:1 cortaria demais');
  assert.equal(abertura?.[0]?.altura, Math.round(natural * (1 - RECORTE_MAXIMO)));
  assert.equal(abertura?.[0]?.largura, LARGURA);
});

test('uma abertura mais panorâmica que 2:1 mantém a proporção, sem corte', () => {
  const panoramica = 3;
  const [abertura] = linhasDaGaleria([panoramica, RENDER], medidas(LARGURA, true));
  assert.equal(abertura?.[0]?.altura, Math.round(LARGURA / panoramica));
  assert.equal(abertura?.[0]?.cortada, false);
});

test('uma última linha alta demais puxa uma imagem da linha anterior', () => {
  // Quatro pranchas cabem três na primeira linha; a que sobra ocuparia a largura toda,
  // alta demais. Rebalanceadas, as duas linhas ficam com duas imagens cada.
  const linhas = linhasDaGaleria(Array(4).fill(PRANCHA), medidas());
  assert.deepEqual(
    linhas.map((linha) => linha.length),
    [2, 2],
  );
  for (const linha of linhas) assert.ok(linha[0]!.altura <= alturaAlvo(LARGURA) * CORTE_MAXIMO);
});

test('sem imagem para rebalançar, a última linha encolhe até o teto de recorte', () => {
  const [unica] = linhasDaGaleria([PRANCHA], medidas());
  const natural = LARGURA / PRANCHA;
  // O teto de altura da linha pediria um corte maior do que o permitido: quem cede é o teto.
  assert.ok(alturaAlvo(LARGURA) * CORTE_MAXIMO < natural * (1 - RECORTE_MAXIMO));
  assert.equal(unica?.[0]?.altura, Math.round(natural * (1 - RECORTE_MAXIMO)));
  assert.equal(unica?.[0]?.largura, LARGURA);
  // O arredondamento da altura para pixel inteiro move a perda no terceiro decimal.
  assert.ok(Math.abs(perdaDe(unica![0]!, PRANCHA) - RECORTE_MAXIMO) < 0.01);
});

test('nenhuma imagem perde mais de um quarto da altura', () => {
  // Proporções do acervo, da mais alta à mais deitada, mais a primeira quase quadrada.
  const acervo = [1.244, 1.794, 0.562, 1.414, 1.849, 0.77, 2.162, 1.294];
  for (const largura of [1136, 944, 688, 327])
    for (const abertura of [false, true])
      for (const caixa of linhasDaGaleria(acervo, medidas(largura, abertura)).flat())
        assert.ok(
          perdaDe(caixa, acervo[caixa.indice]!) <= RECORTE_MAXIMO + 0.01,
          `imagem ${caixa.indice} perde ${(perdaDe(caixa, acervo[caixa.indice]!) * 100).toFixed(0)}% em ${largura} px`,
        );
});

test('uma linha nunca fica mais alta que a largura da Galeria', () => {
  // Um retrato sozinho na linha só caberia inteiro numa faixa altíssima: aí o recorte volta.
  const [unica] = linhasDaGaleria([0.562], medidas());
  assert.ok(unica![0]!.altura <= LARGURA);
});

test('a imagem que manteve a proporção não é marcada como cortada', () => {
  for (const caixa of linhasDaGaleria(Array(6).fill(RENDER), medidas()).flat())
    assert.equal(caixa.cortada, false, `${caixa.largura}×${caixa.altura} não deveria cortar`);
});

test('uma Galeria sem imagens não tem linha alguma', () => {
  assert.deepEqual(linhasDaGaleria([], medidas()), []);
});

test('uma Galeria medida antes de ter largura não tem linha alguma', () => {
  assert.deepEqual(linhasDaGaleria([RENDER], medidas(0)), []);
});
