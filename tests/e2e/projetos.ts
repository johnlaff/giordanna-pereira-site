import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

/**
 * Os Projetos da collection, lidos do disco e postos na Ordem. A fonte da verdade dos testes
 * é o conteúdo, não uma lista repetida nos specs: um Projeto novo — inclusive cadastrado no
 * CMS — entra sozinho em tudo que deriva daqui.
 */
export type Projeto = {
  titulo: string;
  tipo: string;
  descricao: string;
  ferramentas: string[];
  local: string;
  ano: string;
  area: string;
  equipe: string;
  equipeUrl?: string;
  /** Sem Capa, a primeira imagem da Galeria representa o Projeto. */
  capa?: string;
  galeria: string[];
  ordem: number;
};

const pasta = 'src/content/projetos';

export const projetos = readdirSync(pasta)
  .filter((arquivo) => arquivo.endsWith('.yml'))
  .map((arquivo) => {
    const slug = arquivo.replace(/\.yml$/, '');
    return {
      slug,
      rota: `/projetos/${slug}`,
      dados: parse(readFileSync(`${pasta}/${arquivo}`, 'utf8')) as Projeto,
    };
  })
  // Empate na Ordem sai pelo nome do arquivo, como em `ordenarProjetos`.
  .sort(
    (a, b) => a.dados.ordem - b.dados.ordem || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );

/**
 * O Projeto tem imagem para mostrar fora da própria página: a Capa definida no arquivo ou,
 * sem ela, a primeira da Galeria. É a mesma regra de `capaDe`, em `src/content.schema.ts`.
 */
export const temCapa = ({ dados }: { dados: Projeto }): boolean =>
  dados.capa !== undefined || dados.galeria.length > 0;
