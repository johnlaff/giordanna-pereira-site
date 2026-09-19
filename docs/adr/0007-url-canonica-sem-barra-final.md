# URL canônica sem barra final

Cada página tem um endereço só, sem barra no fim: `/projetos/mini-casa`. Duas configurações sustentam essa forma e só valem juntas — `trailingSlash: 'never'` em `astro.config.ts` e `assets.html_handling: "drop-trailing-slash"` em `wrangler.jsonc`.

O Astro gera uma pasta por página, com um `index.html` dentro, e o endereço natural de uma pasta termina em barra. Por isso o padrão do Cloudflare (`auto-trailing-slash`) serve `/projetos/mini-casa/` e desvia quem pede `/projetos/mini-casa` — que é a forma de todo link do site. `drop-trailing-slash` inverte os dois papéis: a página é entregue na primeira requisição e a forma com barra é que desvia. `trailingSlash: 'never'` declara a mesma escolha do lado do Astro, e é de lá que o sitemap e a URL canônica de cada página tiram a forma que publicam.

A escolha é sem barra porque é a forma que o site já usa em todos os links, do cabeçalho à navegação entre Projetos: a alternativa exigiria reescrever cada `href` e lembrar da barra em todo link futuro, sem nada avisando quando alguém esquecesse.

## Consequences

- Um link interno chega à página na primeira requisição. Antes, toda navegação entre Projetos gastava uma ida e volta num `307` — e um `307` é temporário, então nem consolidava o endereço aos olhos do buscador.
- O desenvolvimento e a Produção passam a servir a mesma forma. Antes divergiam: o dev server responde `404` para a forma com barra, enquanto o Worker servia exatamente essa.
- O `wrangler dev` e o deploy leem o `dist/client/wrangler.json` que o adapter gera no build, não o `wrangler.jsonc` da raiz. Mudança em `html_handling` só vale depois de `pnpm build`.
- Quem tiver um endereço antigo com barra continua chegando à página, pelo desvio na direção contrária.
- `tests/e2e/urls.spec.ts` cobra a forma canônica de toda rota pública; uma rota nova entra na verificação pela lista de `tests/e2e/rotas.ts`.
