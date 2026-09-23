/**
 * Os Workers em que o formulário roda com dublês no lugar do Turnstile e do Resend (ADR 0011).
 * Sobem junto com a suíte, pelo `playwright.config.ts`; 8787 é o Worker sem chaves e 8788 é o
 * do Lighthouse (`lighthouserc.yml`).
 */
export const portaDoModoDeTeste = 8789;
export const urlDoModoDeTeste = `http://localhost:${portaDoModoDeTeste}`;

/**
 * Um segundo Worker no modo de teste, só para o envio acima do teto. O Worker responde 413 sem
 * ler o resto do corpo, como deve; o proxy do `wrangler dev` — que não existe em Produção — não
 * lida bem com isso e derruba com 500 outro pedido que esteja passando por ele ao mesmo tempo.
 * Isolado aqui, o teste do teto não tem com quem colidir.
 */
export const portaDoTeto = 8790;
export const urlDoTeto = `http://localhost:${portaDoTeto}`;
