# Issue tracker: GitHub

Issues e PRDs deste repo vivem como GitHub Issues em `johnlaff/giordanna-pereira-site`. Use a CLI `gh` para todas as operações.

## Convenções

- **Criar issue**: `gh issue create --title "..." --body "..."`. Use heredoc para corpo multilinha.
- **Ler issue**: `gh issue view <number> --comments`, filtrando comentários com `jq` e buscando também as labels.
- **Listar issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` com os filtros `--label` e `--state` adequados.
- **Comentar**: `gh issue comment <number> --body "..."`
- **Aplicar / remover labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Fechar**: `gh issue close <number> --comment "..."`

O repo é inferido de `git remote -v`; `gh` faz isso sozinho quando roda dentro do clone.

## Pull requests como superfície de triagem

**PRs as a request surface: no.** _(Mude para `yes` se este repo tratar PRs externos como pedidos de feature; `/triage` lê esta flag.)_

Quando `yes`, PRs passam pelas mesmas labels e estados das issues, usando os equivalentes `gh pr`:

- **Ler PR**: `gh pr view <number> --comments` e `gh pr diff <number>` para o diff.
- **Listar PRs externos para triagem**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, mantendo só `authorAssociation` igual a `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` ou `NONE` (descarte `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comentar / rotular / fechar**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

Issues e PRs compartilham a mesma numeração no GitHub, então um `#42` solto pode ser qualquer um dos dois: resolva com `gh pr view 42` e caia para `gh issue view 42`.

## Quando uma skill disser "publique no issue tracker"

Crie uma GitHub Issue.

## Quando uma skill disser "busque o ticket relevante"

Rode `gh issue view <number> --comments`.

## Operações de wayfinding

Usadas por `/wayfinder`. O **mapa** é uma única issue com issues **filhas** como tickets.

- **Mapa**: uma issue com a label `wayfinder:map`, contendo o corpo Notes / Decisions-so-far / Fog. `gh issue create --label wayfinder:map`.
- **Ticket filho**: issue ligada ao mapa como sub-issue do GitHub (`gh api` no endpoint de sub-issues). Onde sub-issues não estiverem habilitadas, adicione o filho a uma task list no corpo do mapa e coloque `Part of #<map>` no topo do corpo do filho. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Ao ser reivindicado, o ticket é atribuído ao dev que o conduz.
- **Bloqueio**: **dependências nativas de issue** do GitHub, a representação canônica e visível na UI. Adicione uma aresta com `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, onde `<blocker-db-id>` é o **database id** numérico do bloqueador (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _não_ o `#number` nem o `node_id`). O GitHub reporta `issue_dependencies_summary.blocked_by` (só bloqueadores abertos, o gate vivo). Onde dependências não estiverem disponíveis, caia para uma linha `Blocked by: #<n>, #<n>` no topo do corpo do filho. Um ticket está desbloqueado quando todos os bloqueadores estão fechados.
- **Consulta de fronteira**: liste os filhos abertos do mapa (`gh issue list --state open`, restrito às sub-issues / task list do mapa), descarte os que têm bloqueador aberto (`issue_dependencies_summary.blocked_by > 0`, ou issue aberta na linha `Blocked by`) ou assignee; o primeiro na ordem do mapa vence.
- **Reivindicar**: `gh issue edit <n> --add-assignee @me`, a primeira escrita da sessão.
- **Resolver**: `gh issue comment <n> --body "<resposta>"`, depois `gh issue close <n>`, depois anexe um ponteiro de contexto (gist + link) ao Decisions-so-far do mapa.
