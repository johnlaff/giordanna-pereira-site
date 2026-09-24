import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import {
  esquemaDeDepoimento,
  esquemaDeFamiliaridade,
  esquemaDeProjeto,
  esquemaDeSobre,
} from './content.schema';

const projetos = defineCollection({
  loader: glob({ base: './src/content/projetos', pattern: '**/*.yml' }),
  schema: ({ image }) => esquemaDeProjeto(image),
});

const depoimentos = defineCollection({
  loader: glob({ base: './src/content/depoimentos', pattern: '**/*.yml' }),
  schema: esquemaDeDepoimento(),
});

/**
 * Os dois blocos da home que Giordanna edita no CMS. Cada um é um arquivo só em
 * `src/content/home/`, lido como uma collection de uma entrada: `lerDaHome` quebra o build se
 * ele não existir.
 */
const sobre = defineCollection({
  loader: glob({ base: './src/content/home', pattern: 'sobre.yml' }),
  schema: esquemaDeSobre(),
});

const familiaridade = defineCollection({
  loader: glob({ base: './src/content/home', pattern: 'familiaridade.yml' }),
  schema: esquemaDeFamiliaridade(),
});

export const collections = { projetos, depoimentos, sobre, familiaridade };
