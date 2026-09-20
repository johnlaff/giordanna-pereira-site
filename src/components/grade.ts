/**
 * As medidas da Grade de projetos: quanto cada card ocupa e que tamanho de imagem ele pede.
 *
 * A grade é de três colunas e o número de Projetos quase nunca é múltiplo de três — sobram um
 * ou dois na última linha. Em vez de deixar o buraco no fim, a sobra vira destaque no começo:
 * sobrando um, o primeiro Projeto ocupa a linha inteira; sobrando dois, os dois primeiros
 * ocupam meia linha cada. Assim toda linha fecha e a Grade abre pelo Projeto de menor Ordem,
 * que é o que Giordanna quer mostrar primeiro.
 *
 * Em duas colunas o mesmo raciocínio se repete com paridade em vez de resto: com um número
 * ímpar de Projetos, o primeiro ocupa as duas colunas e os demais entram aos pares.
 *
 * É aritmética pura, fora do componente, para ser verificável sem DOM: é ela que decide o
 * `sizes` de cada card, e um erro aqui faz o navegador baixar a variante errada da imagem.
 */
// A extensão é explícita porque o teste de unidade carrega este módulo pelo runner do Node,
// que resolve como ESM e não tem o bundler do Astro para adivinhá-la.
import { porFaixa } from './galeria.linhas.ts';

/** Quanto um card ocupa na grade de três colunas do desktop. */
export type LarguraNaGrade = 'terco' | 'metade' | 'inteira';

export interface LugarNaGrade {
  largura: LarguraNaGrade;
  /** Em duas colunas este card ocupa as duas: só o primeiro, e só com um total ímpar. */
  dobraEmDuasColunas: boolean;
  /** A largura que o card ocupa em cada faixa de tela, para o navegador escolher a variante. */
  sizes: string;
}

/** Onde a grade deixa de ter três colunas e onde deixa de ter duas. */
export const TRES_COLUNAS = 1001;
export const DUAS_COLUNAS = 561;

/**
 * As faixas de tela de cada largura, de cima para baixo. As medidas descontam a margem lateral
 * da `.shell` (24, 40 ou 52 px conforme a tela) e o espaço entre cards (`clamp(14px, 2vw, 26px)`),
 * porque é a caixa do card, e não a tela, que decide a variante baixada.
 */
const EM_TRES_COLUNAS: Record<LarguraNaGrade, readonly (readonly [string, string])[]> = {
  inteira: [
    ['(min-width: 1240px)', '1136px'],
    ['(min-width: 1100px)', 'calc(100vw - 104px)'],
    ['(min-width: 1001px)', 'calc(100vw - 80px)'],
  ],
  metade: [
    ['(min-width: 1240px)', '555px'],
    ['(min-width: 1100px)', 'calc((100vw - 104px - 2vw) / 2)'],
    ['(min-width: 1001px)', 'calc((100vw - 80px - 2vw) / 2)'],
  ],
  terco: [
    ['(min-width: 1240px)', '361px'],
    ['(min-width: 1100px)', 'calc((100vw - 104px - 4vw) / 3)'],
    ['(min-width: 1001px)', 'calc((100vw - 80px - 4vw) / 3)'],
  ],
};

/** Em duas colunas só há duas larguras possíveis: a coluna, ou a linha inteira. */
const EM_DUAS_COLUNAS = {
  coluna: [
    ['(min-width: 700px)', 'calc((100vw - 98px) / 2)'],
    ['(min-width: 561px)', 'calc((100vw - 62px) / 2)'],
  ],
  linha: [
    ['(min-width: 700px)', 'calc(100vw - 80px)'],
    ['(min-width: 561px)', 'calc(100vw - 48px)'],
  ],
} as const;

/** Numa coluna só, todo card ocupa a largura da tela menos a margem lateral. */
const EM_UMA_COLUNA = [['', 'calc(100vw - 48px)']] as const;

/**
 * O lugar de um Projeto na Grade, pela posição dele na Ordem e pelo total de Projetos.
 * `indice` é a posição na sequência ordenada, contada de zero.
 */
export const lugarNaGrade = (indice: number, total: number): LugarNaGrade => {
  const sobra = total % 3;
  const largura: LarguraNaGrade =
    sobra === 1 && indice === 0 ? 'inteira' : sobra === 2 && indice < 2 ? 'metade' : 'terco';
  const dobraEmDuasColunas = total % 2 === 1 && indice === 0;

  return {
    largura,
    dobraEmDuasColunas,
    sizes: porFaixa([
      ...EM_TRES_COLUNAS[largura],
      ...(dobraEmDuasColunas ? EM_DUAS_COLUNAS.linha : EM_DUAS_COLUNAS.coluna),
      ...EM_UMA_COLUNA,
    ]),
  };
};
