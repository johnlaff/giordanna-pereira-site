import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { esquemaDeDepoimento, esquemaDeProjeto } from './content.schema';

const projetos = defineCollection({
  loader: glob({ base: './src/content/projetos', pattern: '**/*.yml' }),
  schema: ({ image }) => esquemaDeProjeto(image),
});

const depoimentos = defineCollection({
  loader: glob({ base: './src/content/depoimentos', pattern: '**/*.yml' }),
  schema: esquemaDeDepoimento(),
});

export const collections = { projetos, depoimentos };
