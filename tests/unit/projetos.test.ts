import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { z } from 'astro/zod';
import {
  capaDe,
  esquemaDeProjeto,
  ordenarProjetos,
  vizinhosNaOrdem,
} from '../../src/content.schema.ts';

/**
 * Dublê do `image()` do Astro: resolve o caminho como o loader resolveria, relativo ao
 * arquivo do Projeto, e falha quando o arquivo não existe. Mesma forma do original
 * (transformação assíncrona), por isso os testes usam `safeParseAsync`.
 */
const pastaDosProjetos = new URL('../../src/content/projetos/', import.meta.url);
const imagem = () =>
  z.string().transform((caminho, ctx) => {
    const arquivo = new URL(caminho, pastaDosProjetos);
    if (!existsSync(arquivo)) {
      ctx.addIssue({ code: 'custom', message: `imagem inexistente: ${caminho}`, fatal: true });
      return z.NEVER;
    }
    return { src: caminho };
  });

const esquema = esquemaDeProjeto(imagem);

const projeto = {
  titulo: 'Consultório GinecoCare',
  tipo: 'Consultório · Saúde',
  descricao: 'Consultório ginecológico no Edifício Vitalis.',
  ferramentas: ['Archicad', 'Enscape'],
  local: 'Uberlândia · MG',
  ano: '2025 (acadêmico)',
  area: '46,88 m²',
  equipe: 'Giordanna Pereira',
  galeria: ['../../assets/gineco-r04.webp'],
  ordem: 20,
};

const validar = (mudancas: Record<string, unknown>) =>
  esquema.safeParseAsync({ ...projeto, ...mudancas });

test('um Projeto completo passa', async () => {
  assert.equal((await esquema.safeParseAsync(projeto)).success, true);
});

test('campo obrigatório ausente falha', async () => {
  for (const campo of [
    'titulo',
    'tipo',
    'descricao',
    'ferramentas',
    'local',
    'ano',
    'area',
    'equipe',
    'ordem',
  ]) {
    const incompleto: Record<string, unknown> = { ...projeto };
    delete incompleto[campo];
    assert.equal(
      (await esquema.safeParseAsync(incompleto)).success,
      false,
      `${campo} deveria ser obrigatório`,
    );
  }
});

test('imagem inexistente falha, na Galeria e na Capa', async () => {
  assert.equal((await validar({ galeria: ['../../assets/nao-existe.webp'] })).success, false);
  assert.equal((await validar({ capa: '../../assets/nao-existe.webp' })).success, false);
});

test('Galeria vazia é aceita: o Projeto fica Em breve', async () => {
  assert.equal((await validar({ galeria: [] })).success, true);
});

// O CMS não grava campo opcional vazio (`omit_empty_optional_fields`): um Projeto salvo sem
// imagens chega sem a chave `galeria`, e é o mesmo Projeto Em breve.
test('Galeria ausente é o mesmo que vazia: o Projeto fica Em breve', async () => {
  const semGaleria: Record<string, unknown> = { ...projeto };
  delete semGaleria['galeria'];
  const resultado = await esquema.safeParseAsync(semGaleria);
  assert.equal(resultado.success, true);
  assert.deepEqual(resultado.data?.galeria, []);
});

test('a área segue o padrão brasileiro, com milhar em ponto, decimal em vírgula e m²', async () => {
  for (const area of ['5,98 m²', '48 m²', '100 m²', '1.125,54 m²', '9.015,39 m²', '4.000 m²'])
    assert.equal((await validar({ area })).success, true, `${area} deveria passar`);
  for (const area of ['46,88', '46,88m²', '46.88 m²', '1125,54 m²', '46,88 m2', '46,888 m²', 'm²'])
    assert.equal((await validar({ area })).success, false, `${area} deveria falhar`);
});

test('o ano tem quatro dígitos, com "(acadêmico)" opcional', async () => {
  for (const ano of ['2010', '2026', '2025 (acadêmico)'])
    assert.equal((await validar({ ano })).success, true, `${ano} deveria passar`);
  for (const ano of ['25', '2025 academico', '2025(acadêmico)', 'dois mil', '2025 (Acadêmico)'])
    assert.equal((await validar({ ano })).success, false, `${ano} deveria falhar`);
});

test('Capa é opcional e, quando existe, aponta para uma imagem do repositório', async () => {
  assert.equal((await validar({ capa: '../../assets/gineco-r04.webp' })).success, true);
});

test('o link da equipe é opcional e só aceita https', async () => {
  assert.equal((await validar({ equipeUrl: 'https://jaspe.vercel.app/' })).success, true);
  assert.equal((await validar({ equipeUrl: 'http://jaspe.vercel.app/' })).success, false);
  assert.equal((await validar({ equipeUrl: 'jaspe.vercel.app' })).success, false);
});

test('nenhum campo de conteúdo aceita HTML', async () => {
  const comTag = '<a href="https://exemplo.com">Escritório Jaspe</a>';
  assert.equal((await validar({ descricao: comTag })).success, false);
  assert.equal((await validar({ equipe: comTag })).success, false);
  assert.equal((await validar({ titulo: comTag })).success, false);
  assert.equal((await validar({ ferramentas: [comTag] })).success, false);
});

test('Ordem repetida entre Projetos falha', () => {
  assert.throws(
    () =>
      ordenarProjetos([
        { id: 'consultorio-ginecocare', data: { ordem: 20 } },
        { id: 'edificio-vitalis', data: { ordem: 20 } },
      ]),
    /ordem 20/i,
  );
});

test('os Projetos saem na Ordem crescente', () => {
  const ordenados = ordenarProjetos([
    { id: 'b', data: { ordem: 20 } },
    { id: 'a', data: { ordem: 10 } },
    { id: 'c', data: { ordem: 30 } },
  ]);
  assert.deepEqual(
    ordenados.map((p) => p.id),
    ['a', 'b', 'c'],
  );
});

test('a Capa é a própria quando definida, e a primeira da Galeria quando não', () => {
  const capa = { src: 'capa.webp' };
  const primeira = { src: 'primeira.webp' };
  assert.deepEqual(capaDe({ data: { capa, galeria: [primeira] } }), capa);
  assert.deepEqual(capaDe({ data: { galeria: [primeira, { src: 'outra.webp' }] } }), primeira);
});

test('um Projeto Em breve não tem Capa: nem imagem própria, nem Galeria', () => {
  assert.equal(capaDe({ data: { galeria: [] } }), undefined);
});

test('a navegação entre Projetos é circular: o próximo do último é o primeiro', () => {
  const projetos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(vizinhosNaOrdem(projetos, 1), { anterior: { id: 'a' }, proximo: { id: 'c' } });
  assert.deepEqual(vizinhosNaOrdem(projetos, 0), { anterior: { id: 'c' }, proximo: { id: 'b' } });
  assert.deepEqual(vizinhosNaOrdem(projetos, 2), { anterior: { id: 'b' }, proximo: { id: 'a' } });
});

test('com menos de dois Projetos não há vizinho para onde navegar', () => {
  assert.equal(vizinhosNaOrdem([{ id: 'a' }], 0), undefined);
  assert.equal(vizinhosNaOrdem([], 0), undefined);
});
