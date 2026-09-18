# giordanna-pereira-site

Portfólio de [Giordanna Pereira](https://giordannapereira.arq.br), arquiteta e urbanista em Uberlândia/MG. Site estático em [Astro](https://astro.build) hospedado em Cloudflare Workers, com um endpoint on-demand para o formulário de contato e Sveltia CMS em `/admin`.

## Requisitos

- Node 24 LTS (`.node-version`)
- pnpm 11 (`packageManager` no `package.json`; `corepack enable` resolve)

## Comandos

| Comando          | O que faz                                                                    |
| ---------------- | ---------------------------------------------------------------------------- |
| `pnpm install`   | instala as dependências pelo lockfile                                        |
| `pnpm dev`       | servidor de desenvolvimento do Astro                                         |
| `pnpm check`     | `astro check` (tipos) + ESLint + Prettier em modo verificação                |
| `pnpm format`    | Prettier em modo escrita                                                     |
| `pnpm build`     | build de produção em `dist/` (`dist/client/` são os assets estáticos)        |
| `pnpm preview`   | serve o build no runtime do Cloudflare (workerd)                             |
| `pnpm test`      | build → testes unitários (Node) → Playwright + axe contra o Worker local     |
| `pnpm test:unit` | só o runner de testes do Node (`tests/unit/**/*.test.ts`)                    |
| `pnpm test:e2e`  | só o Playwright; sobe `wrangler dev` sobre `dist/` sozinho                   |
| `pnpm test:ui`   | Playwright com interface, para depurar                                       |

## Estrutura

```
astro.config.ts        Astro 7: output static, adapter Cloudflare, Fonts API (Cormorant Garamond e Jost self-hosted)
wrangler.jsonc         Worker: assets em dist/, 404 servido pela página 404 do site
playwright.config.ts   projetos desktop (1440 px) e mobile (375 px); webServer = wrangler dev
src/
  config.ts            configuração tipada: nome do site, marca (nome + CAU), e-mail exibido e os quatro Contatos
  layouts/Base.astro   casca de toda página: head, fontes, cabeçalho, main e rodapé
  components/          Header, Footer, Marca (nome + CAU em texto), Icone
  styles/              tokens.css (cores, tipografia, espaçamento) e global.css (reset, scaffold de página)
  pages/               index e 404
public/                favicon, apple-touch-icon, imagens Open Graph em og/
tests/
  e2e/                 Playwright + axe em todas as rotas listadas em rotas.ts
  unit/                testes do Node (schema das collections e configuração)
docs/                  HANDOFF, ADRs, contexto de domínio (CONTEXT.md na raiz), referência visual e config dos agentes
```

## Testes

Dois seams:

1. **Página**: Playwright abre cada rota de `tests/e2e/rotas.ts` no site construído, servido por `wrangler dev` (o mesmo runtime de produção), e roda axe-core com as tags WCAG 2.2 AA e best-practice. Também afirma que nenhuma requisição sai do próprio domínio.
2. **Dados**: o runner de testes do Node valida a configuração tipada e, conforme as collections entram, fixtures do schema Zod.

## Regras

- Nenhum segredo no repositório: chaves ficam em variáveis do Worker.
- Nenhuma requisição a domínio externo além do Turnstile; fontes são baixadas no build e servidas de `/_astro/fonts/`.
- Toda correção vem com teste. Nada entra em `main` com `pnpm check` ou `pnpm test` vermelho.
- Decisões estruturais ficam em `docs/adr/`; vocabulário em `CONTEXT.md`.
