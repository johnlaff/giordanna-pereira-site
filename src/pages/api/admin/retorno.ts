/**
 * O segundo passo do login do CMS: o GitHub devolve a janela aqui, e o token segue para o CMS
 * (ADR 0014). O que ele faz está em `src/admin/autenticador.ts`.
 */
import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { concluirLogin } from '../../../admin/autenticador';

export const prerender = false;

export const GET: APIRoute = ({ request }) =>
  concluirLogin(request, {
    GITHUB_CLIENT_ID: getSecret('GITHUB_CLIENT_ID'),
    GITHUB_CLIENT_SECRET: getSecret('GITHUB_CLIENT_SECRET'),
  });
