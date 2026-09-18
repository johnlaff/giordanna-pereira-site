# giordanna-pereira-site

Portfólio de Giordanna Pereira (arquiteta e urbanista, Uberlândia/MG). Astro 7 + TypeScript, estático, hospedado em Cloudflare Workers (static assets), com um endpoint on-demand (`/api/contato`) e Sveltia CMS em `/admin`.

Leia primeiro: `docs/HANDOFF.md` (contexto, decisões, glossário, tickets). Depois `CONTEXT.md` e `docs/adr/`.

## Comandos

- `pnpm install` — Node 24 LTS, pnpm (lockfile commitado)
- `pnpm dev` — dev server
- `pnpm check` — `astro check` (tipos) + lint + format check
- `pnpm build` — build de produção em `dist/`
- `pnpm test` — Playwright (nível de página) + axe em todas as rotas, contra `dist/` servido localmente
- `pnpm test:ui` — Playwright com interface, para depurar

## Regras do projeto

- Imagens em `src/assets/` são redimensionamentos determinísticos dos originais do Drive (sem retoque). Melhoria de renders por IA é possibilidade futura, não parte do fluxo atual.
- Em toda galeria: renders primeiro, pranchas por último. Capas e ordem dos projetos vêm do conteúdo, não do código.
- Conteúdo vive em `src/content/projetos/*.md` + `src/content/depoimentos/`; imagens em `src/assets/` (WebP ≤ 2560 px). O schema Zod é a verdade: build quebra se faltar campo ou imagem.
- Sem requisição a domínio externo além do Turnstile (fontes self-hosted pela Fonts API). CSP gerada pelo Astro (`security.csp`).
- Sem segredos no repo: chaves do Resend, Turnstile e do autenticador do Sveltia ficam em variáveis do Worker.
- Toda correção vem com teste. Nada entra em `main` com Playwright/axe vermelho. Acessibilidade alvo: WCAG 2.2 AA.
- Sem dependência ou serviço pago sem ADR.

## Estrutura

- `src/pages/` — `index`, `projetos/index`, `projetos/[slug]`, `contato`, `404`, `api/contato.ts` (`prerender = false`)
- `src/content/` — collections `projetos` e `depoimentos` (schema em `src/content.config.ts`)
- `src/components/` — Header, Footer, Hero, Sobre, Ferramentas, Depoimentos (carrossel), CardProjeto, Galeria (justificada + PhotoSwipe), Ficha, FormContato
- `src/styles/` — tokens (cores, tipografia, espaçamento) e global
- `public/admin/` — Sveltia CMS (`index.html`, `config.yml`); `public/og/` — imagens Open Graph
- `tests/` — Playwright + axe; `docs/` — HANDOFF, ADRs, `agents/` (config do tracker)

## Fluxo de trabalho

Trunk-based com PRs curtos (um ticket por PR). Cada PR ganha checks (check, build, Playwright, axe, Lighthouse) e uma preview URL do Workers Builds. Merge em `main` publica. Tickets são issues do GitHub ligadas à spec (sub-issues + "blocked by"); trabalhe a fronteira (tickets sem bloqueador aberto). Use `/handoff` ao encerrar uma sessão.

## Referência visual

`docs/reference/site-final.html` é o preview aprovado; abra no navegador e compare rota a rota em 1440/1024/768/375 px. Diferenças aceitas: URLs reais em vez de hash, fontes self-hosted, View Transitions nativas.

## Agent skills

### Issue tracker

Issues vivem como GitHub Issues em `johnlaff/giordanna-pereira-site`, operadas via CLI `gh`. Veja `docs/agents/issue-tracker.md`.

### Triage labels

Vocabulário padrão: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Veja `docs/agents/triage-labels.md`.

### Domain docs

Single-context: um `CONTEXT.md` na raiz e ADRs em `docs/adr/`. Veja `docs/agents/domain.md`.
