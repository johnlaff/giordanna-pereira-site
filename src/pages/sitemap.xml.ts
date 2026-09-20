import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { ordenarProjetos } from '../content.schema';
import { rotasPublicas, sitemapDe } from '../rotas';

export const GET: APIRoute = async ({ site }) => {
  if (site === undefined) throw new Error('sem `site` em astro.config.ts, o sitemap não tem URL');
  const projetos = ordenarProjetos(await getCollection('projetos'));
  const xml = sitemapDe(rotasPublicas(projetos.map((projeto) => projeto.id)), site);
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
