import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lugarNaGrade, type LarguraNaGrade } from '../../src/components/grade.ts';

/** Quantas das seis colunas da grade cada largura ocupa. */
const COLUNAS: Record<LarguraNaGrade, number> = { terco: 2, metade: 3, inteira: 6 };

const larguras = (total: number) =>
  Array.from({ length: total }, (_, i) => lugarNaGrade(i, total).largura);

test('sem sobra, todo Projeto ocupa um terço da linha', () => {
  assert.deepEqual(larguras(9), Array(9).fill('terco'));
});

test('sobrando um, o primeiro Projeto ocupa a linha inteira', () => {
  assert.deepEqual(larguras(10), ['inteira', ...Array(9).fill('terco')]);
});

test('sobrando dois, os dois primeiros ocupam meia linha cada', () => {
  assert.deepEqual(larguras(11), ['metade', 'metade', ...Array(9).fill('terco')]);
});

test('toda linha da grade fecha, qualquer que seja o número de Projetos', () => {
  // É esta a razão de o destaque existir: a sobra da última linha sobe para o começo. Se a
  // soma das larguras não for múltipla de seis, sobrou buraco no fim da grade.
  for (let total = 1; total <= 24; total++) {
    const colunas = larguras(total).reduce((soma, largura) => soma + COLUNAS[largura], 0);
    assert.equal(colunas % 6, 0, `${total} Projetos deixam a última linha incompleta`);
  }
});

test('em duas colunas, só o primeiro de um total ímpar ocupa a linha', () => {
  assert.equal(lugarNaGrade(0, 9).dobraEmDuasColunas, true);
  assert.equal(lugarNaGrade(1, 9).dobraEmDuasColunas, false);
  assert.equal(lugarNaGrade(0, 10).dobraEmDuasColunas, false);
});

test('cada card pede a variante da sua caixa nas telas largas', () => {
  assert.match(lugarNaGrade(0, 10).sizes, /\(min-width: 1240px\) 1136px/);
  assert.match(lugarNaGrade(1, 10).sizes, /\(min-width: 1240px\) 361px/);
  assert.match(lugarNaGrade(0, 11).sizes, /\(min-width: 1240px\) 555px/);
});

test('em duas colunas, o card dobrado pede a tela e o normal pede metade dela', () => {
  assert.match(lugarNaGrade(0, 9).sizes, /\(min-width: 700px\) calc\(100vw - 80px\)/);
  assert.match(lugarNaGrade(1, 9).sizes, /\(min-width: 700px\) calc\(\(100vw - 98px\) \/ 2\)/);
});

test('numa coluna só, todo card pede a largura da tela', () => {
  // A última medida do `sizes` é a que vale para a tela mais estreita e sem retina: a largura
  // da tela menos a margem lateral, com a densidade que `porFaixa` acrescenta.
  for (const total of [9, 10, 11])
    for (let i = 0; i < total; i++)
      assert.ok(
        lugarNaGrade(i, total).sizes.endsWith('calc(calc(100vw - 48px) * 1.5)'),
        `o card ${i} de ${total} não termina pedindo a largura da tela`,
      );
});
