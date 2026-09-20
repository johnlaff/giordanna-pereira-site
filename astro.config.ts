import cloudflare from '@astrojs/cloudflare';
import { defineConfig, fontProviders } from 'astro/config';
import { servicoDeImagem } from './src/imagens.ts';

export default defineConfig({
  site: 'https://giordannapereira.arq.br',
  output: 'static',
  // Uma URL por página, sem barra final. Vale com o `html_handling` do wrangler.jsonc, que
  // faz o Worker servir a mesma forma; separados, o dev server recusaria o que a Produção
  // entrega. É daqui que o sitemap e as URLs de compartilhamento tiram a forma canônica.
  trailingSlash: 'never',
  // Nada usa sessões; sem isto o adapter provisiona um namespace KV a cada deploy.
  session: false,
  // Imagens geradas no build pelo sharp (AVIF + WebP), não pelo Cloudflare Images.
  adapter: cloudflare({ imageService: 'compile' }),
  // O que decide as variantes mora em `src/imagens.ts`, e não aqui, porque a chave do cache
  // de imagens do CI observa aquele caminho: a qualidade, passada por imagem, e o serviço,
  // que carrega o esforço de compressão do AVIF — o que domina o tempo de build (ADR 0009).
  image: { layout: 'constrained', service: servicoDeImagem },
  // Fontes baixadas no build e servidas do próprio domínio: nenhuma requisição ao Google Fonts em runtime.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Cormorant Garamond',
      cssVariable: '--font-serif',
      weights: [400, 500, 600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Garamond', 'Georgia', 'serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Jost',
      cssVariable: '--font-sans',
      weights: [300, 400, 500, 600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Century Gothic', 'Futura', 'sans-serif'],
    },
  ],
});
