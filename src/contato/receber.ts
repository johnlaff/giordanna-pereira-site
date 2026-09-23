/**
 * O que o Worker faz com um POST do formulário de contato, do pedido à resposta.
 *
 * Mora fora de `src/pages/api/contato.ts` para ser verificável sem o runtime da Cloudflare: o
 * endpoint só lê as variáveis do Worker e entrega o pedido aqui. O teste de unidade passa
 * serviços espiões no lugar dos reais e confere, além da resposta, que nada foi enviado.
 *
 * A ordem das defesas é a do custo, da mais barata à mais cara, e nenhuma fala com a rede
 * antes de as anteriores passarem:
 *
 * 1. sem as chaves, recusa sem ler nada (falha fechada, ver `modo.ts`);
 * 2. corpo que não é de formulário, ou acima do teto, recusa sem terminar de ler;
 * 3. isca preenchida ou campo inválido, recusa sem gastar o token do Turnstile, que é de uso
 *    único — um erro de campo não obriga o visitante a passar pelo desafio de novo;
 * 4. token recusado pelo Turnstile, recusa sem enviar;
 * 5. só então o e-mail sai pelo Resend.
 *
 * O rate limit não está aqui: é uma regra da zona na Cloudflare, que barra o excesso antes de o
 * Worker acordar (#14).
 */
import type { Modo } from './modo.ts';
import { emailDaMensagem, LIMITE_DO_CORPO, lerMensagem, type Campo } from './mensagem.ts';
import { servicosDe, type Servicos } from './servicos.ts';

/**
 * Por que um envio foi recusado. O formulário trata todos do mesmo jeito — mostra o e-mail
 * alternativo —, mas o motivo vai no corpo e no log para quem estiver investigando.
 */
export type Recusa =
  'indisponivel' | 'formato' | 'grande' | 'isca' | 'campos' | 'verificacao' | 'envio';

const resposta = (status: number, corpo: object): Response =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Cada envio é único: nem o navegador nem a Cloudflare podem guardar a resposta.
      'Cache-Control': 'no-store',
    },
  });

const recusa = (status: number, erro: Recusa, extra: { campos?: readonly Campo[] } = {}) => {
  // Só o motivo vai para o log do Worker, nunca o que o visitante escreveu.
  console.warn(`contato recusado: ${erro}`);
  return resposta(status, { ok: false, erro, ...extra });
};

/**
 * Lê o corpo até o teto e para ali. O `Content-Length` declarado basta para recusar cedo, mas
 * não para confiar: um corpo em partes não o declara, e um cliente pode declarar menos do que
 * manda. Por isso a contagem é feita no que de fato chega.
 */
const lerAteOTeto = async (pedido: Request, teto: number): Promise<string | undefined> => {
  const declarado = Number(pedido.headers.get('Content-Length'));
  if (declarado > teto) {
    // Avisa o runtime de que o resto não será lido, em vez de deixá-lo pendurado na conexão.
    await pedido.body?.cancel();
    return undefined;
  }
  if (pedido.body === null) return '';

  const leitor = pedido.body.getReader();
  const decodificador = new TextDecoder();
  let texto = '';
  let lidos = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) return texto + decodificador.decode();
    lidos += value.byteLength;
    if (lidos > teto) {
      await leitor.cancel();
      return undefined;
    }
    texto += decodificador.decode(value, { stream: true });
  }
};

export const receberContato = async (
  pedido: Request,
  modo: Modo,
  servicos: Servicos | undefined = servicosDe(modo),
): Promise<Response> => {
  if (modo.tipo === 'incompleto') {
    // O João lê isto no log do Worker (observability ligado no wrangler.jsonc): é o sinal de
    // que falta cadastrar uma chave no painel.
    console.error(`contato sem chave: falta ${modo.faltando.join(' e ')}`);
    return recusa(503, 'indisponivel');
  }
  // Com chave sempre há serviço; a guarda só existe para o TypeScript.
  if (servicos === undefined) return recusa(503, 'indisponivel');

  // O formulário manda o mesmo formato de um `<form>` comum; qualquer outro não veio dele.
  const tipo = pedido.headers.get('Content-Type') ?? '';
  if (!tipo.startsWith('application/x-www-form-urlencoded')) return recusa(415, 'formato');

  const corpo = await lerAteOTeto(pedido, LIMITE_DO_CORPO);
  if (corpo === undefined) return recusa(413, 'grande');

  const formulario = new URLSearchParams(corpo);
  const leitura = lerMensagem(formulario);
  if (!leitura.ok)
    return leitura.motivo === 'isca'
      ? recusa(400, 'isca')
      : recusa(400, 'campos', { campos: leitura.campos });

  const token = formulario.get('cf-turnstile-response') ?? '';
  const ip = pedido.headers.get('CF-Connecting-IP') ?? undefined;
  // Um serviço fora do ar ou lento demais não é motivo para derrubar o Worker: vira recusa, e o
  // visitante recebe o e-mail alternativo.
  const verificado = await servicos.verificar(token, ip).catch(() => false);
  if (!verificado) return recusa(403, 'verificacao');

  const enviado = await servicos
    .enviar(emailDaMensagem(leitura.mensagem, modo.enderecos))
    .catch(() => false);
  if (!enviado) return recusa(502, 'envio');

  return resposta(200, { ok: true });
};
