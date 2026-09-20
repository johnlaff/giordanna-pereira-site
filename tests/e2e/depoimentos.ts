import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

/**
 * Os Depoimentos da collection, lidos do disco na ordem em que o carrossel os mostra — a do
 * nome do arquivo. A fonte da verdade dos testes é o conteúdo, não uma lista repetida nos
 * specs: um Depoimento novo entra sozinho no que deriva daqui, e um que ganhar texto deixa
 * de ser Em breve sem que nenhum teste precise mudar.
 */
export type Depoimento = {
  nome: string;
  papel: string;
  texto?: string;
};

const pasta = 'src/content/depoimentos';

export const depoimentos = readdirSync(pasta)
  .filter((arquivo) => arquivo.endsWith('.yml'))
  .sort()
  .map((arquivo) => parse(readFileSync(`${pasta}/${arquivo}`, 'utf8')) as Depoimento);
