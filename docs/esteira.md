# Esteira

Como o código chega a Produção: integração contínua no GitHub Actions, deploy pelo Workers Builds da Cloudflare, proteção de `main` por rulesets e atualização de dependências pelo Renovate. Decisão de fundo: ADR 0002 (o CMS publica direto em `main`).

## CI: GitHub Actions

`.github/workflows/ci.yml` roda em todo pull request e em todo push em `main`. O push direto em `main` é o caminho do Sveltia CMS: uma publicação que quebre o build fica vermelha no GitHub e notifica João; o Workers Builds não implanta um build que falhou.

| Job          | O que roda                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `check`      | `pnpm check` (tipos, ESLint, Prettier) e `pnpm test:unit`                                                   |
| `build`      | `pnpm build`                                                                                                |
| `e2e`        | `pnpm test:e2e`: Playwright + axe em todas as rotas, contra `dist/` servido por `wrangler dev`              |
| `lighthouse` | `pnpm lighthouse`: Lighthouse CI com o orçamento de `lighthouserc.yml`                                      |
| `audit`      | `pnpm audit --prod --audit-level=high` e, em PR, a revisão de dependências do GitHub (`fail-on-severity: high`) |

Os nomes dos jobs são os checks exigidos pelo ruleset de `main`; `tests/unit/esteira.test.ts` falha se um job e um check divergirem.

Detalhes que não são óbvios:

- `.github/actions/setup` é a action composta que todo job usa: Node de `.node-version`, pnpm do campo `packageManager`, `pnpm install --frozen-lockfile` com cache do store e, quando pedido, o Chromium completo do Playwright em cache por versão e o cache de imagens do Astro. `e2e` e `lighthouse` usam esse mesmo Chromium: um só motor de renderização para os dois gates, local e no CI.
- Cada job que precisa do site refaz o build, em vez de receber `dist/` como artefato: o `wrangler` lê `dist/client/wrangler.json` por um redirecionamento gravado em `.wrangler/deploy/config.json`, fora de `dist/`, e o artefato perderia esse arquivo e o `.assetsignore`.
- O tempo do build está nas imagens: o Astro deriva uma variante AVIF e uma WebP por largura de cada imagem dos Projetos — cerca de 1900 arquivos e 150 MB, de doze a vinte e quatro minutos a frio no runner do GitHub contra segundos com as variantes prontas (verificado 2026-09; cada Projeto novo no CMS aumenta os três números). Os três jobs que constroem o site restauram `node_modules/.astro/assets` pela action de setup, com a chave presa a `src/assets` e a `src/imagens.ts`, que são o que decide as variantes — o resto do conteúdo fica de fora para que uma edição de texto no CMS não invalide 150 MB de imagem — e um prefixo de reserva que aproveita o cache anterior e gera só o que faltar. Uma imagem nova custa o build cheio uma vez; o cache gravado em `main` serve os PRs seguintes. Os três jobs correm em paralelo, então na corrida a frio só o primeiro a terminar grava — os outros registram `Unable to reserve cache with key`, que é o comportamento esperado e não falha o job.
- Actions fixadas por SHA completo, com a tag em comentário. O repositório exige SHA pinning; o Renovate atualiza o SHA e o comentário juntos.
- `audit` olha o que vai para Produção (`--prod`) e, em PR, o que o PR acrescenta ao lockfile. Advisory transitivo sem correção publicada entra em `allow-ghsas` no workflow, com o motivo ao lado; advisory com correção entra como `overrides` em `pnpm-workspace.yaml`.
- Relatórios: `playwright-report` (artefato só em falha) e `lighthouse-report` (sempre), sete dias de retenção. Nada é enviado a serviço externo.

### Orçamento do Lighthouse

`lighthouserc.yml`: emulação mobile com throttling simulado (o perfil padrão do Lighthouse e o cenário mais lento), três rodadas por URL, mediana. Falha o job: LCP acima de 2,5 s, CLS acima de 0,1, acessibilidade abaixo de 100. Performance abaixo de 95 é aviso, não erro, porque a nota varia com a carga do runner. A lista de URLs cobre uma rota por padrão de página, no pior caso de cada um — a Galeria mais pesada, uma Galeria média e o estado Em breve —, e não as dez páginas de Projeto: medir todas repetiria o mesmo veredito por minutos de CI. A cobertura rota a rota de acessibilidade é do `axe`, em `tests/e2e/rotas.ts`.

## Deploy: Workers Builds

O Worker `giordanna-pereira-site` está ligado ao repositório pelo Workers Builds (painel da Cloudflare, Workers & Pages → giordanna-pereira-site → Settings → Build). `main` publica em Produção; qualquer outra branch gera uma versão de preview, e a GitHub App "Cloudflare Workers and Pages" comenta a preview URL no PR e cria um check run por build.

| Campo                                   | Valor                                                             |
| --------------------------------------- | ----------------------------------------------------------------- |
| Branch de produção                      | `main`                                                            |
| Build command                           | `pnpm build`                                                      |
| Deploy command                          | `npx wrangler deploy` (padrão)                                    |
| Non-production branch deploy command    | `npx wrangler versions upload` (padrão)                           |
| Root directory                          | `/`                                                               |
| Variável de build `PNPM_VERSION`        | igual ao `packageManager` do `package.json`                       |
| Builds for non-production branches      | ligado                                                            |

`PNPM_VERSION` existe porque a imagem do Workers Builds traz pnpm 10 por padrão, e `pnpm-workspace.yaml` usa chaves do pnpm 11 (`allowBuilds`): sem ela o `sharp` não roda o script de instalação e o build de imagens quebra. Node vem de `.node-version`. O `wrangler deploy` na raiz é correto porque o adapter grava o redirecionamento para `dist/client/wrangler.json`.

Segredos e variáveis do Worker (Resend, Turnstile, autenticador do Sveltia) ficam em Settings → Variables and Secrets do Worker, nunca no repositório nem no workflow. Rollback: Deployments → versão anterior → Rollback.

## Proteção de `main`: rulesets

Dois rulesets, versionados em `.github/rulesets/` e aplicados pela API do GitHub. São dois porque o bypass é por ruleset e o ADR 0002 pede bypass para o papel write só nas regras de PR e checks:

- `main: PR e checks`: exige pull request (zero aprovações, threads resolvidas, merge só por squash) e os cinco checks do CI. Bypass para o papel **write**, que neste repositório cobre apenas quem publica pelo CMS. Administradores não têm bypass: João segue branch → PR → squash sempre.
- `main: histórico`: bloqueia force push e exclusão da branch. Sem bypass para ninguém.

Aplicar ou atualizar:

```bash
gh api --method POST repos/johnlaff/giordanna-pereira-site/rulesets --input .github/rulesets/main-pr-e-checks.json
```

```bash
gh api repos/johnlaff/giordanna-pereira-site/rulesets --jq '.[] | "\(.id) \(.name)"'
```

Para alterar um ruleset existente, `--method PUT repos/johnlaff/giordanna-pereira-site/rulesets/<id>` com o mesmo arquivo. O JSON do repositório é a fonte; o painel do GitHub, o espelho.

Configurações do repositório que completam a proteção: merge só por squash, branch apagada após o merge, auto-merge habilitado (o Renovate usa), SHA pinning obrigatório para actions e alertas do Dependabot ligados (a revisão de dependências do job `audit` exige o dependency graph, que vem junto).

## Dependências: Renovate

`renovate.json`, executado pela GitHub App do Renovate instalada no repositório. Toda segunda-feira antes das 6h (horário de Brasília), com três dias de carência após cada release:

- patches, pins e digests de actions em um PR agrupado (`patches`), com automerge quando o CI passa;
- minors em um PR agrupado (`minors`), merge manual;
- majors em PRs individuais.

`rangeStrategy: bump` mantém o `package.json` com a versão instalada, não só o lockfile. O painel de dependências é a issue "Dependency Dashboard".
