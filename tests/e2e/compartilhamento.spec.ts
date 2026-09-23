import { expect, test, type APIRequestContext } from '@playwright/test';
import sharp from 'sharp';
import { errosDeJsonLd } from '../schema-org.ts';
import { projetos, temCapa } from './projetos.ts';
import { rotas } from './rotas.ts';

/**
 * O que o WhatsApp, o LinkedIn e o buscador leem de cada página: as tags Open Graph, o cartão
 * do Twitter/X e os dados estruturados. Os leitores de link não rodam JavaScript, então tudo
 * é conferido no HTML como o Worker o entrega.
 */

/** As rotas da suíte, menos a que existe para dar 404. */
const PUBLICAS = rotas.filter((rota) => rota !== '/nao-existe');

const meta = (html: string, chave: string): string | undefined => {
  const tag = [...html.matchAll(/<meta\b[^>]*>/g)]
    .map(([t]) => t)
    .find((t) => t.includes(`property="${chave}"`) || t.includes(`name="${chave}"`));
  const conteudo = tag === undefined ? undefined : /content="([^"]*)"/.exec(tag)?.[1];
  return conteudo?.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
};

const jsonLds = (html: string): unknown[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map(([, j]) =>
    JSON.parse(j ?? ''),
  );

/** Largura e altura de um JPEG, lidas do cabeçalho do quadro (marcador SOF). */
const medidasDoJpeg = (bytes: Buffer) => {
  for (let i = 2; i < bytes.length;) {
    const marcador = bytes[i + 1] ?? 0;
    if (marcador >= 0xc0 && marcador <= 0xc3)
      return { largura: bytes.readUInt16BE(i + 7), altura: bytes.readUInt16BE(i + 5) };
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  return undefined;
};

const pagina = async (request: APIRequestContext, rota: string) => {
  const resposta = await request.get(rota);
  expect(resposta.status()).toBe(200);
  return resposta.text();
};

for (const rota of PUBLICAS) {
  test(`${rota} tem título, descrição e Cartão de 1200×630 para quem compartilha`, async ({
    request,
  }) => {
    const html = await pagina(request, rota);
    const titulo = /<title>([^<]*)<\/title>/.exec(html)?.[1];
    expect(meta(html, 'og:title')).toBe(titulo);
    expect(meta(html, 'og:description')).toBe(meta(html, 'description'));
    expect(meta(html, 'og:description')?.length).toBeGreaterThan(50);
    expect(meta(html, 'og:type')).toBe('website');
    expect(meta(html, 'og:locale')).toBe('pt_BR');
    expect(meta(html, 'og:site_name')).toBe('Giordanna Pereira Arquitetura');
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');

    // O endereço é o canônico, sem barra final (ADR 0007): o leitor de link segue o og:url.
    const url = new URL(meta(html, 'og:url') ?? '');
    expect(url.origin).toBe('https://giordannapereira.arq.br');
    expect(url.pathname).toBe(rota);

    const imagem = new URL(meta(html, 'og:image') ?? '');
    expect(imagem.origin).toBe('https://giordannapereira.arq.br');
    expect(meta(html, 'og:image:width')).toBe('1200');
    expect(meta(html, 'og:image:height')).toBe('630');
    expect(meta(html, 'og:image:alt')).toBeTruthy();

    const cartao = await request.get(imagem.pathname);
    expect(cartao.status(), `${imagem.pathname} não existe`).toBe(200);
    expect(cartao.headers()['content-type']).toBe('image/jpeg');
    expect(medidasDoJpeg(await cartao.body())).toEqual({ largura: 1200, altura: 630 });
  });
}

test('cada Projeto tem o seu Cartão, e nenhum repete o de outra página', async ({ request }) => {
  const imagens = await Promise.all(
    PUBLICAS.map(async (rota) => meta(await pagina(request, rota), 'og:image')),
  );
  expect(new Set(imagens).size).toBe(PUBLICAS.length);
});

test('a página que não existe também leva o Cartão do site', async ({ request }) => {
  const resposta = await request.get('/nao-existe');
  expect(resposta.status()).toBe(404);
  const html = await resposta.text();
  const imagem = new URL(meta(html, 'og:image') ?? '');
  expect((await request.get(imagem.pathname)).status()).toBe(200);
  // Não há endereço canônico a anunciar para uma página que não existe.
  expect(meta(html, 'og:url')).toBeUndefined();
});

test('as JPGs de Projeto do handoff saíram da pasta pública', async ({ request }) => {
  // Os Cartões do Preview eram fotografias fixas em og/<slug>.jpg; agora o de cada Projeto é
  // desenhado pelo build em og/projetos/. (Os da home e do contato mantêm o endereço.)
  for (const { slug } of projetos)
    expect((await request.get(`/og/${slug}.jpg`)).status(), slug).toBe(404);
});

for (const projeto of projetos.filter((p) => !temCapa(p))) {
  test(`o Cartão de ${projeto.slug}, sem imagem, é o desenho do estado Em breve`, async ({
    request,
  }) => {
    // O canto de cima, à direita, é onde o véu quase some: ali aparece o fundo liso e claro
    // do Em breve (#E4E8EA), e não um render, que teria luz e sombra.
    const cartao = await (await request.get(`/og/projetos/${projeto.slug}.jpg`)).body();
    const canto = await sharp(cartao)
      .extract({ left: 700, top: 40, width: 400, height: 120 })
      .greyscale()
      .png()
      .toBuffer();
    const [cinza] = (await sharp(canto).stats()).channels;
    expect(cinza?.mean).toBeGreaterThan(190);
    expect(cinza?.stdev).toBeLessThan(12);
  });
}

test('a home descreve Giordanna em JSON-LD válido', async ({ request }) => {
  const [pessoa, ...outros] = jsonLds(await pagina(request, '/'));
  expect(outros).toEqual([]);
  expect(errosDeJsonLd(pessoa)).toEqual([]);
  expect(pessoa).toMatchObject({ '@type': 'Person', name: 'Giordanna Pereira' });
});

for (const { rota, dados } of projetos) {
  test(`${rota} se descreve como CreativeWork válido`, async ({ request }) => {
    const [obra, ...outros] = jsonLds(await pagina(request, rota));
    expect(outros).toEqual([]);
    expect(errosDeJsonLd(obra)).toEqual([]);
    expect(obra).toMatchObject({
      '@type': 'CreativeWork',
      name: dados.titulo,
      genre: dados.tipo,
      url: `https://giordannapereira.arq.br${rota}`,
    });
  });
}

test('as demais páginas não inventam dados estruturados', async ({ request }) => {
  for (const rota of ['/projetos', '/contato'])
    expect(jsonLds(await pagina(request, rota))).toEqual([]);
});
