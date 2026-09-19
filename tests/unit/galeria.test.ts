import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CORTE_MAXIMO, alturaAlvo, linhasDaGaleria } from '../../src/components/galeria.linhas.ts';

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

test('sem imagem para rebalançar, a última linha é cortada no teto de altura', () => {
  const [unica] = linhasDaGaleria([PRANCHA], medidas());
  assert.equal(unica?.[0]?.altura, Math.round(alturaAlvo(LARGURA) * CORTE_MAXIMO));
  assert.equal(unica?.[0]?.largura, LARGURA);
  assert.equal(unica?.[0]?.cortada, true);
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
