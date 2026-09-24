import { getEntry, type CollectionEntry } from 'astro:content';

/**
 * Um dos blocos da home que Giordanna edita no CMS: o arquivo único da collection de mesmo
 * nome, em `src/content/home/`. Sem ele a home ficaria sem o bloco, então o build quebra.
 */
export async function lerDaHome<C extends 'sobre' | 'familiaridade'>(
  colecao: C,
): Promise<CollectionEntry<C>['data']> {
  const entrada = await getEntry(colecao, colecao);
  if (!entrada)
    throw new Error(
      `src/content/home/${colecao}.yml não existe: a home precisa dele para o bloco ${colecao}.`,
    );
  return entrada.data;
}
