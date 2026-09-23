/**
 * Os dois serviços de fora que o formulário usa — o Turnstile, que diz se quem enviou é gente,
 * e o Resend, que entrega o e-mail —, e os dublês que ficam no lugar deles no modo de teste.
 *
 * O endpoint recebe um par pronto e não sabe qual dos dois tem na mão: quem escolhe é
 * `servicosDe`, a partir do Modo, e só o modo `teste` dá os dublês (ver `modo.ts`).
 */
import type { Email } from './mensagem.ts';
import type { Chaves, Modo } from './modo.ts';

export type Servicos = {
  /** O token do Turnstile vale? O IP do visitante vai junto, como a Cloudflare recomenda. */
  verificar: (token: string, ip: string | undefined) => Promise<boolean>;
  /** O e-mail foi aceito pelo serviço de envio? */
  enviar: (email: Email) => Promise<boolean>;
};

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND = 'https://api.resend.com/emails';

/** Quanto o Worker espera por um serviço de fora antes de desistir e mostrar a alternativa. */
const PRAZO_MS = 8000;

/**
 * O token que o dublê do Turnstile aceita. Com ele, e com o vazio — que é o que o navegador
 * manda quando o build não tem a chave de site e o widget não existe —, a verificação passa;
 * qualquer outro valor faz o papel de um token que o Turnstile recusou. É o que deixa exercitar
 * o formulário inteiro no navegador sem falar com a Cloudflare e, ainda assim, ter um caso de
 * token recusado para testar.
 */
export const TOKEN_DE_TESTE = 'teste-ok';

/**
 * O e-mail de visitante com que o dublê do Resend falha, fazendo o papel de um serviço fora do
 * ar. `.invalid` é reservado pela RFC 2606: nenhuma caixa real recebe nesse domínio.
 */
export const EMAIL_QUE_FALHA = 'falha@teste.invalid';

const dubles: Servicos = {
  verificar: async (token) => token === '' || token === TOKEN_DE_TESTE,
  enviar: async (email) => email.responderPara !== EMAIL_QUE_FALHA,
};

const reais = (chaves: Chaves): Servicos => ({
  verificar: async (token, ip) => {
    // Sem token não há o que perguntar: o widget não rodou, ou quem enviou nem abriu a página.
    if (token === '') return false;
    const corpo = new URLSearchParams({ secret: chaves.turnstile, response: token });
    if (ip !== undefined) corpo.set('remoteip', ip);
    const resposta = await fetch(SITEVERIFY, {
      method: 'POST',
      body: corpo,
      signal: AbortSignal.timeout(PRAZO_MS),
    });
    if (!resposta.ok) return false;
    const { success } = (await resposta.json()) as { success?: unknown };
    return success === true;
  },
  enviar: async (email) => {
    const resposta = await fetch(RESEND, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chaves.resend}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: email.de,
        to: [email.para],
        reply_to: email.responderPara,
        subject: email.assunto,
        text: email.texto,
      }),
      signal: AbortSignal.timeout(PRAZO_MS),
    });
    return resposta.ok;
  },
});

/** Os serviços do Modo, ou nada quando falta chave: sem serviço, sem envio. */
export const servicosDe = (modo: Modo): Servicos | undefined => {
  switch (modo.tipo) {
    case 'real':
      return reais(modo.chaves);
    case 'teste':
      return dubles;
    case 'incompleto':
      return undefined;
  }
};
