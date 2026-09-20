import assert from 'node:assert/strict';
import { test } from 'node:test';
import { destinosDeCompartilhamento } from '../../src/components/compartilhe.ts';
import { site, tituloDaPagina } from '../../src/config.ts';

const url = 'https://giordannapereira.arq.br/projetos/edificio-vitalis';
const destinos = destinosDeCompartilhamento('Edifício Vitalis', url);
const porTipo = (tipo: string) => destinos.find((destino) => destino.tipo === tipo)!;

test('o que se compartilha é o título da página, e não só o nome do Projeto', () => {
  // Quem recebe o link vê de quem ele é antes de abrir: é o mesmo par do título da aba.
  assert.equal(tituloDaPagina('Edifício Vitalis'), `Edifício Vitalis — ${site.nome}`);
  // O LinkedIn e o Facebook só recebem a URL — o título quem monta são eles, a partir dela.
  for (const tipo of ['whatsapp', 'email']) {
    assert.ok(
      porTipo(tipo).href.includes(encodeURIComponent(tituloDaPagina('Edifício Vitalis'))),
      `${tipo} deveria levar o título da página`,
    );
  }
});

test('cada destino leva a URL canônica da página, com o parâmetro que ele espera', () => {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(tituloDaPagina('Edifício Vitalis'));

  assert.equal(porTipo('whatsapp').href, `https://wa.me/?text=${t}%20${u}`);
  assert.equal(
    porTipo('linkedin').href,
    `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
  );
  assert.equal(porTipo('facebook').href, `https://www.facebook.com/sharer/sharer.php?u=${u}`);
  assert.equal(porTipo('email').href, `mailto:?subject=${t}&body=${u}`);
});

test('a ordem dos destinos é a do Preview: WhatsApp, LinkedIn, Facebook e e-mail', () => {
  assert.deepEqual(
    destinos.map((destino) => destino.tipo),
    ['whatsapp', 'linkedin', 'facebook', 'email'],
  );
});

test('o acento e o espaço do título viajam codificados, não crus', () => {
  // Um "&" ou um espaço solto no parâmetro cortaria o título no destino, em silêncio.
  const { href } = destinosDeCompartilhamento('Casa A & B', url).find((d) => d.tipo === 'email')!;
  assert.ok(href.includes('Casa%20A%20%26%20B'));
  assert.ok(!/ /.test(href));
});

test('cada controle tem rótulo acessível próprio, e a dica é só o nome do destino', () => {
  // Seis controles na mesma fileira: sem rótulo distinto, o leitor de tela anuncia seis "Compartilhar".
  assert.deepEqual(
    destinos.map((destino) => destino.rotulo),
    [
      'Compartilhar no WhatsApp',
      'Compartilhar no LinkedIn',
      'Compartilhar no Facebook',
      'Compartilhar por e-mail',
    ],
  );
  assert.deepEqual(
    destinos.map((destino) => destino.dica),
    ['WhatsApp', 'LinkedIn', 'Facebook', 'E-mail'],
  );
});

test('só o e-mail fica no próprio aplicativo; os outros três abrem em aba nova', () => {
  assert.deepEqual(
    destinos.map((destino) => destino.externo),
    [true, true, true, false],
  );
});
