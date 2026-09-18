import cloudflare from '@astrojs/cloudflare';
import { defineConfig, fontProviders } from 'astro/config';

export default defineConfig({
  site: 'https://giordannapereira.arq.br',
  output: 'static',
  // Imagens geradas no build pelo sharp (AVIF + WebP), não pelo Cloudflare Images.
  adapter: cloudflare({ imageService: 'compile' }),
  image: { layout: 'constrained' },
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
