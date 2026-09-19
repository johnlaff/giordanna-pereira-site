/**
 * O arranjo da Galeria: dadas as proporções das imagens e a largura disponível, quais imagens
 * ficam em cada linha e que caixa cada uma ocupa. As linhas são justificadas — todas ocupam a
 * largura toda, com a mesma altura dentro da linha —, do jeito que álbuns de fotos resolvem
 * imagens de proporções diferentes sem buraco no fim da linha nem corte agressivo.
 *
 * O cálculo depende da largura medida no navegador, então roda no cliente; fica fora do
 * componente por ser aritmética pura, verificável sem DOM.
 */

/** Uma imagem já posicionada: a caixa em px que ela ocupa na página. */
export interface Caixa {
  /** Posição da imagem na Galeria, na ordem do conteúdo. */
  indice: number;
  largura: number;
  altura: number;
  /** A caixa mudou a proporção da imagem, que entra recortada no centro. */
  cortada: boolean;
}

export interface Medidas {
  /** Largura útil da Galeria, em px. */
  largura: number;
  /** Espaço entre duas imagens, em px. */
  gap: number;
  /** A primeira imagem é paisagem e abre a Galeria em faixa larga: é a Abertura. */
  abertura: boolean;
}

/**
 * Quanto uma linha pode passar da altura-alvo antes de ser cortada. Sem esse teto, uma imagem
 * sozinha na última linha cresceria até a largura da Galeria e roubaria a cena das demais.
 */
export const CORTE_MAXIMO = 1.45;

/**
 * Quanto uma imagem pode perder para caber na caixa. O teto de altura da linha e a faixa de
 * abertura cedem antes de passar daqui: uma prancha cortada em mais de um quarto vira uma
 * fatia que não deixa ler o desenho, e o visitante não tem como saber que falta alguma coisa.
 */
export const RECORTE_MAXIMO = 0.25;

/** A faixa de abertura ocupa a largura toda e nunca passa de meia largura em altura. */
const ABERTURA_MAXIMA = 0.5;

/** Abaixo desta diferença de proporção o recorte é imperceptível e não vale marcar. */
const TOLERANCIA = 0.02;

/**
 * A altura que as linhas perseguem. Quanto mais estreita a Galeria, mais baixa a linha: em
 * uma tela de celular, uma linha de 380 px empurraria o resto da página para fora da vista.
 */
export const alturaAlvo = (largura: number): number =>
  largura >= 1000 ? 380 : largura >= 640 ? 300 : 230;

export function linhasDaGaleria(
  proporcoes: readonly number[],
  { largura, gap, abertura }: Medidas,
): Caixa[][] {
  if (proporcoes.length === 0 || largura <= 0) return [];
  const alvo = alturaAlvo(largura);
  const soma = (linha: readonly number[]) =>
    linha.reduce((total, indice) => total + (proporcoes[indice] ?? 0), 0);
  /** A altura em que a linha preenche a largura toda mantendo as proporções. */
  const alturaNatural = (linha: readonly number[]) =>
    (largura - (linha.length - 1) * gap) / soma(linha);

  const linhas: number[][] = [];
  let primeira = 0;
  if (abertura) {
    linhas.push([0]);
    primeira = 1;
  }
  // Uma imagem por vez: a linha fecha assim que o conjunto, na altura-alvo, alcança a largura.
  let linha: number[] = [];
  for (let indice = primeira; indice < proporcoes.length; indice++) {
    linha.push(indice);
    if (soma(linha) * alvo + (linha.length - 1) * gap >= largura) {
      linhas.push(linha);
      linha = [];
    }
  }
  if (linha.length > 0) linhas.push(linha);

  // Uma última linha curta ficaria alta demais: puxa imagens da linha anterior até equilibrar,
  // enquanto a anterior puder ceder uma sem virar ela própria uma linha curta.
  for (let tentativa = 0; tentativa < proporcoes.length && linhas.length > 1; tentativa++) {
    const ultima = linhas.at(-1)!;
    const anterior = linhas.at(-2)!;
    if (alturaNatural(ultima) <= alvo * CORTE_MAXIMO || anterior.length < 3) break;
    ultima.unshift(anterior.pop()!);
  }

  return linhas.map((linha) => {
    // A linha quer a altura em que preenche a largura com as proporções intactas; um teto a
    // segura — meia largura na Abertura, o múltiplo da altura-alvo nas demais —, e o teto de
    // recorte segura o teto. Uma imagem sozinha e muito alta esbarra na largura da Galeria.
    const naAbertura = abertura && linha[0] === 0;
    const natural = alturaNatural(linha);
    const teto = naAbertura ? largura * ABERTURA_MAXIMA : alvo * CORTE_MAXIMO;
    const altura = Math.round(
      Math.min(Math.max(Math.min(natural, teto), natural * (1 - RECORTE_MAXIMO)), largura),
    );
    // A última imagem absorve o arredondamento das demais: a linha fecha exatamente na largura.
    const disponivel = largura - (linha.length - 1) * gap;
    const total = soma(linha);
    let usado = 0;
    return linha.map((indice, posicao) => {
      const proporcao = proporcoes[indice]!;
      const larguraDaCaixa =
        posicao === linha.length - 1
          ? disponivel - usado
          : Math.floor((disponivel * proporcao) / total);
      usado += larguraDaCaixa;
      return {
        indice,
        largura: larguraDaCaixa,
        altura,
        cortada: Math.abs(larguraDaCaixa / altura - proporcao) / proporcao > TOLERANCIA,
      };
    });
  });
}
