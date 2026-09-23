/**
 * O endpoint do formulário de contato: a única rota que não sai pronta do build (ADR 0001). O
 * Worker a executa a cada POST; o que ela faz está em `src/contato/receber.ts`, e daqui só sai
 * a leitura das variáveis, que precisa do runtime.
 */
import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { lerModo } from '../../contato/modo';
import { receberContato } from '../../contato/receber';

export const prerender = false;

// As variáveis são lidas a cada pedido, e não uma vez ao carregar o módulo: trocar uma chave
// no painel da Cloudflare vale a partir do envio seguinte, sem esperar o Worker reciclar.
export const POST: APIRoute = ({ request }) =>
  receberContato(
    request,
    lerModo({
      CONTATO_MODO: getSecret('CONTATO_MODO'),
      RESEND_API_KEY: getSecret('RESEND_API_KEY'),
      TURNSTILE_SECRET_KEY: getSecret('TURNSTILE_SECRET_KEY'),
      CONTATO_DESTINO: getSecret('CONTATO_DESTINO'),
      CONTATO_REMETENTE: getSecret('CONTATO_REMETENTE'),
    }),
  );
