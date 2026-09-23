/**
 * O primeiro passo do login do CMS: leva a janela de login ao GitHub (ADR 0014). O que ele faz
 * está em `src/admin/autenticador.ts`; daqui só sai a leitura das variáveis, que precisa do
 * runtime.
 */
import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { iniciarLogin } from '../../../admin/autenticador';

export const prerender = false;

export const GET: APIRoute = ({ request }) =>
  iniciarLogin(request, {
    GITHUB_CLIENT_ID: getSecret('GITHUB_CLIENT_ID'),
    GITHUB_CLIENT_SECRET: getSecret('GITHUB_CLIENT_SECRET'),
  });
