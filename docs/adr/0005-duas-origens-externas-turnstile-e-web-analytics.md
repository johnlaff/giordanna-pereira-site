# Duas origens externas: Turnstile e o beacon do Cloudflare Web Analytics

O site não faz requisição a domínio de terceiros, com duas exceções, ambas da Cloudflare, que hospeda o site: o Turnstile no formulário de contato e o beacon do Web Analytics, carregado de `static.cloudflareinsights.com` por injeção automática na zona proxied. Fontes (Cormorant Garamond e Jost) são self-hosted pela Fonts API do Astro, o PhotoSwipe e todo JS são empacotados no build. A CSP é gerada pelo Astro (`security.csp`) com `script-src` listando os dois hosts e `connect-src 'self'` (com injeção automática, o beacon envia os dados para `/cdn-cgi/rum` na própria origem). HSTS, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy` completam os headers, verificados pelo MDN HTTP Observatory no CI.

## Consequences

- Sem chamada ao Google Fonts, o site não envia o IP do visitante a terceiros fora da Cloudflare, e o Web Analytics não usa cookies, então não há banner de consentimento.
- A CSP não usa `'strict-dynamic'`: essa fonte faz o navegador ignorar a lista de hosts em `script-src`, e o beacon injetado pela Cloudflare não recebe nonce nem hash do build, então seria bloqueado em silêncio e o painel ficaria vazio.
- Uma dependência que exija script ou fonte externa precisa de ADR próprio antes de entrar, porque abre a CSP.
- A verificação é executável: um teste inspeciona as requisições de rede de cada rota e falha em qualquer host fora do domínio do site, do Turnstile e de `static.cloudflareinsights.com`; zero erros de CSP no console e eventos chegando ao painel a partir do preview são critérios de aceite da esteira.
