import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CORTE_MAXIMO,
  DENSIDADE_SEM_RETINA,
  RECORTE_MAXIMO,
  alturaAlvo,
  linhasDaGaleria,
  porFaixa,
} from '../../src/components/galeria.linhas.ts';
import {
  cliqueNoZoom,
  degrausDoZoom,
  fatorDaRoda,
  porcentagem,
  proximoDegrau,
  proximoQuadro,
} from '../../src/components/galeria.zoom.ts';

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

test('um retrato sozinho na linha não preenche a largura, em vez de ser recortado', () => {
  // Preencher a largura pediria uma faixa mais alta que a Galeria é larga: a linha recua.
  const retrato = 0.562;
  const [unica] = linhasDaGaleria([retrato], medidas());
  assert.ok(unica![0]!.altura <= LARGURA, 'a linha ficou mais alta que a Galeria');
  assert.ok(unica![0]!.largura < LARGURA, 'a linha foi esticada até a borda');
  assert.ok(perdaDe(unica![0]!, retrato) <= 0.01, 'o retrato foi recortado');
});

test('o `sizes` pede a caixa em tela de retina e uma vez e meia nas demais', () => {
  const faixas = [
    ['(min-width: 700px)', '559px'],
    ['', '100vw'],
  ] as const;
  assert.equal(
    porFaixa(faixas),
    '(min-resolution: 1.5dppx) and (min-width: 700px) 559px, ' +
      `(min-resolution: 1.5dppx) 100vw, ` +
      `(min-width: 700px) calc(559px * ${DENSIDADE_SEM_RETINA}), ` +
      `calc(100vw * ${DENSIDADE_SEM_RETINA})`,
  );
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

// O zoom pela roda: o mesmo passo por dente no Chrome (pixels) e no Firefox (linhas), e uma
// escala que persegue o alvo quadro a quadro até chegar — sem passar dele nem parar antes.
test('um dente da roda amplia uns 15% no Chrome e no Firefox', () => {
  const chrome = fatorDaRoda({ deltaY: -100, deltaMode: 0 });
  const firefox = fatorDaRoda({ deltaY: -3, deltaMode: 1 });
  assert.ok(chrome > 1.1 && chrome < 1.2, `Chrome: ${chrome}`);
  assert.ok(firefox > 1.1 && firefox < 1.2, `Firefox: ${firefox}`);
  assert.ok(fatorDaRoda({ deltaY: 100, deltaMode: 0 }) < 1);
});

test('a escala chega ao alvo em poucos quadros, sempre do mesmo lado dele', () => {
  for (const [inicio, alvo] of [
    [0.2, 1],
    [1, 0.2],
  ] as const) {
    let zoom: number = inicio;
    let quadros = 0;
    for (let chegou = false; !chegou; quadros++) {
      const anterior = zoom;
      ({ zoom, chegou } = proximoQuadro(zoom, alvo));
      assert.ok(
        inicio < alvo ? zoom >= anterior && zoom <= alvo : zoom <= anterior && zoom >= alvo,
      );
    }
    assert.equal(zoom, alvo);
    // Uns 400 ms a 60 quadros por segundo: suave, mas sem arrastar.
    assert.ok(quadros <= 30, `${quadros} quadros`);
  }
});

test('os degraus do zoom vão do ajuste ao teto, em múltiplos legíveis', () => {
  assert.deepEqual(degrausDoZoom(0.25, 1), [0.25, 0.375, 0.5, 0.75, 1]);
  // Um teto fora dos múltiplos entra como último degrau, sem um degrau colado nele.
  assert.deepEqual(degrausDoZoom(0.2, 0.61), [0.2, 0.30000000000000004, 0.4, 0.61]);
  // Uma imagem menor que a tela não amplia: o ajuste é o teto.
  assert.deepEqual(degrausDoZoom(1, 1), [1]);
});

test('+ e − andam um degrau e param nas pontas', () => {
  const degraus = degrausDoZoom(0.25, 1);
  assert.equal(proximoDegrau(0.25, degraus, 1), 0.375);
  assert.equal(proximoDegrau(0.6, degraus, 1), 0.75);
  assert.equal(proximoDegrau(0.6, degraus, -1), 0.5);
  assert.equal(proximoDegrau(1, degraus, 1), undefined);
  assert.equal(proximoDegrau(0.25, degraus, -1), undefined);
});

test('o clique amplia em dois tempos até o teto e depois volta ao ajuste', () => {
  const niveis = { initial: 0.25, secondary: 0.6, max: 1 };
  assert.equal(cliqueNoZoom(0.25, niveis), 0.6);
  assert.equal(cliqueNoZoom(0.6, niveis), 1);
  assert.equal(cliqueNoZoom(0.8, niveis), 1);
  assert.equal(cliqueNoZoom(1, niveis), 0.25);
  assert.equal(porcentagem(0.6, 0.25), '240%');
});
