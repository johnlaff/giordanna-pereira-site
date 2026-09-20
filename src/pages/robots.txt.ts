import type { APIRoute } from 'astro';
import { robotsDe } from '../rotas';

export const GET: APIRoute = ({ site }) => {
  if (site === undefined) throw new Error('sem `site` em astro.config.ts, o robots não tem URL');
  return new Response(robotsDe(site), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
