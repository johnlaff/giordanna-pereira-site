# handoff/ — pacote de passagem para o repositório giordanna-pereira-site

Como usar (no clone do repo https://github.com/johnlaff/giordanna-pereira-site):

1. Copie o conteúdo desta pasta para o repo assim:
   - `HANDOFF.md`  -> `docs/HANDOFF.md`
   - `CLAUDE.md`   -> `CLAUDE.md` (raiz)
   - `content/`    -> `docs/content/` (o ticket 2 transforma em `src/content/`)
   - `assets/`     -> `src/assets/` (já no tamanho final: WebP <= 2560 px)
   - `og/`         -> `public/og/`
   - `tests/`      -> `docs/reference/tests-preview/` (serão migrados para `tests/` no ticket 1)
   - `reference/`  -> `docs/reference/`
2. `git add -A && git commit -m "chore: handoff do preview aprovado"` e `git push`.
3. Abra o Claude Code na pasta do repo e siga a ordem descrita em `docs/HANDOFF.md` (§ inicial):
   `/plugin install mattpocock-skills` -> `/setup-matt-pocock-skills` -> "leia docs/HANDOFF.md" + `/grill-with-docs` -> `/to-spec` -> `/to-tickets` -> `/implement` (ticket 1).

Tamanho: ~85 MB (58 MB de assets + 13 MB do preview de referência + 12 MB de OG/testes/scripts).
