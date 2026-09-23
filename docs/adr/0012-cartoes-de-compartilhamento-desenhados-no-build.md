# Cartões de compartilhamento desenhados no build, pelo sharp

A imagem que o WhatsApp e o LinkedIn mostram de um link (o `og:image`) é desenhada no fim do
build, uma por rota pública, pela integração `src/compartilhamento/integracao.ts`. O desenho
usa o sharp — o mesmo que já gera as variantes de imagem — com o Pango que vem dentro dele
para o texto, e as fontes do site em arquivo (`src/compartilhamento/fontes/`, licença OFL). O
template é o do Preview (`docs/reference/tests-preview/og.js`), e as doze JPGs do handoff
saíram de `public/og/`.

O ticket pedia que um Projeto cadastrado no CMS ganhasse o seu Cartão sem ninguém mexer em
nada, e as JPGs fixas do handoff não fazem isso. O Preview as gerava fotografando uma página
HTML num Chromium, e esse caminho não existe no build da Cloudflare: o Workers Builds não tem
navegador, e trazer um seria centenas de megabytes por build.

As alternativas pesadas foram descartadas:

- **Satori + resvg** (o que o `@vercel/og` usa): desenha a partir de JSX com layout flexbox,
  mas são duas dependências novas, uma delas binária, para fazer o que o sharp já faz. E o
  Satori não lê WOFF2, então as fontes teriam de entrar em arquivo do mesmo jeito.
- **Uma página do Astro que devolve a imagem** (`src/pages/og/[...].jpg.ts`): seria o caminho
  natural, mas o prerender do adapter da Cloudflare roda no workerd, onde o sharp não carrega.
  Mudar o prerender para Node (`prerenderEnvironment: 'node'`) mexeria em como toda página é
  gerada por causa de treze imagens. O gancho `astro:build:done` já roda no Node.

O sharp vira dependência direta, na versão que o Astro já instalava como opcional, e o `yaml`
passa de dependência de desenvolvimento a dependência do build: o gancho lê os Projetos direto
dos arquivos da collection, com o contrato de `content.schema.ts`, porque o `getCollection`
não existe fora das páginas.

## Consequences

- O Pango não desenha "como o CSS": a posição de cada linha sai de uma conta com as métricas
  da fonte (`desenho.ts`). O resultado foi comparado lado a lado com as doze JPGs do Preview e
  bate a olho nu; diferença de um ou dois pixels na quebra ou na margem é esperada.
- Se o Pango não achar a fonte, ele cai numa do sistema sem avisar. O desenho mede uma amostra
  de cada fonte antes de usar e derruba o build se a largura não bater, para nunca publicar um
  Cartão na fonte errada.
- As URLs do `og:image` e do `og:url` são as canônicas (`site`, ADR 0007), como no
  Compartilhe. Numa preview URL, o leitor de link segue o `og:url` até o domínio final; a
  conferência no WhatsApp e no LinkedIn só é real depois que o domínio aponta para o site (#16).
- No `astro dev` o Cartão é desenhado na hora em que é pedido, pelo mesmo módulo.
- Uma rota pública nova ganha o seu Cartão em `cartoesDoSite` (`src/compartilhamento/cartoes.ts`)
  e passa `rota` ao `Base.astro`; o teste e2e de compartilhamento cobra que toda rota pública
  aponte para um Cartão que existe.
