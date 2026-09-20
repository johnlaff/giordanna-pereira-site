/**
 * O serviço de imagem do build: o sharp do próprio Astro, republicado daqui sem mudar nada.
 * O arquivo existe por um detalhe do adapter da Cloudflare — com `imageService: 'compile'`
 * ele só preserva `image.service` quando o entrypoint não é o do Astro, e sem esse desvio a
 * configuração do serviço (o `effort` do AVIF, em `src/imagens.ts`) seria descartada.
 */
export { default } from 'astro/assets/services/sharp';
