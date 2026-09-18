# Páginas reais (MPA) com View Transitions nativas e URLs `/projetos/<slug>`

O preview de referência é um arquivo único com roteador por hash (`#/projeto/<slug>`) e um "véu" animado entre páginas. Em produção cada página é um HTML real: `/`, `/projetos`, `/projetos/<slug>`, `/contato`, `/404`. A transição entre páginas usa View Transitions nativas do navegador via CSS (`@view-transition { navigation: auto }`), sem `<ClientRouter />` do Astro, e `prefetch: { prefetchAll: true }` para a navegação parecer instantânea. Onde o navegador não suporta, a navegação é a comum, sem fallback em JavaScript.

## Consequences

- URLs hierárquicas: a lista em `/projetos` e cada item aninhado em `/projetos/<slug>` (plural). Isso dá link compartilhável e SEO por página, o que o hash router nunca teria.
- A suíte de testes herdada do preview aponta para `#/projeto/<slug>` (singular); a migração da suíte troca as rotas para o esquema acima a partir da primeira página de Projeto (#6). Não há redirect de `/projeto/<slug>` a manter: o preview nunca foi publicado nem indexado. (remover no PR de #6)
- Sem `<ClientRouter />`, não existe estado de SPA para vazar entre páginas (carrossel, lightbox e galeria inicializam do zero a cada navegação), e o JS de cada página carrega só onde é usado.
