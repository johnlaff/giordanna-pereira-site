import cloudflare from '@astrojs/cloudflare';
import { defineConfig, envField, fontProviders } from 'astro/config';
import { servicoDeImagem } from './src/imagens.ts';

export default defineConfig({
  site: 'https://giordannapereira.arq.br',
  output: 'static',
  // Uma URL por página, sem barra final. Vale com o `html_handling` do wrangler.jsonc, que
  // faz o Worker servir a mesma forma; separados, o dev server recusaria o que a Produção
  // entrega. É daqui que o sitemap e as URLs de compartilhamento tiram a forma canônica.
  trailingSlash: 'never',
  // Todo link interno é pré-buscado, e não só os marcados: com a página de destino em cache,
  // a navegação fica instantânea sem roteador de cliente (ADR 0003). A estratégia é a padrão
  // do Astro — ao passar o mouse ou receber o foco —, que gasta rede só no link que o
  // visitante já escolheu. Um link para página que ainda não existe fica de fora, pelo
  // `data-astro-prefetch` que `src/rotas.ts` decide.
  prefetch: { prefetchAll: true },
  // Nada usa sessões; sem isto o adapter provisiona um namespace KV a cada deploy.
  session: false,
  // As variáveis que o site lê, e em que momento (ADR 0011). A chave de site do Turnstile é
  // pública e vai no HTML, por isso entra no build. As do Worker são lidas a cada pedido —
  // `access: 'secret'` é o que o Astro chama de "lida em runtime, nunca embutida no build", e
  // vale também para as que não são segredo: o modo de teste, em especial, não pode ficar
  // gravado num build. Todas são opcionais para o build passar sem elas; quem falha fechado na
  // falta de chave é o endpoint (`src/contato/ambiente.ts`).
  env: {
    schema: {
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      CONTATO_MODO: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CONTATO_DESTINO: envField.string({ context: 'server', access: 'secret', optional: true }),
      CONTATO_REMETENTE: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
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
