# HTTP Observatory no e2e, contra o Worker local em HTTPS

A nota do MDN HTTP Observatory (critério do #14: A ou mais) é conferida pela suíte de e2e, com o
scanner oficial da MDN (`@mdn/mdn-http-observatory`, dependência de desenvolvimento, versão
fixa) rodando sobre cada rota pública do `dist/`, servido por um `wrangler dev` em HTTPS. Não
há job novo no CI: a varredura é um teste do Playwright (`tests/e2e/observatorio.spec.ts`), e
o job `e2e` já é um check exigido pelo ruleset de `main`.

Por que o scanner da MDN, e não a API pública do Observatory: a API só varre host público, e o
que um PR muda só existe publicado na URL de preview do Workers Builds, que sai de outra esteira
e em outro tempo. O pacote é o mesmo código que dá a nota no site da MDN, algoritmo e tabela de
pontos inclusos, e roda sem rede. Uma reimplementação dos testes seria mais leve e mediria outra
coisa.

Por que HTTPS: o Observatory só avalia o HSTS numa resposta vinda por TLS, e confia no
certificado. O Worker da varredura sobe com um certificado de `127.0.0.1` feito na hora pelo
`openssl` (`tests/e2e/observatorio.ts`), passado ao scanner em `NODE_EXTRA_CA_CERTS`. O host é o
IP porque o scanner recusa nome sem ponto, como `localhost`.

## Consequences

- O redirecionamento de `http://` para `https://` não é medido aqui. O Worker local não escuta
  em HTTP, e o scanner o dá por desnecessário (sem desconto). Em Produção quem responde no
  `http://` é a Cloudflare: no domínio, a opção **Always Use HTTPS** da zona, que é passo do
  João em #16. O `workers.dev` não redireciona, e por isso a nota dele no site da MDN fica
  abaixo da do domínio.
- A 404 fica de fora: o Observatory só varre página que responde 2xx ou 3xx. Os headers dela
  são cobrados em `tests/e2e/seguranca.spec.ts`, como os de toda rota.
- O pacote traz Fastify, Postgres e Sentry, que o scanner não usa. É peso de instalação, só em
  desenvolvimento, e a revisão de dependências do CI olha para ele como para qualquer outra.
  Os scripts de instalação dele e de duas dependências ficam barrados no `pnpm-workspace.yaml`,
  porque baixam listas da internet a cada `pnpm install`; a única de que o scanner precisa, a
  de HSTS preload do Chromium, é irrelevante para `127.0.0.1` e o teste a cria vazia.
- Quando o Renovate subir o pacote, o algoritmo de nota pode mudar junto (`algorithmVersion`).
  A barra do teste é a do ticket: nenhum item com desconto e nota de pelo menos 90 pontos (A).
