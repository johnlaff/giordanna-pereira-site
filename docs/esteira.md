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

- `.github/actions/setup` é a action composta que todo job usa: Node de `.node-version`, pnpm do campo `packageManager`, `pnpm install --frozen-lockfile` com cache do store e, quando pedido, o Chromium completo do Playwright em cache por versão. `e2e` e `lighthouse` usam esse mesmo Chromium: um só motor de renderização para os dois gates, local e no CI.
- Cada job que precisa do site refaz o build. O `wrangler` lê `dist/client/wrangler.json` por um redirecionamento gravado em `.wrangler/deploy/config.json`, fora de `dist/`; um artefato entre jobs perderia esse arquivo e o `.assetsignore`, e o build leva menos de um segundo.
- Actions fixadas por SHA completo, com a tag em comentário. O repositório exige SHA pinning; o Renovate atualiza o SHA e o comentário juntos.
- Relatórios: `playwright-report` (artefato só em falha) e `lighthouse-report` (sempre), sete dias de retenção. Nada é enviado a serviço externo.

### Orçamento do Lighthouse

`lighthouserc.yml`: emulação mobile com throttling simulado (o perfil padrão do Lighthouse e o cenário mais lento), três rodadas por URL, mediana. Falha o job: LCP acima de 2,5 s, CLS acima de 0,1, acessibilidade abaixo de 100. Performance abaixo de 95 é aviso, não erro, porque a nota varia com a carga do runner. Cada ticket que cria página acrescenta a rota na lista de URLs, como faz em `tests/e2e/rotas.ts`.

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

Configurações do repositório que completam a proteção: merge só por squash, branch apagada após o merge, auto-merge habilitado (o Renovate usa) e SHA pinning obrigatório para actions.

## Dependências: Renovate

`renovate.json`, executado pela GitHub App do Renovate instalada no repositório. Toda segunda-feira antes das 6h (horário de Brasília), com três dias de carência após cada release:

- patches, pins e digests de actions em um PR agrupado (`patches`), com automerge quando o CI passa;
- minors em um PR agrupado (`minors`), merge manual;
- majors em PRs individuais.

`rangeStrategy: bump` mantém o `package.json` com a versão instalada, não só o lockfile. O painel de dependências é a issue "Dependency Dashboard".
