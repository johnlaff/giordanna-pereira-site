/**
 * O Modo do formulário: se o Worker envia de verdade, com dublês ou não envia nada.
 *
 * A regra é falhar fechado. O envio de verdade só acontece com as duas chaves presentes —
 * a do Resend, que manda o e-mail, e a secreta do Turnstile, que separa gente de robô —, e
 * faltando qualquer uma o endpoint recusa tudo. O modo de teste, em que os dois serviços são
 * trocados por dublês, só existe quando a variável de modo diz `teste` com todas as letras;
 * a ausência de chave nunca liga o dublê. Se ligasse, um Worker publicado sem as chaves
 * aceitaria qualquer envio, de qualquer robô, e não entregaria nenhum.
 *
 * "Real" é o envio pelos serviços de verdade, em Produção ou numa versão de preview: o que
 * decide o Modo são as chaves, não o endereço.
 *
 * As variáveis vêm do painel da Cloudflare (Settings → Variables and Secrets do Worker), nunca
 * do repositório; o `astro.config.ts` declara cada uma e o ADR 0011 diz para que serve.
 */
import type { Enderecos } from './mensagem.ts';

/** O único valor da variável de modo que troca os serviços por dublês. */
export const MODO_DE_TESTE = 'teste';

/** Para onde vão as Mensagens quando `CONTATO_DESTINO` não diz outro endereço. */
export const DESTINO_PADRAO = 'contato@giordannapereira.arq.br';

/**
 * Quem assina o e-mail quando `CONTATO_REMETENTE` não diz outro. O Resend só envia em nome de
 * um domínio verificado nele, e o domínio do site é o que será verificado (#16).
 */
export const REMETENTE_PADRAO = 'Site Giordanna Pereira <site@giordannapereira.arq.br>';

/** As variáveis do Worker que o formulário lê, como o endpoint as recebe. */
export type Variaveis = {
  CONTATO_MODO?: string | undefined;
  RESEND_API_KEY?: string | undefined;
  TURNSTILE_SECRET_KEY?: string | undefined;
  CONTATO_DESTINO?: string | undefined;
  CONTATO_REMETENTE?: string | undefined;
};

/** As duas chaves que o envio real exige. */
export type Chaves = { resend: string; turnstile: string };

export type Modo =
  | { tipo: 'real'; chaves: Chaves; enderecos: Enderecos }
  | { tipo: 'teste'; enderecos: Enderecos }
  /** Falta chave: o endpoint recusa todo envio, e a lista diz ao log qual falta. */
  | { tipo: 'incompleto'; faltando: readonly (keyof Variaveis)[] };

/** Uma variável vazia ou só com espaço conta como ausente: é o que sobra de um campo apagado no painel. */
const valor = (texto: string | undefined): string | undefined => {
  const limpo = texto?.trim();
  return limpo === undefined || limpo === '' ? undefined : limpo;
};

export const lerModo = (variaveis: Variaveis): Modo => {
  const enderecos = {
    de: valor(variaveis.CONTATO_REMETENTE) ?? REMETENTE_PADRAO,
    para: valor(variaveis.CONTATO_DESTINO) ?? DESTINO_PADRAO,
  };

  if (valor(variaveis.CONTATO_MODO) === MODO_DE_TESTE) return { tipo: 'teste', enderecos };

  const resend = valor(variaveis.RESEND_API_KEY);
  const turnstile = valor(variaveis.TURNSTILE_SECRET_KEY);
  if (resend === undefined || turnstile === undefined) {
    const faltando: (keyof Variaveis)[] = [];
    if (resend === undefined) faltando.push('RESEND_API_KEY');
    if (turnstile === undefined) faltando.push('TURNSTILE_SECRET_KEY');
    return { tipo: 'incompleto', faltando };
  }

  return { tipo: 'real', chaves: { resend, turnstile }, enderecos };
};
