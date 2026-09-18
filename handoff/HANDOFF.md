# HANDOFF — Site de Giordanna Pereira (portfólio de arquitetura)

Data: 18/09/2026 · Autor da passagem: sessão Claude (Cowork) que construiu o preview · Destino: sessão Claude Code no repositório `johnlaff/giordanna-pereira-site`.

Este arquivo é a única leitura obrigatória para começar. Ele foi escrito para alimentar, nesta ordem, as skills do plugin `mattpocock-skills`: `/setup-matt-pocock-skills` → `/grill-with-docs` (§3 glossário e §4 ADRs viram `CONTEXT.md` e `docs/adr/`) → `/to-spec` (§5) → `/to-tickets` (§6) → `/implement`.

---

## 1. Contexto em um parágrafo

Giordanna Pereira é arquiteta e urbanista (CAU nº A333733-2), Uberlândia/MG. Existe um **preview funcional** do site dela em arquivo único (`reference/site-final.html`, 13 MB, tudo embutido em base64) que passou por dezenas de rodadas de revisão dela e do João: textos, ordem dos projetos, fichas, galerias, carrossel de depoimentos, lightbox, acessibilidade (axe limpo, WCAG 2.2 AA), auditoria Impeccable (0 achados desktop e mobile). **O layout e o conteúdo estão aprovados.** O trabalho agora é reconstruir esse site como projeto Astro real, com uma URL por página, imagens otimizadas no build, esteira de CI/CD, formulário funcional e um CMS para a Giordanna editar sozinha. Nada de redesign: o preview é a referência visual e funcional a ser reproduzida.

Documento de decisão completo (análise de mercado 2026, comparações, fontes): doc do Claude "Stack do site Giordanna — análise e recomendação" (o João tem o link). O essencial está condensado aqui.

## 2. O que está neste pacote

| Caminho | O que é | Uso no repo novo |
| --- | --- | --- |
| `HANDOFF.md` | este arquivo | leitura inicial; depois vira `docs/HANDOFF.md` |
| `CLAUDE.md` | esqueleto de instruções do repositório | copiar para a raiz e evoluir |
| `content/conteudo.json` | **todo o conteúdo estruturado**: 10 projetos (slug, título, tipo, capa, descrição, ferramentas, local, ano, área, equipe, galeria ordenada), 6 depoimentos, 4 contatos | fonte das content collections e dos componentes |
| `content/origem-imagens.json` | chave de imagem → pasta/arquivo original (Drive/Behance/PDF) | rastreabilidade; os originais em alta ficam no Drive da Giordanna |
| `assets/<chave>.webp` | 136 imagens **prontas para o repo**: redimensionadas deterministicamente para no máximo 2560 px, WebP q90 | `src/assets/` — o Astro gera AVIF/WebP e `srcset` a partir daqui |
| `reference/site.html` | fonte do preview: CSS completo, templates das páginas, dados, JS de galeria/lightbox/carrossel/roteador | referência de layout, tokens, comportamentos |
| `reference/site-final.html` | preview construído (abrir no navegador) | referência visual viva; comparar lado a lado |
| `reference/paginas-html-templates.txt` | só os templates das páginas (recorte do site.html) | leitura rápida da estrutura de cada página |
| `reference/build.py`, `build_dist.py`, `sources.json` | scripts do preview (embed base64; variantes 640/1200/1920/2560) | apenas contexto; serão aposentados pelo Astro |
| `tests/*.js` | suíte Playwright do preview (ver §8) | migrar para `tests/` do Astro, apontando para o dev server |
| `og/*.jpg` | 12 imagens Open Graph 1200×630 (home, contato, uma por projeto) | `public/og/` |

## 3. Glossário (para `CONTEXT.md`)

- **Projeto**: uma obra do portfólio. Tem **ficha** (local, ano, área, equipe, ferramentas), **descrição**, **capa** e **galeria**.
- **Capa**: imagem do card na grade de projetos. Nem sempre é a primeira da galeria (ex.: Vitalis usa `vitalis-torre-sky` como capa e `hero` como primeira da galeria).
- **Galeria**: lista ordenada de chaves de imagem. Regra fixa: **renders primeiro, pranchas por último**.
- **Render**: perspectiva/imagem realista (chaves `-r01`, `-d01`, `-n01`, `hero`, `loft-render`…).
- **Prancha**: desenho técnico/apresentação (chaves `-p01`, `-b01`, `loft-prancha`, `vitalis-d22..d26`).
- **gal-hero**: quando a primeira imagem da galeria é paisagem, ela ocupa a largura toda com recorte 16:8; as demais entram em **linhas justificadas** (altura-alvo 380/300/230 px por largura de tela, última linha rebalanceada, corte máximo 1,45× da altura-alvo).
- **Lightbox**: PhotoSwipe 5 com loop, zoom (roda, duplo toque, pinça; 2× secundário, 4× máx.), legenda `n / N TÍTULO`, abre a variante de maior resolução.
- **Grade de projetos**: 3 colunas; com 10 itens (resto 1) o **primeiro** card fica em destaque ocupando a largura toda (proporção 16/6.4); resto 2 → os dois primeiros com meia largura. Mobile: 2 colunas, primeiro card largo; ≤560 px: 1 coluna. Em telas de toque, o overlay (marca + título + tipo, centralizados) fica sempre visível.
- **Depoimento**: card do carrossel infinito (clones nas duas pontas, setas laterais, sem pontos, arrastar com mouse só pela superfície do card, texto selecionável). Dois cards são placeholders aguardando texto (Valquiria, Mariana).
- **Ficha técnica**: bloco "Detalhes do projeto" com LOCAL / ANO / ÁREA / EQUIPE.
- **Véu**: transição entre páginas (no Astro vira View Transitions nativas).
- **Home**: hero (render do Vitalis a 106% com Ken Burns), Sobre (retrato com moldura, formação, credenciais), Ferramentas (níveis), Depoimentos, CTA.
- **Contato**: formulário (nome, e-mail, WhatsApp opcional, assunto, mensagem, consentimento LGPD, honeypot `empresa`) + contatos (WhatsApp, LinkedIn, Behance, e-mail).
- **Preview**: o arquivo único de referência. **Produção**: o site Astro.

## 4. Decisões tomadas (viram ADRs; todas fechadas com o João em 18/09/2026)

1. **Framework**: Astro 7 + TypeScript estrito, site estático (`output: 'static'`) com uma única rota on-demand (`/api/contato`) via `@astrojs/cloudflare`. Node 24 LTS, pnpm. Prettier + ESLint com plugins oficiais do Astro; `astro check` no CI.
2. **Hospedagem**: Cloudflare Workers com static assets (não Pages). Deploy por **Workers Builds** ligado ao GitHub: `main` → produção; branches/PRs → preview URL comentada no PR.
3. **Repositório**: GitHub, **público**, nome `giordanna-pereira-site` (https://github.com/johnlaff/giordanna-pereira-site). Branch `main` protegida com checks obrigatórios. Nenhum segredo no repo (chaves ficam em variáveis do Worker). Renovate agrupado com automerge de patch; `pnpm audit`.
4. **CI**: GitHub Actions em todo PR: `pnpm install` → `astro check` → `astro build` → Playwright (suíte migrada de `tests/`) → axe → Lighthouse CI (orçamento: LCP < 2,5 s, CLS < 0,1, a11y 100).
5. **Imagens**: originais em alta ficam no Drive; o repo guarda WebP ≤ 2560 px (`assets/`). O Astro gera AVIF + WebP e `srcset`/`sizes` (`image.layout: 'constrained'`, `<Picture formats={['avif','webp']}>`). As imagens do repo são redimensionamentos determinísticos dos originais (sem retoque); tratamento de renders por IA fica como possibilidade futura, quando a Giordanna for treinada para isso.
6. **Fontes**: Cormorant Garamond (400/500/600) e Jost (300/400/500/600) self-hosted pela **Fonts API** do Astro. Sem chamada ao Google Fonts.
7. **Segurança**: CSP gerada pelo Astro (`security.csp`), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`; MDN HTTP Observatory no CI. Turnstile é a única origem externa.
8. **Navegação**: páginas reais (MPA). View Transitions nativas via CSS `@view-transition { navigation: auto }` (sem `<ClientRouter />`); `prefetch: { prefetchAll: true }`. Sem hash router.
9. **Formulário**: `POST /api/contato` no Worker: valida campos, Turnstile (siteverify), honeypot, rate limit (1 regra Cloudflare, por IP e caminho), envia via **Resend** para `contato@giordannapereira.arq.br` com `reply-to` do visitante. Sucesso em 2xx; em erro, o front mostra o e-mail como alternativa (comportamento já existe no preview: `FORM_ENDPOINT`, `#f-ok`, `#f-fail`).
10. **CMS**: **Sveltia CMS** em `/admin` (`public/admin/index.html` + `config.yml`), backend GitHub com o **Sveltia CMS Authenticator** em Cloudflare Workers, publicando **direto em `main`**. `config.yml` espelha o schema da collection `projetos`; otimização no upload: `media_libraries.all.transformations.raster_image = { format: webp, quality: 90, width: 2560, height: 2560 }`. UI em pt-BR. Giordanna entra com conta GitHub própria (colaboradora, 2FA).
11. **Domínio**: `giordannapereira.arq.br` no registro.br, **titular Giordanna** (CPF dela, categoria de arquitetos), João como contato administrativo/técnico/cobrança. DNS na Cloudflare, DNSSEC ligado.
12. **E-mail**: `contato@giordannapereira.arq.br` via Cloudflare Email Routing → Gmail dela; respostas pelo Gmail "Enviar como" com SMTP do Resend (`smtp.resend.com:465`, user `resend`, senha = API key). DNS: SPF, DKIM (Resend), **DMARC** (`p=quarantine` → `p=reject`).
13. **Analytics**: Cloudflare Web Analytics (sem cookies, sem banner).
14. **Idioma**: só português. Estrutura preparada para EN futuro (i18n do Astro/Sveltia), sem implementar agora.
15. **Contas**: GitHub, Cloudflare e Resend no nome do João. Registro.br como no item 11.
16. **SEO**: `@astrojs/sitemap`, `robots.txt`, OG por página (imagens em `og/`), JSON-LD `Person` (home) e `CreativeWork` (projeto), `<title>`/`description` por página.
17. **Acessibilidade**: WCAG 2.2 AA; axe sem violações em todas as rotas; foco visível; `prefers-reduced-motion` respeitado (preview já faz).

## 5. Spec (insumo do `/to-spec`)

### Problema
Giordanna depende 100% do João para qualquer alteração no site, o preview é um arquivo único de 13 MB inviável como site real (sem URL por página, sem SEO, imagens superdimensionadas para cada tela), e não há formulário funcional nem publicação.

### Solução
Reconstruir o site aprovado como projeto Astro estático hospedado na Cloudflare, com esteira de CI/CD e previews por PR, formulário real com anti-spam, e Sveltia CMS para ela publicar projetos sozinha pelo celular.

### User stories
1. Como visitante, quero abrir o site e ver a home (hero, sobre, ferramentas, depoimentos, CTA) idêntica ao preview aprovado, para conhecer o trabalho da arquiteta.
2. Como visitante, quero ver a grade de projetos com o primeiro em destaque e abrir cada projeto em sua própria URL, para compartilhar links diretos.
3. Como visitante, quero navegar a galeria justificada e abrir o lightbox com zoom nítido em qualquer tela (inclusive QHD/retina), para avaliar os renders em detalhe.
4. Como visitante no celular, quero imagens leves e o overlay dos cards sempre visível, para navegar rápido no 4G.
5. Como visitante, quero enviar uma mensagem pelo formulário e receber confirmação, para contratar ou convidar a arquiteta.
6. Como Giordanna, quero cadastrar um projeto novo (ficha + galeria ordenada, fotos arrastadas do celular) em `/admin` e vê-lo no ar em minutos, sem depender de ninguém.
7. Como Giordanna, quero que fotos pesadas sejam reduzidas automaticamente ao subir, para não me preocupar com tamanho.
8. Como Giordanna, quero receber as mensagens do formulário no meu Gmail e responder com `contato@giordannapereira.arq.br`.
9. Como João, quero que todo PR rode testes, acessibilidade e performance e gere uma preview URL, para aprovar visualmente antes do merge.
10. Como João, quero que um projeto com campo faltando ou imagem quebrada falhe no build, e não vá ao ar quebrado.
11. Como João, quero rollback em um clique e nenhum segredo no repositório.
12. Como recrutador/cliente, quero que o link compartilhado no WhatsApp/LinkedIn mostre imagem e título corretos (OG por página).
13. Como visitante que usa leitor de tela ou teclado, quero navegar tudo (grade, galeria, lightbox, carrossel, formulário) sem barreiras (WCAG 2.2 AA).
14. Como visitante, quero que a transição entre páginas seja suave onde o navegador suporta, e instantânea onde não.

### Seam de teste (um só)
**Playwright em nível de página contra o site construído** (dev server ou `dist/`), mais axe-core em cada rota. É o mesmo seam do preview (§8); os testes existentes são a especificação executável do comportamento.

### Critérios de aceite globais
- Paridade visual com `reference/site-final.html` em 1440/1024/768/375 px (comparação lado a lado por rota; diferenças só onde decidido: URLs reais, fontes self-hosted).
- Suíte Playwright migrada verde; axe 0 violações; Lighthouse ≥ 95 performance e 100 acessibilidade na home e num projeto.
- `astro build` falha se um projeto violar o schema ou referenciar imagem inexistente.
- Sem requisição a domínios externos além do Turnstile (verificar na aba Network).
- Nenhum arquivo > 2 MB em `src/assets/`; nenhum segredo no histórico do git.

## 6. Tickets propostos (insumo do `/to-tickets`; tracer bullets verticais)

| # | Ticket | Blocked by | Aceite |
| --- | --- | --- | --- |
| 1 | **Esqueleto Astro + uma página de projeto ponta a ponta**: `pnpm create astro@latest` (TS estrito), tokens de CSS e fontes (Fonts API), layout base (header, footer), content collection `projetos` com schema Zod e **um** projeto (GinecoCare) renderizando ficha + galeria estática com `<Picture>` AVIF/WebP | — | página `/projetos/consultorio-ginecocare` idêntica ao preview em 1440 e 375; `astro check` e build verdes; Playwright + axe rodando no CI local |
| 2 | **Todos os projetos na collection** a partir de `content/conteudo.json` + `assets/`, com `getStaticPaths`, ordem oficial, OG por projeto, JSON-LD `CreativeWork`, navegação anterior/próximo | 1 | 10 páginas geradas; build falha se faltar campo ou imagem; `tests/qa` (fichas, ordem, próximo/anterior) verde |
| 3 | **Galeria justificada + lightbox**: portar `layoutGallery` (gal-hero, linhas, rebalanceio, `data-cropped`) e PhotoSwipe 5 com `srcset` das variantes, legenda, loop, zoom | 2 | `tests/lb2` verde; lightbox carrega variante 2560 em tela QHD e 1200 no celular; `prefers-reduced-motion` respeitado |
| 4 | **Home**: hero (variantes por largura, `fetchpriority`), Sobre (retrato com moldura estável), Ferramentas, carrossel infinito de depoimentos (clones, setas, arrasto, `inert` nos dims), CTA | 1 | `tests/qloop`, `qdrag`, `band`, `lum` verdes; Impeccable 0 achados |
| 5 | **Grade de projetos + navegação**: `/projetos` com regra 3×3/resto, `html.touch`, View Transitions nativas, prefetch, 404, sitemap, robots | 2 | `tests/sweep` (14 rotas × 5 larguras) verde; transição visível em Chrome e navegação normal em Firefox |
| 6 | **Contato**: página + `POST /api/contato` (adapter Cloudflare, `prerender=false`), Turnstile, honeypot, rate limit, Resend com `reply-to`, mensagens de sucesso/erro, política de privacidade curta | 1 | teste E2E com Resend em modo sandbox/mocado; envio real validado manualmente; `tests/form` verde |
| 7 | **Sveltia CMS**: `public/admin/`, `config.yml` espelhando o schema (ficha, galeria ordenada, capa), transformações de upload, autenticador em Worker, UI pt-BR, colaboradora com 2FA | 2 | Giordanna cadastra um projeto de teste pelo celular e ele entra no ar via Workers Builds; build falha se ela deixar campo obrigatório vazio (mensagem clara) |
| 8 | **Esteira**: GitHub Actions (check, build, Playwright, axe, Lighthouse CI), Workers Builds com previews, branch protegida, Renovate, headers de segurança (CSP via Astro), HTTP Observatory | 1 | PR de exemplo com preview URL comentada e todos os checks verdes; Observatory ≥ A |
| 9 | **Domínio, e-mail e lançamento**: registro.br (titular Giordanna), DNS + DNSSEC na Cloudflare, Email Routing, SPF/DKIM/DMARC, Resend com domínio verificado, Web Analytics, Search Console, troca de links (Behance, LinkedIn, CV) | 6, 7, 8 | site no ar em `https://giordannapereira.arq.br`; e-mail de teste entregue no Gmail e resposta enviada como `contato@`; DMARC em `quarantine` |

Tickets 3, 4, 5 e 6 podem rodar em paralelo depois do 2 (3, 5) e do 1 (4, 6).

## 7. Regras inegociáveis (herdadas do trabalho com a Giordanna)

- Em toda galeria: renders primeiro, pranchas por último. Capas definidas em `conteudo.json` não mudam sem pedido dela.
- Ordem dos projetos: Vitalis, GinecoCare, Banheiro Chocolate, Villa Verde, Vila Jasmim Manga, Sindicato, Mini Casa, UBS, Espaço Aparecer, Mirante.
- Textos, fichas e depoimentos são os de `conteudo.json` (já revisados por ela). Placeholders: depoimentos de Valquiria e Mariana; imagens do Mirante (mock "Imagens em breve"); "LOGO AQUI" no rodapé/cabeçalho até ela mandar o logo.
- Toda correção vem com teste. Nada vai para `main` com axe ou Playwright vermelho.
- Sem serviço pago. Sem dependência nova sem motivo registrado em ADR.

## 8. A suíte de testes do preview (o que cada script cobre)

Todos usam Playwright e um servidor HTTP local do `site-final.html`; no repo novo, trocar a origem para o dev server/`dist/` e os seletores mudam pouco (o CSS será portado com as mesmas classes).

| Script | Cobre |
| --- | --- |
| `qa.js` | rotas, 10 cards, ordem, próximo/anterior, validação e sucesso do formulário, overflow horizontal em 320/768/1440, centralização do contato |
| `qa2.js` | verificações complementares de conteúdo |
| `cache.js` | transição/véu entre páginas e cache de páginas |
| `lb2.js` | galerias (gal-hero, linhas), lightbox (contagem, loop, zoom), grade 3×3 e resto, reload volta ao topo, comportamento mobile |
| `qdrag.js`, `qloop.js` | carrossel: arrasto, seleção de texto, loop infinito sem "teleporte" |
| `embed.js` | comportamento dentro de iframe com sandbox (mailto/links) — irrelevante em produção |
| `sweep.js` | 14 rotas × 5 larguras: elementos mais largos que a tela (única exceção esperada: `.hero-img`, intencional) |
| `band.js`, `hdrpos.js`, `lum.js`, `a11y2.js` | faixas de seção, posição do header, contraste/luminância, checagens de acessibilidade extras |
| `axe.js` | axe-core em todas as rotas |
| `srcset-dist.js` | qual variante o navegador escolhe em QHD/retina/celular e no lightbox; sem 404 |
| `form-dist.js` | formulário com endpoint real: sucesso (2xx) e falha (5xx) |
| `frame.js` | moldura do retrato permanece após a animação de entrada |
| `og.js`, `mock.js` | geração das imagens OG e do mock do Mirante (não são testes) |
| `imp/` (não incluído) | dumps para auditoria Impeccable — rodar de novo no site Astro |

## 9. Comportamentos sutis que já deram bug (não regredir)

- Moldura do retrato (`.about-photo::after`, `z-index:-1`) some se o container perde o contexto de empilhamento após a animação → `isolation:isolate`.
- Carrossel: clones das duas pontas em ordem correta, `nofx` no salto, `pointerActive` adia o reposicionamento enquanto o mouse está pressionado, seleção de texto livre no card.
- Lightbox: `close()` ignorado durante a abertura → esperar `openingAnimationEnd`; `aria-label` no diálogo.
- Grade: nome de classe `hero` colidiu com `.hero` do site → `gal-hero`.
- Hero: a imagem é exibida a 106% da largura; precisa de variante ≥ 1920 em desktop e 2304 em telas grandes (o asset `hero` tem 2304 px nativos).
- Overlay dos cards em toque via `html.touch` (matchMedia `hover:none`), não via media query no CSS (Impeccable reprovou contraste).

## 10. Lacunas de conteúdo (dependem da Giordanna; não bloqueiam)

Depoimentos de Valquiria e Mariana · imagens do Mirante CESTES · logo definitivo · texto de política de privacidade (rascunhar para ela aprovar) · e-mail novo no CV e no portfólio PDF · fontes maiores para Sala do Sindicato (1130 px) e Mini Casa (898 px) não existem em lugar nenhum.

## 11. Contas e acessos a criar (fora do repo)

| Serviço | Quando | Quem | Observação |
| --- | --- | --- | --- |
| Cloudflare (conta + zona do domínio) | ticket 8 | João | Workers, Workers Builds, Turnstile, Email Routing, Web Analytics |
| registro.br | ticket 9 | Giordanna titular, João contatos | `.arq.br`, R$ 40/ano, DNSSEC |
| Resend | ticket 6 | João | domínio verificado, API key só no Worker |
| GitHub (conta da Giordanna) | ticket 7 | Giordanna | colaboradora com 2FA para o Sveltia |
| GitHub OAuth App (para o Sveltia Authenticator) | ticket 7 | João | client id/secret só no Worker do autenticador |
