import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { test } from 'node:test';
import astroConfig from '../../astro.config.ts';
import { qualidadeDeImagem, servicoDeImagem } from '../../src/imagens.ts';
import servicoSharp from '../../src/servico-de-imagem.ts';

/**
 * O esforço do AVIF é 96% do tempo de build (números em `src/imagens.ts`), e ele chega ao
 * compressor por um caminho frágil: o adapter da Cloudflare descarta `image.service` quando o
 * entrypoint é o do próprio Astro. Se esse desvio se perder, nada quebra — o build só volta a
 * levar dezessete minutos em silêncio. Estes testes são o alarme.
 */

// A menor imagem do acervo, para o teste custar o mínimo; qualquer uma serve de entrada.
const menorImagem = readdirSync('src/assets')
  .map((arquivo) => [`src/assets/${arquivo}`, statSync(`src/assets/${arquivo}`).size] as const)
  .sort(([, a], [, b]) => a - b)[0]![0];

const bytesDoAvif = async (avif: { effort: number }) => {
  const { data } = await servicoSharp.transform(
    readFileSync(menorImagem),
    { src: menorImagem, width: 320, format: 'avif', quality: qualidadeDeImagem },
    // O resto da configuração de imagem não entra na compressão; só `service.config` entra.
    {
      endpoint: { route: '/_image' },
      service: { entrypoint: servicoDeImagem.entrypoint, config: { avif } },
      dangerouslyProcessSVG: false,
      domains: [],
      remotePatterns: [],
      responsiveStyles: false,
    },
    { warn: () => {}, info: () => {}, error: () => {} },
  );
  return data.length;
};

test('o esforço configurado chega ao compressor de AVIF', async () => {
  const configurado = await bytesDoAvif(servicoDeImagem.config.avif);
  const referencia = await bytesDoAvif({ effort: 0 });
  assert.notEqual(
    configurado,
    referencia,
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
