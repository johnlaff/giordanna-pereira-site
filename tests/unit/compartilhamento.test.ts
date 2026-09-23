import assert from 'node:assert/strict';
import { test } from 'node:test';
import { caminhoDoCartao, cartoesDoSite } from '../../src/compartilhamento/cartoes.ts';
import {
  dadosDaPessoa,
  dadosDoProjeto,
  jsonLd,
} from '../../src/compartilhamento/dados-estruturados.ts';
import { errosDeJsonLd } from '../schema-org.ts';

const site = new URL('https://giordannapereira.arq.br');

const projeto = (id: string, dados: { capa?: string; galeria?: string[] } = {}) => ({
  id,
  data: {
    titulo: `Projeto ${id}`,
    tipo: 'Residencial',
    capa: dados.capa,
    galeria: dados.galeria ?? [],
  },
});

test('cada rota pública tem o seu Cartão, e a home fica com o nome da raiz', () => {
  assert.equal(caminhoDoCartao('/'), '/og/home.jpg');
  assert.equal(caminhoDoCartao('/projetos'), '/og/projetos.jpg');
  assert.equal(caminhoDoCartao('/projetos/mini-casa'), '/og/projetos/mini-casa.jpg');
  assert.equal(caminhoDoCartao('/contato'), '/og/contato.jpg');
});

test('um Projeto chamado "contato" não disputa o Cartão da página de contato', () => {
  // O slug vem do nome do arquivo no CMS; o Cartão do Projeto mora na pasta dos Projetos.
  assert.notEqual(caminhoDoCartao('/projetos/contato'), caminhoDoCartao('/contato'));
});

test('o Cartão de um Projeto leva a Capa, o Tipo e o título', () => {
  const [, , cartao] = cartoesDoSite([
    projeto('edificio-vitalis', {
      capa: 'src/assets/vitalis-torre-sky.webp',
      galeria: ['src/assets/hero.webp'],
    }),
  ]);
  assert.deepEqual(cartao, {
    arquivo: 'og/projetos/edificio-vitalis.jpg',
    fundo: 'src/assets/vitalis-torre-sky.webp',
    olho: 'Residencial',
    titulo: 'Projeto edificio-vitalis',
  });
});

test('sem Capa, o Cartão do Projeto usa a primeira imagem da Galeria', () => {
  const [, , cartao] = cartoesDoSite([
    projeto('mini-casa', { galeria: ['src/assets/loft-render.webp', 'src/assets/loft-p.webp'] }),
  ]);
  assert.equal(cartao?.fundo, 'src/assets/loft-render.webp');
});

test('um Projeto sem imagem nenhuma ganha o Cartão Em breve, sem fundo', () => {
  const [, , cartao] = cartoesDoSite([projeto('mirante-cestes')]);
  assert.equal(cartao?.arquivo, 'og/projetos/mirante-cestes.jpg');
  assert.equal(cartao?.fundo, undefined);
});

test('o site tem um Cartão por rota pública, na ordem do sitemap', () => {
  const cartoes = cartoesDoSite([
    projeto('edificio-vitalis', { capa: 'src/assets/vitalis-torre-sky.webp' }),
    projeto('mirante-cestes'),
  ]);
  assert.deepEqual(
    cartoes.map(({ arquivo }) => arquivo),
    [
      'og/home.jpg',
      'og/projetos.jpg',
      'og/projetos/edificio-vitalis.jpg',
      'og/projetos/mirante-cestes.jpg',
      'og/contato.jpg',
    ],
  );
});

test('a Grade leva a Capa do primeiro Projeto na Ordem', () => {
  const [, grade] = cartoesDoSite([
    projeto('edificio-vitalis', { capa: 'src/assets/vitalis-torre-sky.webp' }),
    projeto('consultorio-ginecocare', { capa: 'src/assets/gineco-r04.webp' }),
  ]);
  assert.equal(grade?.fundo, 'src/assets/vitalis-torre-sky.webp');
  assert.equal(grade?.titulo, 'Projetos');
});

test('a home abre com o hero e o contato com a chamada da página', () => {
  const [home, , contato] = cartoesDoSite([]);
  assert.equal(home?.fundo, 'src/assets/hero.webp');
  assert.equal(home?.titulo, 'Espaços projetados');
  assert.equal(home?.enfase, 'para viver.');
  assert.equal(contato?.olho, 'Contato');
  assert.equal(contato?.titulo, 'Tem um projeto para tirar do\u00a0papel?');
});

test('a home descreve Giordanna como Person, com os perfis dela e a cidade', () => {
  const pessoa = dadosDaPessoa(site);
  assert.deepEqual(errosDeJsonLd(pessoa), []);
  assert.equal(pessoa['@type'], 'Person');
  assert.equal(pessoa.name, 'Giordanna Pereira');
  assert.equal(pessoa.url, 'https://giordannapereira.arq.br/');
  assert.deepEqual(pessoa.sameAs, [
    'https://www.linkedin.com/in/giordannapb',
    'https://behance.net/giordannaborges',
  ]);
  assert.equal(pessoa.address.addressLocality, 'Uberlândia');
});

const campos = {
  titulo: 'Edifício Vitalis',
  tipo: 'Comercial · Bem-estar',
  descricao: 'Edifício comercial dedicado ao bem-estar.',
  local: 'Uberlândia · MG',
  ano: '2025 (acadêmico)',
  equipe: 'Escritório Jaspe',
};

test('cada Projeto é um CreativeWork, com a Ficha técnica e o Cartão como imagem', () => {
  const obra = dadosDoProjeto('edificio-vitalis', campos, site);
  assert.deepEqual(errosDeJsonLd(obra), []);
  assert.equal(obra['@type'], 'CreativeWork');
  assert.equal(obra.name, 'Edifício Vitalis');
  assert.equal(obra.genre, 'Comercial · Bem-estar');
  assert.equal(obra.url, 'https://giordannapereira.arq.br/projetos/edificio-vitalis');
  assert.equal(obra.image, 'https://giordannapereira.arq.br/og/projetos/edificio-vitalis.jpg');
  assert.equal(obra.creditText, 'Escritório Jaspe');
  assert.equal(obra.dateCreated, '2025');
  assert.deepEqual(obra.locationCreated, { '@type': 'Place', name: 'Uberlândia · MG' });
});

test('um Ano que não começa por um ano fica fora do dateCreated', () => {
  // O Ano é texto livre no CMS; o schema.org só aceita data ISO nesse campo.
  const obra = dadosDoProjeto('x', { ...campos, ano: 'em andamento' }, site);
  assert.equal('dateCreated' in obra, false);
  assert.deepEqual(errosDeJsonLd(obra), []);
});

test('o validador reprova propriedade que o schema.org não tem e URL relativa', () => {
  // O teste do teste: sem isto, um validador que aprova tudo passaria os dois acima.
  assert.notDeepEqual(
    errosDeJsonLd({ '@context': 'https://schema.org', '@type': 'Person', name: 'G', cor: 'azul' }),
    [],
  );
  assert.notDeepEqual(
    errosDeJsonLd({ '@context': 'https://schema.org', '@type': 'CreativeWork', url: '/projetos' }),
    [],
  );
});

test('o JSON-LD vai para a página sem abrir brecha para fechar o script', () => {
  assert.equal(jsonLd({ name: '</script><b>' }), '{"name":"\\u003c/script>\\u003cb>"}');
});
