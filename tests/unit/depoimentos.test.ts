import assert from 'node:assert/strict';
import { test } from 'node:test';
import { esquemaDeDepoimento, ordenarDepoimentos } from '../../src/content.schema.ts';

// O contrato do Depoimento em números e casos-limite, sem navegador. O que a página faz com
// ele — o card Em breve, a ordem no carrossel — é conferido no Playwright.

const esquema = esquemaDeDepoimento();

const depoimento = {
  nome: 'Whallst Guibson',
  papel: 'Supervisor, WG Arquitetura',
  texto: 'Excelente profissional, atenta aos detalhes e com ideias inovadoras.',
};

const validar = (mudancas: Record<string, unknown>) =>
  esquema.safeParse({ ...depoimento, ...mudancas });

test('um Depoimento completo passa', () => {
  assert.equal(esquema.safeParse(depoimento).success, true);
});

test('um Depoimento sem texto passa: é o estado Em breve', () => {
  const { nome, papel } = depoimento;
  const lido = esquema.safeParse({ nome, papel });
  assert.equal(lido.success, true);
  assert.equal(lido.data?.texto, undefined);
});

test('nome e papel são obrigatórios', () => {
  for (const campo of ['nome', 'papel']) {
    const incompleto: Record<string, unknown> = { ...depoimento };
    delete incompleto[campo];
    assert.equal(esquema.safeParse(incompleto).success, false, `${campo} deveria ser obrigatório`);
  }
});

test('campo em branco falha, inclusive o texto — ausente e vazio não são a mesma coisa', () => {
  for (const campo of ['nome', 'papel', 'texto'])
    assert.equal(validar({ [campo]: '   ' }).success, false, `${campo} em branco deveria falhar`);
});

test('nenhum campo aceita HTML', () => {
  for (const campo of ['nome', 'papel', 'texto'])
    assert.equal(
      validar({ [campo]: 'Giordanna <b>Pereira</b>' }).success,
      false,
      `${campo} deveria recusar HTML`,
    );
});

test('espaço nas pontas é aparado', () => {
  const lido = validar({ texto: '  Excelente profissional.  ' });
  assert.equal(lido.data?.texto, 'Excelente profissional.');
});

test('a sequência dos Depoimentos é a do nome do arquivo', () => {
  const embaralhados = [{ id: '06-leon' }, { id: '01-valquiria' }, { id: '03-whallst' }];
  assert.deepEqual(
    ordenarDepoimentos(embaralhados).map(({ id }) => id),
    ['01-valquiria', '03-whallst', '06-leon'],
  );
});

test('ordenar não mexe na lista recebida', () => {
  const original = [{ id: '02-mariana' }, { id: '01-valquiria' }];
  ordenarDepoimentos(original);
  assert.deepEqual(
    original.map(({ id }) => id),
    ['02-mariana', '01-valquiria'],
  );
});
