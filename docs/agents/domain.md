# Domain Docs

Como as skills de engenharia devem consumir a documentação de domínio deste repo ao explorar a codebase.

## Antes de explorar, leia

- **`CONTEXT.md`** na raiz do repo, ou
- **`CONTEXT-MAP.md`** na raiz, se existir: ele aponta para um `CONTEXT.md` por contexto. Leia cada um relevante ao tópico.
- **`docs/adr/`**: leia os ADRs que tocam a área em que vai trabalhar. Em repos multi-contexto, verifique também `src/<context>/docs/adr/` para decisões restritas a um contexto.

Se algum desses arquivos não existir, **siga em silêncio**. Não aponte a ausência nem sugira criá-los de antemão. A skill `/domain-modeling` (alcançada via `/grill-with-docs` e `/improve-codebase-architecture`) os cria sob demanda, quando termos ou decisões forem de fato resolvidos.

## Estrutura de arquivos

Este repo é **single-context**:

```
/
├── CONTEXT.md
├── docs/adr/
│   └── NNNN-titulo-da-decisao.md      ← nascem do /grill-with-docs
└── src/
```

Layout multi-contexto (presença de `CONTEXT-MAP.md` na raiz), para referência caso o repo cresça:

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← decisões de sistema
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← decisões do contexto
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use o vocabulário do glossário

Quando a saída nomear um conceito de domínio (título de issue, proposta de refactor, hipótese, nome de teste), use o termo como definido em `CONTEXT.md`. Não derive para sinônimos que o glossário evita explicitamente.

Se o conceito necessário ainda não está no glossário, isso é um sinal: ou você está inventando linguagem que o projeto não usa (reconsidere), ou há uma lacuna real (anote para `/domain-modeling`).

## Sinalize conflitos com ADRs

Se a saída contradisser um ADR existente, explicite em vez de sobrescrever em silêncio:

> _Contradiz o ADR-0007 (orders event-sourced), mas vale reabrir porque…_
