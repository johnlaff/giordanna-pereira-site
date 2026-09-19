import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { esquemaDeProjeto } from './content.schema';

const projetos = defineCollection({
  loader: glob({ base: './src/content/projetos', pattern: '**/*.yml' }),
  schema: ({ image }) => esquemaDeProjeto(image),
});

export const collections = { projetos };
