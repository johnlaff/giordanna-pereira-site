/**
 * Troca o último espaço do texto por um inquebrável, para que a última palavra não caia
 * sozinha na última linha. Vale para o texto que Giordanna escreve no CMS, que não teria como
 * digitar o espaço inquebrável pelo celular.
 */
export const prenderUltimaPalavra = (texto: string): string => texto.replace(/ (\S+)$/, ' $1');
