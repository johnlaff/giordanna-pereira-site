# Site estático Astro em Cloudflare Workers, com um único endpoint on-demand

O site é um portfólio com dez projetos, uma página de contato e um CMS; o conteúdo muda poucas vezes por mês e o único comportamento dinâmico é receber o formulário. Escolhemos Astro com `output: 'static'` e o adapter `@astrojs/cloudflare`, hospedado em Cloudflare Workers com static assets (não Pages), com `/api/contato` como a única rota on-demand. Workers é o produto que a Cloudflare consolida como destino de sites estáticos, o mesmo Worker recebe o formulário sem um segundo serviço, e Workers Builds entrega deploy por push em `main` e preview URL por PR sem CI de deploy próprio.

## Considered Options

- **Cloudflare Pages**: mesma DX, mas produto em manutenção; a Cloudflare direciona sites novos para Workers.
- **Netlify / Vercel**: exigiriam um segundo provedor para Turnstile, Email Routing e DNS, que já ficam na Cloudflare.
- **Astro em modo server ou híbrido**: sem ganho para páginas que só mudam via CMS, e perde o cache integral de HTML estático.
