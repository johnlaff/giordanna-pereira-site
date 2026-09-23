# Formulário de contato: falha fechado, modo de teste explícito e variáveis lidas em runtime

O formulário posta para `/api/contato`, a única rota que o Worker executa a cada pedido
(`prerender = false`). O que o endpoint faz está em `src/contato/`: `mensagem.ts` tem as
regras de cada campo, usadas também pelo navegador; `modo.ts` lê as variáveis do Worker;
`servicos.ts` fala com o Turnstile e o Resend; e `receber.ts` põe as defesas em ordem de custo —
chaves, tamanho do corpo, isca e campos, Turnstile — antes de enviar. O `security.checkOrigin`
do Astro, ligado por padrão, barra com 403 o POST de formulário que vem de outro site antes de
o endpoint rodar.

**Falha fechado.** Sem a chave do Resend ou a secreta do Turnstile, o endpoint responde 503 a
qualquer envio e o formulário mostra o e-mail alternativo (`emailExibido`, de `src/config.ts`).
O log do Worker diz qual chave falta. Um Worker publicado sem chaves nunca aceita um envio que
não vai entregar, nem deixa um robô passar.

**Modo de teste explícito.** Os dublês do Turnstile e do Resend só entram quando
`CONTATO_MODO` vale exatamente `teste`; a ausência de chave nunca os liga. É o que deixa o
Playwright exercitar o formulário inteiro sem falar com a Cloudflare: a suíte sobe um Worker
comum, sem chaves, onde o envio tem de falhar fechado, e outro com `--var CONTATO_MODO:teste`.
O dublê do Turnstile aceita o token vazio (o que o navegador manda quando o build não tem chave
de site) e `teste-ok`, e recusa qualquer outro; o do Resend falha só para o e-mail
`falha@teste.invalid`.

**Variáveis declaradas no `astro.config.ts` (`env.schema`).** A chave de site do Turnstile é
pública, vai no HTML e por isso é lida no build (`PUBLIC_TURNSTILE_SITE_KEY`). As outras são
lidas pelo Worker a cada pedido, com `getSecret` — no vocabulário do Astro, `access: 'secret'`
significa "lida em runtime, nunca embutida no build", o que vale também para as que não são
segredo: o modo de teste, em especial, não pode ficar gravado num build. Todas são opcionais
para o build passar sem elas.

## O que o João precisa criar

No painel da Cloudflare, Workers & Pages → `giordanna-pereira-site`:

| Onde                                          | Nome                        | Tipo     | Valor                                                                                               |
| --------------------------------------------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| Settings → Variables and Secrets              | `RESEND_API_KEY`            | Secret   | API key do Resend, com permissão de envio só no domínio do site                                     |
| Settings → Variables and Secrets              | `TURNSTILE_SECRET_KEY`      | Secret   | Secret key do widget do Turnstile                                                                   |
| Settings → Build → Variables and Secrets      | `PUBLIC_TURNSTILE_SITE_KEY` | Variável | Site key do mesmo widget (pública; entra no HTML no build)                                          |
| Settings → Variables and Secrets (opcional)   | `CONTATO_DESTINO`           | Variável | Para onde vão as mensagens. Padrão: `contato@giordannapereira.arq.br`                                |
| Settings → Variables and Secrets (opcional)   | `CONTATO_REMETENTE`         | Variável | Quem assina o e-mail. Padrão: `Site Giordanna Pereira <site@giordannapereira.arq.br>`                |

- O widget do Turnstile (painel da Cloudflare → Turnstile) é criado com o domínio de
  Produção e o subdomínio `workers.dev` da conta, que cobre as URLs de preview do Workers
  Builds, no modo **Managed**: o site o renderiza com `data-appearance="interaction-only"`,
  então ele só aparece quando o Turnstile pede um clique, e a página fica igual ao Preview.
- O Resend só envia em nome de um domínio verificado nele. Até o domínio existir (#16), o
  envio real em preview pede `CONTATO_REMETENTE` com um remetente de domínio já verificado, ou
  o `onboarding@resend.dev` de teste do Resend (que só entrega na caixa da conta do Resend) e
  `CONTATO_DESTINO` apontando para essa caixa.
- `CONTATO_MODO` **nunca** é criada em Produção nem em preview. Ela existe só para a suíte.
- Depois de criar as chaves, o critério de aceite que fica com o João: um envio real pela URL
  de preview, conferindo que o e-mail chega com `reply-to` do visitante.

## Consequences

- Sem as chaves, o site em Produção mostra o formulário e responde com a alternativa por
  e-mail. É o estado do site até o João cadastrá-las, e é o comportamento desejado, não um
  defeito.
- O Turnstile só carrega onde há chave de site no build. A suíte roda sem ela, e o teste de
  rede segue proibindo qualquer host externo; a CSP que lista `challenges.cloudflare.com` entra
  em #14 (ADR 0005).
- O teto do corpo é de 16 KB. O Worker responde 413 sem ler o resto, como deve; o proxy do
  `wrangler dev` derruba com 500 outro pedido que esteja passando por ele nessa hora, então o
  teste do teto roda num terceiro Worker, só dele (`tests/e2e/modo-de-teste.ts`). Em Produção
  esse proxy não existe.
- O rate limit não é do Worker: é uma regra da zona, em #14.
