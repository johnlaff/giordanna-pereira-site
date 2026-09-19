import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { z } from 'astro/zod';
import { esquemaDeProjeto, ordenarProjetos } from '../../src/content.schema.ts';

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
    'galeria',
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
