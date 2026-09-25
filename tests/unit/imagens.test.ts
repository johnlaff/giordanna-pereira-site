import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { test } from 'node:test';
import astroConfig from '../../astro.config.ts';
import {
  largurasDasVariantes,
  qualidadeDeImagem,
  qualidadeSemPerda,
  servicoDeImagem,
} from '../../src/imagens.ts';
import servicoSharp from '../../src/servico-de-imagem.ts';

/**
 * O esforço do AVIF é 96% do tempo de build (números em `src/imagens.ts`), e ele chega ao
 * compressor por um caminho frágil: o adapter da Cloudflare descarta `image.service` quando o
 * entrypoint é o do próprio Astro. Se esse desvio se perder, nada quebra — o build só volta a
 * levar dezessete minutos em silêncio. Estes testes são o alarme.
 *
 * O alcance deles tem um limite que vale saber: eles cobrem os dois lados que dependem deste
 * repositório — o serviço honra `service.config.avif`, e o `astro.config.ts` aponta para um
 * entrypoint que o adapter preserva. Nenhum deles executa o adapter, que não expõe
 * `setImageConfig` fora do pacote; uma mudança de comportamento dele passaria por aqui.
 */

// A menor imagem do acervo, para o teste custar o mínimo; qualquer uma serve de entrada.
const menorImagem = readdirSync('src/assets')
  .map((arquivo) => [`src/assets/${arquivo}`, statSync(`src/assets/${arquivo}`).size] as const)
  .sort(([, a], [, b]) => a - b)[0]![0];

const transformar = async (
  opcoes: { format: string; quality: number },
  avif?: { effort: number },
) => {
  const { data } = await servicoSharp.transform(
    readFileSync(menorImagem),
    { src: menorImagem, width: 320, ...opcoes },
    // O resto da configuração de imagem não entra na compressão; só `service.config` entra.
    {
      endpoint: { route: '/_image' },
      service: {
        entrypoint: servicoDeImagem.entrypoint,
        config: avif === undefined ? {} : { avif },
      },
      dangerouslyProcessSVG: false,
      domains: [],
      remotePatterns: [],
      responsiveStyles: false,
    },
    { warn: () => {}, info: () => {}, error: () => {} },
  );
  return data;
};

const bytesDoAvif = async (avif: { effort: number } | undefined) =>
  (await transformar({ format: 'avif', quality: qualidadeDeImagem }, avif)).length;

test('o esforço configurado chega ao compressor de AVIF', async () => {
  // A comparação é contra o padrão do sharp, e não contra outro esforço qualquer, porque a
  // falha a pegar é justamente a configuração ser ignorada — e o que sobra então é o padrão.
  const configurado = await bytesDoAvif(servicoDeImagem.config.avif);
  const padraoDoSharp = await bytesDoAvif(undefined);
  assert.notEqual(
    configurado,
    padraoDoSharp,
    'o serviço ignorou `service.config.avif`: o esforço de src/imagens.ts não tem efeito',
  );
});

test('o Astro usa o serviço de src/imagens.ts', () => {
  assert.deepEqual(astroConfig.image?.service, servicoDeImagem);
});

test('o entrypoint do serviço não é o do próprio Astro', () => {
  // `hasUserImageService` em @astrojs/cloudflare: com o entrypoint do Astro o adapter troca o
  // serviço pelo dele e leva junto a configuração — o esforço voltaria ao padrão sem aviso.
  assert.notEqual(servicoDeImagem.entrypoint, 'astro/assets/services/sharp');
  assert.ok(statSync(servicoDeImagem.entrypoint.replace(/^\.\//, '')).isFile());
});

// A lista explícita tem de repetir o que o Astro gerava sozinho até 2560 px: uma variante a mais
// ou a menos muda o nome dos arquivos e joga fora o cache de imagens do CI inteiro.
test('até 2560 px, as variantes são as que o Astro já gerava', () => {
  assert.deepEqual(largurasDasVariantes(2560), [640, 750, 828, 1080, 1280, 1668, 2048, 2560]);
  assert.deepEqual(largurasDasVariantes(2106), [640, 750, 828, 1080, 1280, 1668, 2048, 2106]);
  assert.deepEqual(largurasDasVariantes(700), [640, 700]);
});

test('uma prancha em alta não ganha variante acima de 2560 px', () => {
  assert.equal(Math.max(...largurasDasVariantes(7680)), 2560);
});

// A prancha em alta vai ao zoom pixel a pixel: um WebP com perda borraria justamente as letras.
test('o WebP na qualidade sem perda sai idêntico, pixel a pixel, ao que entrou', async () => {
  const { default: sharp } = await import('sharp');
  const webp = await transformar({ format: 'webp', quality: qualidadeSemPerda });
  const esperado = await sharp(readFileSync(menorImagem)).resize({ width: 320 }).raw().toBuffer();
  assert.deepEqual(await sharp(webp).raw().toBuffer(), esperado);
});

test('um WebP abaixo da qualidade sem perda continua com perda', async () => {
  const { default: sharp } = await import('sharp');
  const webp = await transformar({ format: 'webp', quality: qualidadeDeImagem });
  const esperado = await sharp(readFileSync(menorImagem)).resize({ width: 320 }).raw().toBuffer();
  assert.notDeepEqual(await sharp(webp).raw().toBuffer(), esperado);
});

// O CMS grava WebP com perda: recomprimi-lo sem perda dobraria o peso sem ganhar um pixel.
test('um WebP pedido sem perda no tamanho dele sai como está, byte a byte', async () => {
  const { default: sharp } = await import('sharp');
  const entrada = readFileSync(menorImagem);
  const { width } = await sharp(entrada).metadata();
  const { data } = await servicoSharp.transform(
    entrada,
    { src: menorImagem, width, format: 'webp', quality: qualidadeSemPerda },
    {
      endpoint: { route: '/_image' },
      service: { entrypoint: servicoDeImagem.entrypoint, config: {} },
      dangerouslyProcessSVG: false,
      domains: [],
      remotePatterns: [],
      responsiveStyles: false,
    },
    { warn: () => {}, info: () => {}, error: () => {} },
  );
  assert.ok(Buffer.from(data).equals(entrada));
});
