/**
 * O endpoint do formulário de contato: a única rota que não sai pronta do build (ADR 0001). O
 * Worker a executa a cada POST; o que ela faz está em `src/contato/receber.ts`, e daqui só sai
 * a leitura das variáveis, que precisa do runtime.
 */
import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { env } from 'cloudflare:workers';
import { lerModo } from '../../contato/modo';
import { receberContato } from '../../contato/receber';

export const prerender = false;

// As variáveis são lidas a cada pedido, e não uma vez ao carregar o módulo: trocar uma chave
// no painel da Cloudflare vale a partir do envio seguinte, sem esperar o Worker reciclar.
export const POST: APIRoute = ({ request }) => {
  const modo = lerModo({
    CONTATO_MODO: getSecret('CONTATO_MODO'),
    RESEND_API_KEY: getSecret('RESEND_API_KEY'),
    TURNSTILE_SECRET_KEY: getSecret('TURNSTILE_SECRET_KEY'),
    CONTATO_DESTINO: getSecret('CONTATO_DESTINO'),
    CONTATO_REMETENTE: getSecret('CONTATO_REMETENTE'),
  });
  // Cada pedido vira um ponto no Analytics Engine (ADR 0017): o desfecho e o Modo, para que
  // os envios do modo de teste, nas versões de preview, não se misturem aos de verdade.
  return receberContato(request, modo, undefined, (desfecho) =>
    env.CONTATO_ENVIOS?.writeDataPoint({ blobs: [desfecho, modo.tipo], indexes: ['contato'] }),
  );
};
