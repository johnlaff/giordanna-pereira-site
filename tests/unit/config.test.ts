import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contatos, emailExibido } from '../../src/config.ts';

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
