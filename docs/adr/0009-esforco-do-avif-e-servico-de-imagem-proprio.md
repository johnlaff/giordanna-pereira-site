# O esforço de compressão do AVIF é 3, por um serviço de imagem nosso

O build gera uma variante AVIF e uma WebP por largura de cada imagem dos Projetos, e é ele que decide quanto o compressor de AVIF procura antes de gravar cada arquivo. Esse número — `esforcoDoAvif`, em `src/imagens.ts` — passa a ser 3, contra o padrão 4 do sharp, e chega ao compressor por `image.service` em `astro.config.ts`, apontando para `src/servico-de-imagem.ts`.

O esforço não é qualidade. O alvo de qualidade é `qualidadeDeImagem`, e o esforço só diz quanto tempo o compressor gasta tentando alcançá-lo com menos bytes. Medido no acervo em 2026-09-20, o padrão 4 é patológico: ele procura cinco vezes mais que o 3 e grava um arquivo do mesmo tamanho. Gravando a variante de 2560 px de seis imagens do site, o tempo por imagem vai de 0,85 s no esforço 1 a 10,62 s no 4, enquanto o peso fica entre 270 e 274 kB em toda a faixa — o único esforço que de fato engorda o arquivo é o 0, com +8%.

O 3 é o ponto onde o build fica quase quatro vezes mais rápido sem custar bytes ao visitante (+0,7% no conjunto). O 2 seria mais rápido ainda, mas cobra +2,4% de peso, e peso de página é exatamente o que o orçamento do Lighthouse defende.

`src/servico-de-imagem.ts` existe por um detalhe do adapter da Cloudflare. Com `imageService: 'compile'`, ele só preserva o `image.service` do projeto quando o entrypoint não é o do próprio Astro (`hasUserImageService`, em `@astrojs/cloudflare/utils/image-config`); com o entrypoint do Astro, serviço e configuração são trocados pelos dele e o esforço volta ao padrão sem aviso. O arquivo republica o serviço sharp do Astro sem mudar nada, só para que o `config` do projeto sobreviva a essa troca.

## Considered Options

- **Encurtar a escada de larguras**: menos variantes, mesmo compressor. Sai caro em peso — tirar degraus obriga o navegador a pedir a variante seguinte, maior — e rendia de 24% a 36% de tempo, contra os 74% do esforço. Não vale pagar em bytes o que o esforço dá de graça.
- **Manter o padrão do sharp**: é o que estava, e custa dezessete minutos de build a frio sem nada em troca.
- **Um serviço de imagem escrito do zero**: controle total (esforço, subamostragem de croma, qualidade por formato), e a manutenção de um serviço próprio a cada versão do Astro. O que se queria era um parâmetro.

## Consequences

- O build a frio das 1874 variantes cai de 17 min 04 s para 4 min 22 s na mesma máquina (medido em 2026-09-20, quatro núcleos), e o `dist/` fica 0,6% mais pesado. Vale para o Workers Builds, para os três jobs do CI que constroem o site e para quem roda `pnpm build` na própria máquina.
- O conjunto das variantes AVIF fica 0,7% mais pesado. O AVIF continua sendo o formato que quase todo navegador recebe; o WebP é a alternativa de quem não tem AVIF.
- Entrar com um serviço de imagem próprio muda o nome de todas as variantes, porque o nome sai do serviço que as gera. O primeiro build depois do merge é a frio no Workers Builds e no CI: o preço de uma vez, agora de quatro minutos e meio em vez de dezessete.
- Mudar o esforço depois não regera nada. Ele não entra no nome do arquivo, ao contrário da qualidade, então as variantes em cache continuam válidas e servidas como estão, e o número novo só alcança variantes inéditas. Quem quiser medir outro esforço no acervo inteiro precisa limpar o cache de imagens — `node_modules/.astro/assets` na máquina, o botão *Clear Cache* no Workers Builds.
- A chave do cache de imagens do CI passa a incluir `src/servico-de-imagem.ts`, ao lado de `src/assets` e `src/imagens.ts`. Sem isso, mexer na compressão não invalidaria nada e o cache continuaria servindo variantes de uma compressão que não existe mais; `tests/unit/esteira.test.ts` cobra os três caminhos.
- `tests/unit/imagens.test.ts` guarda os dois lados: que o esforço configurado chega ao compressor e que o entrypoint não voltou a ser o do Astro. Sem esses testes a perda seria silenciosa — nada quebra, o build só volta a demorar.
- A medição está registrada em `src/imagens.ts`, ao lado do número, para que uma revisão futura discuta a tabela e não a lembrança dela.
