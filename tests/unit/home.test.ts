import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import {
  esquemaDeFamiliaridade,
  esquemaDeSobre,
  ordenarFamiliaridade,
} from '../../src/content.schema.ts';
import { prenderUltimaPalavra } from '../../src/tipografia.ts';

// O contrato dos dois blocos da home que Giordanna edita no CMS: o Sobre e a Familiaridade.
// Cada um é um arquivo só, e o build quebra se ele vier incompleto.

const sobre = {
  paragrafos: ['Arquiteta e Urbanista formada pela UFU.', 'Meu trabalho é pautado pela busca.'],
  credenciais: [
    { rotulo: 'Formação', linhas: ['Técnico em Edificações · CEFET - MG', 'Arquitetura · UFU'] },
    { rotulo: 'Projetos', linhas: ['Residenciais e comerciais'] },
  ],
};

const familiaridade = {
  itens: [
    { nome: 'Archicad', nivel: 1 },
    { nome: 'Enscape', nivel: 2 },
    { nome: 'Revit', nivel: 3 },
  ],
};

test('o Sobre e a Familiaridade do repositório passam no schema', () => {
  const ler = (nome: string): unknown =>
    parse(readFileSync(`src/content/home/${nome}.yml`, 'utf8'));
  assert.equal(esquemaDeSobre().safeParse(ler('sobre')).success, true);
  assert.equal(esquemaDeFamiliaridade().safeParse(ler('familiaridade')).success, true);
});

test('um Sobre completo passa', () => {
  assert.equal(esquemaDeSobre().safeParse(sobre).success, true);
});

test('o Sobre sem parágrafos ou sem credenciais falha', () => {
  for (const campo of ['paragrafos', 'credenciais'] as const) {
    const incompleto: Record<string, unknown> = { ...sobre };
    delete incompleto[campo];
    assert.equal(esquemaDeSobre().safeParse(incompleto).success, false, `${campo} ausente`);
    assert.equal(
      esquemaDeSobre().safeParse({ ...sobre, [campo]: [] }).success,
      false,
      `${campo} vazio`,
    );
  }
});

test('a Credencial sem rótulo ou sem linhas falha', () => {
  const credencial = sobre.credenciais[0]!;
  for (const quebrada of [
    { linhas: credencial.linhas },
    { rotulo: credencial.rotulo },
    { rotulo: credencial.rotulo, linhas: [] },
    { rotulo: '  ', linhas: credencial.linhas },
    { rotulo: credencial.rotulo, linhas: ['  '] },
  ])
    assert.equal(
      esquemaDeSobre().safeParse({ ...sobre, credenciais: [quebrada] }).success,
      false,
      JSON.stringify(quebrada),
    );
});

test('parágrafo em branco falha', () => {
  assert.equal(
    esquemaDeSobre().safeParse({ ...sobre, paragrafos: ['Um parágrafo.', '   '] }).success,
    false,
  );
});

test('nenhum texto do Sobre aceita HTML', () => {
  const html = 'Formada pela <b>UFU</b>';
  for (const quebrado of [
    { ...sobre, paragrafos: [html] },
    { ...sobre, credenciais: [{ rotulo: html, linhas: ['UFU'] }] },
    { ...sobre, credenciais: [{ rotulo: 'Formação', linhas: [html] }] },
  ])
    assert.equal(esquemaDeSobre().safeParse(quebrado).success, false);
});

test('uma Familiaridade completa passa', () => {
  assert.equal(esquemaDeFamiliaridade().safeParse(familiaridade).success, true);
});

test('a Familiaridade sem itens falha', () => {
  assert.equal(esquemaDeFamiliaridade().safeParse({}).success, false);
  assert.equal(esquemaDeFamiliaridade().safeParse({ itens: [] }).success, false);
});

test('o nível é 1, 2 ou 3, e nada mais', () => {
  const comNivel = (nivel: unknown) =>
    esquemaDeFamiliaridade().safeParse({ itens: [{ nome: 'Revit', nivel }] }).success;
  for (const nivel of [1, 2, 3]) assert.equal(comNivel(nivel), true, `nível ${nivel}`);
  for (const nivel of [0, 4, 1.5, '1', undefined, null])
    assert.equal(comNivel(nivel), false, `nível ${String(nivel)}`);
});

test('a ferramenta sem nome, ou com HTML no nome, falha', () => {
  for (const nome of [undefined, '  ', 'Adobe <i>Ps</i>'])
    assert.equal(
      esquemaDeFamiliaridade().safeParse({ itens: [{ nome, nivel: 2 }] }).success,
      false,
      String(nome),
    );
});

test('a Familiaridade vai da maior para a menor, na ordem em que ela escreveu cada nível', () => {
  // Giordanna acrescenta uma ferramenta no fim da lista, com o nível que ela tiver: o site a põe
  // junto das do mesmo nível, sem mexer na ordem que ela deu às outras.
  const itens = [
    { nome: 'SketchUp', nivel: 2 },
    { nome: 'Revit', nivel: 3 },
    { nome: 'Archicad', nivel: 1 },
    { nome: 'Enscape', nivel: 2 },
    { nome: 'AutoCAD', nivel: 3 },
    { nome: 'Lumion', nivel: 1 },
  ] as const;
  assert.deepEqual(
    ordenarFamiliaridade(itens).map(({ nome }) => nome),
    ['Archicad', 'Lumion', 'SketchUp', 'Enscape', 'Revit', 'AutoCAD'],
  );
  // A lista recebida fica como estava.
  assert.equal(itens[0].nome, 'SketchUp');
});

test('a última palavra do parágrafo não cai sozinha na última linha', () => {
  assert.equal(
    prenderUltimaPalavra('projetos residenciais e comerciais.'),
    'projetos residenciais e comerciais.',
  );
  // O que Giordanna já tiver prendido, ou uma palavra só, fica como está.
  assert.equal(prenderUltimaPalavra('e comerciais.'), 'e comerciais.');
  assert.equal(prenderUltimaPalavra('Arquiteta'), 'Arquiteta');
});
