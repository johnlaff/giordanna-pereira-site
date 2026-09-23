# O CMS empacotado no build e o login dele dentro do Worker do site

O Sveltia CMS (ADR 0002) entra como dependência do npm (`@sveltia/cms`), numa página do Astro em
`/admin` (`src/pages/admin.astro`) que o importa e o inicia com a configuração de
`src/admin/configuracao.ts`. O login pelo GitHub passa por duas rotas do próprio Worker do site,
`/api/admin/entrar` e `/api/admin/retorno` (`src/admin/autenticador.ts`), com o mesmo protocolo
do Sveltia CMS Authenticator, e não por um Worker à parte. As credenciais do OAuth App ficam nas
variáveis do Worker (`GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`), declaradas no `env.schema` do
`astro.config.ts`.

Por que empacotar, e não carregar do UNPKG como a documentação do Sveltia sugere: a versão fica
presa ao lockfile, sobe pelo Renovate com o CI verde, e o script que roda com o token de
Giordanna nas mãos não muda sem um PR. O `config.yml` virou um objeto em TypeScript pelo mesmo
motivo e por mais dois: o `astro check` o confere contra os tipos do Sveltia, e um teste de
unidade confere que o formulário e o schema das collections dizem a mesma coisa, com as regras
de área, ano e HTML escritas uma vez em `src/content.schema.ts`.

Por que o login no Worker do site: ele já executa uma rota (`/api/contato`), e mais duas não
pedem outro projeto na Cloudflare, outro deploy nem outra lista de origens permitidas. Na mesma
origem do CMS, a janela de login só entrega o token à própria origem, e o endereço de retorno é
o do pedido: o `workers.dev` hoje, o domínio depois do #16. O OAuth App do GitHub tem um único
endereço de retorno, então o login funciona só na origem cadastrada nele, não nas URLs de
preview. O token pedido é `public_repo`, porque o repositório é público.

## Consequences

- A página `/admin` tem CSP própria, mais larga que a do site, e só ela: `script-src` soma
  `https://unpkg.com` e `'wasm-unsafe-eval'`; `style-src` leva `'unsafe-inline'`; `connect-src`
  soma a API do GitHub, o `githubstatus.com` e o UNPKG; `img-src` os avatares do GitHub; e
  `font-src` o jsDelivr. É o que o Sveltia usa de fora mesmo empacotado: a tradução pt-BR da
  interface, as fontes dela e, no Safari, que não codifica WebP, o codificador em WebAssembly
  que converte as fotos antes do commit. Os estilos são montados em tempo de execução, sem hash
  possível no build. As páginas públicas continuam com a CSP do ADR 0005.
- O UNPKG entra no `script-src` inteiro, e não só nos caminhos do codificador: o módulo dele
  importa `wasm-feature-detect` por uma faixa de versão (`@^1.2.11`), que o UNPKG resolve com
  um redirecionamento, e um caminho na CSP não descreve essa URL. É a parte mais larga da
  política, e é o preço de o upload do iPhone chegar em WebP. Se o Sveltia passar a empacotar
  o codificador, o UNPKG sai do `script-src`.
- A regra de só duas origens externas (ADR 0005) é do site público. O CMS é ferramenta de quem
  edita, fica fora do sitemap, com `noindex` e barrado no `robots.txt`.
- A janela de login é uma navegação, e com a página 404 ligada a Cloudflare responde
  navegações a caminhos sem arquivo com a 404 estática, sem chamar o Worker. Por isso o
  `wrangler.jsonc` manda as rotas `/api/*` ao Worker antes dos arquivos (`run_worker_first`).
- As duas páginas do login são respostas do Worker: levam os headers de segurança do site
  (`src/headers-de-seguranca.ts`) e uma CSP que libera só o próprio script, pelo hash.
- Sem as duas variáveis, o login falha fechado e o CMS mostra que o OAuth App não está
  configurado. O passo a passo do João (criar o OAuth App, cadastrar as variáveis, convidar a
  Giordanna) está em `docs/esteira.md`.
- Em `localhost`, o Sveltia oferece "Trabalhar com Repositório Local", que edita os arquivos
  da máquina sem login. A suíte de e2e usa esse caminho para cadastrar um Projeto de verdade
  pelo CMS e conferir o arquivo e a foto que ele grava.
