# giordanna-pereira-site

Portfólio de Giordanna Pereira (arquiteta e urbanista, Uberlândia/MG). Astro 7 + TypeScript, estático, hospedado em Cloudflare Workers (static assets), com um endpoint on-demand (`/api/contato`) e Sveltia CMS em `/admin`.

Leia primeiro: `docs/HANDOFF.md` (contexto, decisões, glossário, tickets). Depois `CONTEXT.md`, `docs/adr/` e `docs/esteira.md` (CI, deploy, rulesets, Renovate).

## Comandos

- `pnpm install` — Node 24 LTS, pnpm (lockfile commitado)
- `pnpm dev` — dev server
- `pnpm check` — `astro check` (tipos) + ESLint + Prettier (`pnpm format` corrige)
- `pnpm build` — build de produção em `dist/` (`dist/client/` são os assets estáticos)
- `pnpm test` — build → `pnpm test:unit` (runner do Node, `tests/unit/`) → `pnpm test:e2e` (Playwright + axe em todas as rotas de `tests/e2e/rotas.ts`, contra `dist/` servido por `wrangler dev`)
- `pnpm test:ui` — Playwright com interface, para depurar
- `pnpm lighthouse` — Lighthouse CI contra o Worker local, orçamento em `lighthouserc.yml` (LCP < 2,5 s, CLS < 0,1, acessibilidade 100)

## Regras do projeto

- Imagens em `src/assets/` são redimensionamentos determinísticos dos originais do Drive (sem retoque). Melhoria de renders por IA é possibilidade futura, não parte do fluxo atual.
- Em toda galeria: renders primeiro, pranchas por último. Capas e ordem dos projetos vêm do conteúdo, não do código.
- Conteúdo vive nas collections `projetos` e `depoimentos` em `src/content/`, como arquivos de dados com campos em pt-BR sem acento (tabelas em `CONTEXT.md`); `descricao` é texto simples e nenhum campo aceita HTML. Imagens em `src/assets/` (WebP ≤ 2560 px). O schema Zod é a verdade: build quebra se faltar campo, imagem ou se `ordem` repetir.
- Sem requisição a domínio externo além do Turnstile (fontes self-hosted pela Fonts API). CSP gerada pelo Astro (`security.csp`).
- Sem segredos no repo: chaves do Resend, Turnstile e do autenticador do Sveltia ficam em variáveis do Worker.
- Toda correção vem com teste. Nada entra em `main` com Playwright/axe vermelho. Acessibilidade alvo: WCAG 2.2 AA.
- Sem dependência ou serviço pago sem ADR.

## Estrutura

- `astro.config.ts` — `output: 'static'`, adapter Cloudflare (`imageService: 'compile'`), Fonts API; `wrangler.jsonc` — assets em `dist/`, `not_found_handling: 404-page`
- `src/config.ts` — configuração tipada fora do CMS: `site`, `marca` (nome + CAU), `emailExibido` (constante única do e-mail) e `contatos`
- `src/layouts/Base.astro` — casca de toda página (head, fontes, Header, `main`, Footer); props `titulo`, `descricao`, `secao` (item ativo da nav) e `hero` (cabeçalho transparente sobre o hero)
- `src/pages/` — `index`, `404`, `projetos/[slug]`. Planejadas: `projetos/index`, `contato`, `api/contato.ts` (`prerender = false`)
- `src/content/` — collection `projetos` (um `.yml` por Projeto); planejada: `depoimentos`. `src/content.config.ts` liga o loader ao contrato de `src/content.schema.ts`, que também garante a Ordem única
- `src/components/` — Header, Footer, Marca, Icone, Ficha, Galeria. Planejados: Hero, Sobre, Ferramentas, Depoimentos (carrossel), CardProjeto, e o layout justificado + PhotoSwipe na Galeria, FormContato
- `src/styles/` — `tokens.css` (cores, tipografia, espaçamento) e `global.css` (reset, scaffold de página)
- `public/og/` — imagens Open Graph. Planejado: `public/admin/` — Sveltia CMS (`index.html`, `config.yml`)
- `tests/e2e/` — Playwright + axe (rotas em `rotas.ts`); `tests/unit/` — runner do Node; `docs/` — HANDOFF, ADRs, `esteira.md`, `agents/` (config do tracker), `reference/` (preview)
- `.github/workflows/ci.yml` — jobs `check`, `build`, `e2e`, `lighthouse`, `audit` (nomes = checks exigidos pelo ruleset); `.github/actions/setup` — action composta; `.github/rulesets/` — fonte dos rulesets de `main`, aplicados via `gh api`; `renovate.json`; `scripts/lighthouse.ts`

## Fluxo de trabalho

Trunk-based com PRs curtos (um ticket por PR). Cada PR ganha os cinco checks do CI e uma preview URL do Workers Builds; `main` exige PR com checks verdes (bypass só para o papel write, que é o do CMS) e nunca aceita force push. Merge por squash em `main` publica. Actions fixadas por SHA; toda rota nova entra em `tests/e2e/rotas.ts` e em `lighthouserc.yml`. Tickets são sub-issues da spec #3 com "blocked by" nativo; trabalhe a fronteira (tickets sem bloqueador aberto), um ticket por PR. Use `/handoff` ao encerrar uma sessão.

## Referência visual

`docs/reference/site-final.html` é o preview aprovado; abra no navegador e compare rota a rota em 1440/1024/768/375 px. Diferenças aceitas: URLs reais em vez de hash, fontes self-hosted, View Transitions nativas.

## Agent skills

### Issue tracker

Issues vivem como GitHub Issues em `johnlaff/giordanna-pereira-site`, operadas via CLI `gh`. Veja `docs/agents/issue-tracker.md`.

### Triage labels

Vocabulário padrão: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Veja `docs/agents/triage-labels.md`.

### Domain docs

Single-context: um `CONTEXT.md` na raiz e ADRs em `docs/adr/`. Veja `docs/agents/domain.md`.
