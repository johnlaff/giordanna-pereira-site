/**
 * Troca o último espaço do texto por um inquebrável, para que a última palavra não caia
 * sozinha na última linha. Vale para o texto que Giordanna escreve no CMS, que não teria como
 * digitar o espaço inquebrável pelo celular.
 */
export const prenderUltimaPalavra = (texto: string): string => texto.replace(/ (\S+)$/, ' $1');

/**
 * O texto de uma caixa de várias linhas do CMS em parágrafos: cada linha que Giordanna digita é
 * um parágrafo, e linhas em branco não viram parágrafo vazio. Cada um sai com a última palavra
 * presa.
 */
export const emParagrafos = (texto: string): string[] =>
  texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha !== '')
    .map(prenderUltimaPalavra);
