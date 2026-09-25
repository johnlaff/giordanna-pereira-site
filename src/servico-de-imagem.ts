/**
 * O serviço de imagem do build: o sharp do próprio Astro, com um acréscimo só. O arquivo existe
 * por um detalhe do adapter da Cloudflare — com `imageService: 'compile'` ele só preserva
 * `image.service` quando o entrypoint não é o do Astro, e sem esse desvio a configuração do
 * serviço (o `effort` do AVIF, em `src/imagens.ts`) seria descartada.
 *
 * O acréscimo: um WebP pedido na `qualidadeSemPerda` sai sem perda. O Astro não tem como pedir
 * isso por imagem — a opção `lossless` do sharp só entra pela configuração do serviço, que vale
 * para todo WebP do site —, e é o que a prancha em alta precisa para as letras dela chegarem
 * nítidas ao zoom (ADR 0015).
 */
import type { LocalImageService } from 'astro';
import sharp from 'astro/assets/services/sharp';
import { qualidadeSemPerda } from './imagens.ts';

const servico: LocalImageService = {
  ...sharp,
  transform(entrada, opcoes, config, logger) {
    if (opcoes.format !== 'webp' || Number(opcoes.quality) !== qualidadeSemPerda)
      return sharp.transform(entrada, opcoes, config, logger);
    const doServico = config.service.config as { webp?: object };
    return sharp.transform(
      entrada,
      opcoes,
      {
        ...config,
        service: {
          ...config.service,
          config: { ...doServico, webp: { ...doServico.webp, lossless: true } },
        },
      },
      logger,
    );
  },
};

export default servico;
