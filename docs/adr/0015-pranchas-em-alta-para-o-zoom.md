# Pranchas em alta, inteiras e sem perda, para o zoom

Uma prancha é um desenho A0 com texto de 5 a 8 pt. Em 2560 px, o teto do ADR 0004, esse texto tem uns 6 px de altura: nenhum zoom o recupera, e foi isso que a Giordanna viu ao cadastrar a Mini Casa pelo CMS (2026-09-25). O arquivo que ela enviou era bom; o CMS o reduziu a 2560 px, e o lightbox parava de ampliar nesse tamanho.

Agora o teto do repositório é 7680 px no lado maior, que põe o texto de 8 pt com uns 18 px de altura. O site continua servindo variantes de no máximo 2560 px (`larguraMaximaDasVariantes`, em `src/imagens.ts`), na página e na tela cheia. Uma imagem maior que isso entra também inteira no `srcset` do lightbox, na largura real, sem perda nenhuma além da que o arquivo já tem (`qualidadeSemPerda`): um WebP de `src/assets/` pedido no tamanho dele sai byte a byte como está, e outro formato sai com a opção `lossless` do sharp (`src/servico-de-imagem.ts`). Ela tem no máximo 5120 px (`larguraDaInteira`), começa a baixar quando a prancha abre em tela cheia, para já estar pronta no zoom, e o zoom vai até o tamanho dela, quatro vezes a tela de um notebook. A primeira versão usava os 7680 px do arquivo: o texto ficava mais folgado, mas o zoom travava no desktop, com 42 milhões de pixels para redesenhar a cada passo (18 milhões em 5120 px), e esperar o download no meio do gesto mostrava a variante esticada e borrada.

Para traço e texto, o WebP sem perda é o menor formato que não borra: a planta da Mini Casa em 7680 px pesa 0,34 MB sem perda, 0,59 MB em WebP q90 e 0,28 MB em AVIF q65, que borra as letras e leva 20 s para gravar.

## Considered Options

- **Zoom em blocos (tiles DZI/IIIF com OpenSeadragon)**: o padrão dos museus; só baixa e decodifica o pedaço visível, e resolve de vez a memória no celular. Custa um segundo visualizador ao lado do PhotoSwipe, uns 240 arquivos por prancha (o limite do Workers é 20 mil por versão) e minutos a mais de build. Fica para quando um aparelho real mostrar que a imagem inteira não basta.
- **Servir o PDF (PDF.js) ou SVG**: o PDF.js limita o canvas a 5 MP por causa do iOS e pede `wasm-unsafe-eval` na CSP; um SVG de prancha A0 tem milhares de caminhos e o zoom fica lento no celular.
- **JPEG XL**: só o Safari decodifica sem flag em 2026.
- **Gerar variantes AVIF acima de 2560 px**: 20 s por variante por prancha, e o AVIF borra justamente o texto.

## Consequences

- A prancha inteira ocupa uns 75 MB decodificada. No iPhone, o Safari pode reduzir a resolução de uma imagem desse tamanho; isso precisa ser conferido num aparelho, e é a razão de os blocos serem a próxima opção.
- O CMS converte toda foto para WebP q90 de até 7680 px; o teto de 2 MB por arquivo continua. Uma foto maior que 2560 px ganha o mesmo zoom profundo, e o arquivo do CMS chega ao zoom como foi gravado: recomprimir sem perda um WebP q90 dobraria o peso (0,59 MB para 0,98 MB na planta da Mini Casa, 1,10 MB para 2,60 MB nos cortes).
- O ADR 0004 continua valendo, com o teto de 7680 px no lugar de 2560 px.
