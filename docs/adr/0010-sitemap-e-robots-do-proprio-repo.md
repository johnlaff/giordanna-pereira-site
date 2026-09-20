# Sitemap e robots.txt gerados pelo próprio repositório

O `/sitemap.xml` e o `/robots.txt` saem de dois endpoints do Astro (`src/pages/sitemap.xml.ts`
e `src/pages/robots.txt.ts`) que servem o que `src/rotas.ts` monta a partir da collection
`projetos`. A integração `@astrojs/sitemap`, prevista no HANDOFF §16, fica de fora.

São trinta linhas de código: a lista de rotas públicas, um XML com uma `<loc>` por rota e o
`robots.txt` apontando para ele. A integração faria o mesmo trabalho com uma dependência a
mais no `package.json`, no Renovate e na auditoria, e ainda assim não cobriria o `robots.txt`,
que ela não gera — ele seria escrito à mão de qualquer jeito, com a URL do sitemap repetida
num arquivo estático, longe de quem decide as rotas.

A decisão também vale pelo nome do arquivo: a integração publica `/sitemap-index.xml` e um
`/sitemap-0.xml` por trás, partição que só rende acima de cinquenta mil URLs; este site tem
treze rotas e publica um `/sitemap.xml` só, que é o endereço que se digita e o que já está no
`robots.txt`.

O que sustenta a escolha é o teste: `tests/unit/rotas.test.ts` cobra a lista, o escape de XML
e a URL do sitemap dentro do `robots.txt`, e `tests/e2e/sitemap.spec.ts` cobra que toda URL
publicada responde 200 sem desvio, contra o `dist/` servido pelo Worker. É mais do que a
integração traria de garantia.

## Consequences

- Uma rota nova de outro tipo — a de contato (#11), a do CMS (#15) — entra em
  `rotasPublicas`, em `src/rotas.ts`, senão não chega ao buscador. As páginas de Projeto não
  precisam de nada: saem da collection.
- Não há `<link rel="sitemap">` no `head`, que a integração injeta. O `robots.txt` é o
  caminho que todo buscador lê, e é ele que aponta.
- Se um dia o site passar de alguns milhares de URLs, ou precisar de `lastmod` por página,
  a integração volta a valer — e aí esta decisão se inverte com um ADR novo.
