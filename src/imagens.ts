/**
 * O que decide as variantes de imagem geradas no build. Mora num arquivo só seu porque a
 * esteira usa este caminho na chave do cache de variantes: mudar a qualidade aqui regera o
 * acervo inteiro — e mudar um contato ou um texto em `config.ts` não pode custar isso.
 */

/**
 * Qualidade das variantes, a mesma para AVIF e WebP: o Astro aplica um número só aos dois.
 * Medido nos renders e pranchas do Consultório GinecoCare (2026-09): a nitidez do AVIF empaca
 * a partir de 60 — 95% de um redimensionamento sem perda, contra 97% na qualidade 80 pesando
 * 70% mais —, e o WebP, alternativa de quem não tem AVIF, fica igual acima de 55.
 */
export const qualidadeDeImagem = 65;

/**
 * Quanto o compressor de AVIF procura antes de gravar o arquivo. Não é qualidade: o alvo de
 * qualidade é o número acima, e o esforço só decide quanto tempo o compressor gasta tentando
 * alcançá-lo com menos bytes.
 *
 * É daqui que vem o tempo de build. O AVIF responde por 96,6% do trabalho de imagem — 3903
 * dos 4040 segundos de CPU do build medido em 2026-09-20 —, e o padrão do sharp, 4, é
 * patológico neste acervo: ele procura cinco vezes mais que o 3 e grava um arquivo do mesmo
 * tamanho. Gravando a variante de 2560 px de seis imagens do site:
 *
 * | esforço | tempo por imagem | peso por imagem |
 * | ------- | ---------------- | --------------- |
 * | 0       | 0,31 s           | 295 kB          |
 * | 1       | 0,85 s           | 273 kB          |
 * | 2       | 1,36 s           | 274 kB          |
 * | 3       | 2,11 s           | 270 kB          |
 * | 4       | 10,62 s          | 272 kB          |
 *
 * E no acervo inteiro, com a escada de larguras que o site usa de verdade:
 *
 * | esforço | ritmo do build   | peso do conjunto AVIF |
 * | ------- | ---------------- | --------------------- |
 * | 1       | 14,4 variantes/s | +2,3%                 |
 * | 2       | 10,6 variantes/s | +2,4%                 |
 * | 3       | 7,1 variantes/s  | +0,7%                 |
 * | 4       | 1,8 variantes/s  | referência            |
 *
 * O 3 é a escolha: quase quatro vezes o ritmo do padrão sem custar bytes ao visitante. Os dois
 * esforços mais baratos são mais rápidos, mas cobram o mesmo pedágio — +2,3% no 1 e +2,4% no
 * 2, contra +0,7% no 3 —, e aí o build passa a ser pago em peso de página, que é o que o
 * orçamento do Lighthouse defende. O tempo de build se paga uma vez por build; o peso, em
 * toda visita.
 *
 * O esforço não entra no nome do arquivo gerado, ao contrário da qualidade: mudá-lo sozinho
 * não regera nada, porque as variantes em cache continuam válidas e servidas como estão — o
 * número novo só vale para variantes inéditas. Para regerar o acervo é preciso mexer na
 * qualidade ou limpar o cache.
 */
export const esforcoDoAvif = 3;

/**
 * O serviço que grava as variantes no build. O `entrypoint` é um arquivo nosso, e não o do
 * próprio Astro, pelo motivo explicado em `src/servico-de-imagem.ts`: é o único jeito de o
 * `config` abaixo sobreviver ao adapter da Cloudflare.
 */
export const servicoDeImagem = {
  entrypoint: './src/servico-de-imagem.ts',
  config: { avif: { effort: esforcoDoAvif } },
};
