import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contatos, emailExibido, site, tituloDaPagina } from '../../src/config.ts';

test('o Contato de e-mail deriva da constante única', () => {
  const email = contatos.find((c) => c.tipo === 'email');
  assert.equal(email?.href, `mailto:${emailExibido}`);
  assert.equal(email?.texto, emailExibido);
});

test('os quatro Contatos estão na ordem WhatsApp, LinkedIn, Behance, e-mail', () => {
  assert.deepEqual(
    contatos.map((c) => c.tipo),
    ['whatsapp', 'linkedin', 'behance', 'email'],
  );
});

test('só canais externos abrem em nova aba', () => {
  for (const c of contatos) assert.equal(c.externo, c.href.startsWith('https://'));
});

test('o título da home tem o nome e a profissão, como quem a procura escreve', () => {
  const titulo = tituloDaPagina();
  for (const palavra of ['Giordanna', 'Arquiteta']) assert.match(titulo, new RegExp(palavra));
  // A cidade fica na descrição: o título não restringe a quem atende de fora (ver `site.titulo`).
  assert.doesNotMatch(titulo, /Uberlândia/);
  // O Google corta o título por volta de 60 caracteres.
  assert.ok(titulo.length <= 60, `${titulo.length} caracteres`);
});

test('a descrição do site diz a cidade e o alcance nacional', () => {
  assert.match(site.descricao, /Uberlândia/);
  assert.match(site.descricao, /todo o Brasil/);
});
