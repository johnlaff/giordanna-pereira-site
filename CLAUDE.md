# giordanna-pereira-site

Portfólio de Giordanna Pereira (arquiteta e urbanista, Uberlândia/MG). Astro 7 + TypeScript, estático, hospedado em Cloudflare Workers (static assets), com rotas on-demand (`/api/contato` e o login do CMS em `/api/admin/*`) e Sveltia CMS em `/admin`.

Leia primeiro: `docs/HANDOFF.md` (contexto, decisões, glossário, tickets). Depois `CONTEXT.md`, `docs/adr/` e `docs/esteira.md` (CI, deploy, rulesets, Renovate).

## Comandos

- `pnpm install` — Node 24 LTS, pnpm (lockfile commitado)
- `pnpm dev` — dev server
- `pnpm check` — `astro check` (tipos) + ESLint + Prettier (`pnpm format` corrige)
- `pnpm build` — build de produção em `dist/` (`dist/client/` são os assets estáticos)
- `pnpm test` — build → `pnpm test:unit` (runner do Node, `tests/unit/`) → `pnpm test:e2e` (Playwright + axe em todas as rotas de `tests/e2e/rotas.ts`, contra `dist/` servido por `wrangler dev`, e o MDN HTTP Observatory contra um Worker local em HTTPS; precisa do `openssl`)
- `pnpm test:ui` — Playwright com interface, para depurar
- `pnpm lighthouse` — Lighthouse CI contra o Worker local, orçamento em `lighthouserc.yml` (LCP < 2,5 s, CLS < 0,1, acessibilidade 100)

## Regras do projeto

- Imagens em `src/assets/` são redimensionamentos determinísticos dos originais do Drive (sem retoque). Melhoria de renders por IA é possibilidade futura, não parte do fluxo atual.
- Em toda galeria: renders primeiro, pranchas por último. Capas e ordem dos projetos vêm do conteúdo, não do código.
- Conteúdo vive nas collections `projetos`, `depoimentos`, `sobre` e `familiaridade` em `src/content/` (as duas últimas são um arquivo cada em `src/content/home/`), como arquivos de dados com campos em pt-BR sem acento (tabelas em `CONTEXT.md`); `descricao` é texto simples e nenhum campo aceita HTML. Imagens em `src/assets/` (WebP ≤ 7680 px; o site serve variantes até 2560 px, e só o zoom pede a imagem inteira, sem perda, ADR 0015). O schema Zod é a verdade: build quebra se faltar campo, imagem ou se `ordem` repetir.
- Sem requisição a domínio externo além do Turnstile e do beacon do Web Analytics (fontes self-hosted pela Fonts API). CSP gerada pelo Astro (`security.csp`), sem `style` nem script inline escrito à mão; os outros headers de segurança em `public/_headers` (ADR 0005). Observatory A ou mais em toda rota pública (ADR 0013). A exceção é o CMS, que não é do público: `/admin` tem CSP própria, mais larga, e a janela de login é uma resposta do Worker que libera só o próprio script, pelo hash (ADR 0014).
- Sem segredos no repo: chaves do Resend, Turnstile e do autenticador do Sveltia ficam em variáveis do Worker.
- Toda correção vem com teste. Nada entra em `main` com Playwright/axe vermelho. Acessibilidade alvo: WCAG 2.2 AA.
- Todo movimento novo (animação, transição, carrossel, lightbox, View Transitions) entra com o seu bloco `@media (prefers-reduced-motion: reduce)`, espelhando o preview.
- Sem dependência ou serviço pago sem ADR.

## Estrutura

- `astro.config.ts` — `output: 'static'`, adapter Cloudflare (`imageService: 'compile'`), Fonts API; `wrangler.jsonc` — assets em `dist/`, `not_found_handling: 404-page`, `run_worker_first: ["/api/*"]` (sem ele, uma navegação a uma rota da API recebe a 404 estática)
- `src/imagens.ts` — o que decide as variantes de imagem (qualidade e esforço do AVIF), e `src/servico-de-imagem.ts`, o serviço que as grava; os dois estão na chave do cache de imagens do CI
- `src/config.ts` — configuração tipada fora do CMS: `site`, `marca` (nome + CAU), `emailExibido` (constante única do e-mail), `contatos` e os textos das páginas (`hero`, `cta`, `projetos` e a moldura de `sobre` e `familiaridade`, cujo conteúdo vem do CMS)
- `src/layouts/Base.astro` — casca de toda página (head, fontes, Header, `main`, Footer); props `titulo`, `descricao`, `secao` (item ativo da nav) e `hero` (cabeçalho transparente sobre o hero)
- `src/pages/` — `index`, `404`, `projetos/index` (a Grade), `projetos/[slug]`, `contato`, os endpoints `sitemap.xml` e `robots.txt`, que servem o que sai de `src/rotas.ts` (as rotas públicas do site), `admin.astro` (o Sveltia CMS, com CSP própria mais larga, ADR 0014) e as rotas que o Worker executa (`prerender = false`): `api/contato.ts` e `api/admin/entrar.ts` e `retorno.ts`, o login do CMS
- `src/contato/` — o formulário de contato do lado do Worker: `mensagem.ts` (regras dos campos, usadas também pelo navegador), `modo.ts` (variáveis do Worker, falha fechada), `servicos.ts` (Turnstile, Resend e os dublês do modo de teste), `receber.ts` (as defesas em ordem, do pedido à resposta). Variáveis declaradas no `env.schema` do `astro.config.ts`; o que o João cadastra na Cloudflare está no ADR 0011
- `src/content/` — collections `projetos` (um `.yml` por Projeto) e `depoimentos` (um `.yml` por Depoimento, com prefixo numérico no nome: a sequência do carrossel é a do nome do arquivo); `home/` guarda `sobre.yml` e `familiaridade.yml`, lidos por `src/home.ts`, que quebra o build se faltar um; `src/tipografia.ts` prende a última palavra de cada parágrafo do Sobre, que ela não teria como fazer pelo celular. `src/content.config.ts` liga o loader ao contrato de `src/content.schema.ts`, que também garante a Ordem única
- `src/components/` — Header, Footer, Marca, Icone, Ficha, Galeria (linhas justificadas em `galeria.linhas.ts` e lightbox PhotoSwipe), EmBreve, Hero, Sobre, Ferramentas, Depoimentos (carrossel infinito por cópias nas duas pontas), CTA, CardProjeto (larguras e `sizes` da grade em `grade.ts`), Revelar (entrada dos blocos `.rv`, só na página que os tem), FormContato
- `src/styles/` — `tokens.css` (cores, tipografia, espaçamento) e `global.css` (reset, scaffold de página, transição nativa entre páginas)
- `src/compartilhamento/` — o que se lê de um link compartilhado: os Cartões de compartilhamento (`og:image` 1200×630, um por rota pública, em `cartoes.ts`), desenhados no fim do build pelo sharp (`desenho.ts`, com as fontes em `fontes/`) e gravados em `og/` pela integração de `integracao.ts` (ADR 0012), e o JSON-LD `Person` da home e `CreativeWork` de cada Projeto (`dados-estruturados.ts`). As tags Open Graph ficam no `Base.astro`, que recebe `rota` e `dadosEstruturados` de cada página
- `src/admin/` — o CMS: `configuracao.ts` (a configuração do Sveltia em TypeScript, com os padrões de campo de `src/content.schema.ts`; um teste de unidade confere que ela e o schema dizem a mesma coisa) e `autenticador.ts` (o login pelo GitHub, com `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` do Worker; o que o João cadastra está em `docs/esteira.md`)
- `public/_headers` — HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy` de toda resposta estática; o adapter soma a ele o cache imutável de `/_astro/*`. As respostas do Worker levam os mesmos, de `src/headers-de-seguranca.ts`
- `tests/schema-org.ts` — validador de JSON-LD contra o vocabulário do schema.org, usado nos testes de unidade e no e2e
- `tests/e2e/` — Playwright + axe (rotas em `rotas.ts`; o formulário roda também contra Workers no modo de teste, em `modo-de-teste.ts`; CSP, headers e as duas origens da Cloudflare em `seguranca.spec.ts`; o Observatory num Worker em HTTPS, em `observatorio.ts`; o CMS em `admin.spec.ts`, que cadastra um Projeto pelo "Trabalhar com Repositório Local" do Sveltia sobre uma pasta do OPFS); `tests/unit/` — runner do Node; `docs/` — HANDOFF, ADRs, `esteira.md`, `agents/` (config do tracker), `reference/` (preview)
- `.github/workflows/ci.yml` — jobs `check`, `build`, `e2e`, `lighthouse`, `audit` (nomes = checks exigidos pelo ruleset); `.github/actions/setup` — action composta; `.github/rulesets/` — fonte dos rulesets de `main`, aplicados via `gh api`; `renovate.json`; `scripts/lighthouse.ts`
- `.claude/hooks/session-start.sh` — gancho de SessionStart que prepara o container das sessões do Claude Code na web (Node da `.node-version` pelo nvm, dependências e o Chromium da versão do Playwright); não roda fora do ambiente remoto

## Fluxo de trabalho

Trunk-based com PRs curtos (um ticket por PR). Cada PR ganha os cinco checks do CI e uma preview URL do Workers Builds; `main` exige PR com checks verdes (bypass só para o papel write, que é o do CMS) e nunca aceita force push. Merge por squash em `main` publica. Actions fixadas por SHA. As rotas da suíte saem de `tests/e2e/rotas.ts` — as páginas de Projeto vêm da própria collection, e uma rota nova de outro tipo entra ali à mão; o `lighthouserc.yml` mede uma rota por padrão de página, no pior caso de cada um. Tickets são sub-issues da spec #3 com "blocked by" nativo; trabalhe a fronteira (tickets sem bloqueador aberto), um ticket por PR. Use `/handoff` ao encerrar uma sessão.

## Referência visual

`docs/reference/site-final.html` é o preview aprovado; abra no navegador e compare rota a rota em 1440/1024/768/375 px. Diferenças aceitas: URLs reais em vez de hash, fontes self-hosted, View Transitions nativas.

## Agent skills

### Issue tracker

Issues vivem como GitHub Issues em `johnlaff/giordanna-pereira-site`, operadas via CLI `gh`. Veja `docs/agents/issue-tracker.md`.

### Triage labels

Vocabulário padrão: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Veja `docs/agents/triage-labels.md`.

### Domain docs

Single-context: um `CONTEXT.md` na raiz e ADRs em `docs/adr/`. Veja `docs/agents/domain.md`.
