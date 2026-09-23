import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import { z } from 'astro/zod';
import { configuracaoDoCms } from '../../src/admin/configuracao.ts';
import {
  esquemaDeDepoimento,
  esquemaDeProjeto,
  ordenarDepoimentos,
} from '../../src/content.schema.ts';

/**
 * O formulário do CMS é a primeira barreira e o schema das collections, a segunda (ADR 0002).
 * Estes testes garantem que as duas digam a mesma coisa: um campo que o build exige e o CMS
 * deixa em branco só apareceria como build quebrado depois do commit de Giordanna.
 */
const configuracao = configuracaoDoCms('https://giordannapereira.arq.br');

type Campo = { name: string; required?: boolean; pattern?: [string | RegExp, string] };

const camposDa = (colecao: string): Campo[] => {
  const encontrada = configuracao.collections?.find((c) => 'name' in c && c.name === colecao);
  assert.ok(encontrada && 'fields' in encontrada, `a coleção ${colecao} não está no CMS`);
  return encontrada.fields as Campo[];
};

/** No CMS, todo campo é obrigatório até dizer o contrário. */
const obrigatorioNoCms = (campo: Campo) => campo.required !== false;

/** No schema, o campo é opcional quando a entrada pode vir sem ele. */
const obrigatorioNoSchema = (campo: z.ZodType) => !campo.safeParse(undefined).success;

const conferirParidade = (colecao: string, forma: Record<string, z.ZodType>) => {
  const campos = camposDa(colecao);
  assert.deepEqual(
    campos.map(({ name }) => name).toSorted(),
    Object.keys(forma).toSorted(),
    `os campos de ${colecao} no CMS e no schema divergem`,
  );
  for (const campo of campos)
    assert.equal(
      obrigatorioNoCms(campo),
      obrigatorioNoSchema(forma[campo.name]!),
      `${colecao}.${campo.name}: obrigatório no CMS e no schema não batem`,
    );
};

test('os campos do Projeto no CMS são os do schema, obrigatórios nos mesmos lugares', () => {
  conferirParidade('projetos', esquemaDeProjeto(() => z.string()).shape);
});

test('os campos do Depoimento no CMS são os do schema, e só o texto é opcional', () => {
  conferirParidade('depoimentos', esquemaDeDepoimento().shape);
  assert.deepEqual(
    camposDa('depoimentos')
      .filter((campo) => !obrigatorioNoCms(campo))
      .map(({ name }) => name),
    ['texto'],
  );
});

/** O que o formulário do CMS faz com um valor: aceita, ou barra com a mensagem do padrão. */
const formularioAceita = (colecao: string, nome: string, valor: string) => {
  const campo = camposDa(colecao).find((c) => c.name === nome);
  assert.ok(campo?.pattern, `${colecao}.${nome} não tem padrão no CMS`);
  return new RegExp(campo.pattern[0]).test(valor);
};

test('o formulário barra área fora do padrão antes do commit', () => {
  for (const area of ['46,88 m²', '1.125,54 m²', '100 m²'])
    assert.equal(formularioAceita('projetos', 'area', area), true, `${area} deveria passar`);
  for (const area of ['46,88', '46.88 m²', '1125,54 m²', '46,88 m2'])
    assert.equal(formularioAceita('projetos', 'area', area), false, `${area} deveria ser barrada`);
});

test('o formulário barra ano fora do padrão antes do commit', () => {
  for (const ano of ['2025', '2025 (acadêmico)'])
    assert.equal(formularioAceita('projetos', 'ano', ano), true, `${ano} deveria passar`);
  for (const ano of ['25', '2025 academico', 'dois mil e vinte'])
    assert.equal(formularioAceita('projetos', 'ano', ano), false, `${ano} deveria ser barrado`);
});

test('o formulário barra HTML nos campos de texto', () => {
  for (const nome of ['titulo', 'descricao', 'equipe'])
    assert.equal(formularioAceita('projetos', nome, '<b>negrito</b>'), false, nome);
  assert.equal(formularioAceita('depoimentos', 'texto', '<i>ótima</i>'), false);
});

test('o link da equipe só aceita https no formulário', () => {
  assert.equal(formularioAceita('projetos', 'equipeUrl', 'https://jaspe.vercel.app/'), true);
  assert.equal(formularioAceita('projetos', 'equipeUrl', 'http://jaspe.vercel.app/'), false);
});

test('o login do CMS passa pelo autenticador do próprio site', () => {
  const origem = 'https://giordanna-pereira-site.joaoaraxaiba.workers.dev';
  const { backend } = configuracaoDoCms(origem);
  assert.equal(backend.name, 'github');
  assert.equal(backend.repo, 'johnlaff/giordanna-pereira-site');
  assert.ok('base_url' in backend && 'auth_endpoint' in backend);
  assert.equal(
    new URL(`${backend.base_url}/${backend.auth_endpoint}`).href,
    `${origem}/api/admin/entrar`,
  );
});

test('um Depoimento novo pelo CMS entra no fim do carrossel', () => {
  const colecao = configuracao.collections?.find((c) => 'name' in c && c.name === 'depoimentos');
  assert.ok(colecao && 'slug' in colecao && typeof colecao.slug === 'string');
  // O nome que o Sveltia dá ao arquivo de um Depoimento de Ana criado em 23/09/2026.
  const novo = colecao.slug
    .replace('{{year}}', '2026')
    .replace('{{month}}', '09')
    .replace('{{day}}', '23')
    .replace('{{slug}}', 'ana');
  assert.equal(novo, '20260923-ana');
  const existentes = readdirSync('src/content/depoimentos').map((nome) =>
    nome.replace(/\.yml$/, ''),
  );
  const ids = ordenarDepoimentos([...existentes, novo].map((id) => ({ id }))).map(({ id }) => id);
  assert.equal(ids.at(-1), novo);
  // Um segundo, criado depois, entra depois dele.
  assert.deepEqual(
    ordenarDepoimentos([{ id: '20270105-bia' }, { id: novo }]).map(({ id }) => id),
    [novo, '20270105-bia'],
  );
});
