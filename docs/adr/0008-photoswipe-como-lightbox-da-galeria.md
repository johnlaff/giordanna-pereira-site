# PhotoSwipe como lightbox da Galeria

A Galeria abre cada imagem em tela cheia com o [PhotoSwipe 5](https://photoswipe.com), a única dependência de runtime do site além do Astro. Ele entra empacotado no build — o módulo principal em chunk próprio, baixado no primeiro clique —, sem nenhuma requisição a domínio de terceiros, e o CSS dele vem do pacote, com a aparência ajustada por poucas regras em `Galeria.astro`.

O que se ganha é o que um lightbox escrito à mão custaria caro para acertar e nunca ficaria pronto: zoom por roda, duplo toque e pinça, arraste com inércia, fechar deslizando, troca de imagem em loop, foco preso no diálogo e devolvido ao fechar, e a escolha da variante do `srcset` conforme a imagem cresce no zoom. É o mesmo componente aprovado no Preview, com o mesmo comportamento que a Giordanna e o João já revisaram.

## Considered Options

- **Escrever o lightbox**: gestos de toque e a matemática de zoom/pan são a parte cara, e regridem em silêncio; o `<dialog>` nativo resolve só a moldura.
- **Outra biblioteca (GLightbox, Fancybox)**: GLightbox não tem zoom por pinça à altura; Fancybox cobra licença para uso comercial — barrado pela regra de nenhum serviço pago.

## Consequences

- O visitante baixa ~60 KB de JavaScript, e só quando clica numa imagem: nenhuma página paga por isso no primeiro carregamento.
- O lightbox reaproveita o `srcset` do `<picture>` da página, no formato que o navegador já escolheu para a miniatura — nenhuma variante extra é gerada no build, e um navegador sem AVIF recebe WebP nos dois lugares.
- O PhotoSwipe ignora um pedido de fechamento enquanto a animação de abertura corre, e no primeiro clique ainda está baixando o módulo; `Galeria.astro` cobre as duas janelas para que Esc nunca se perca.
- Uma atualização de major da biblioteca chega pelo Renovate e precisa passar pela suíte de `tests/e2e/galeria.spec.ts`, que é a especificação executável desse comportamento.
