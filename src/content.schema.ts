/**
 * Contrato do conteúdo dos Projetos: a forma de cada arquivo, a invariante de Ordem única
 * entre eles e as leituras que derivam das duas — a sequência, os vizinhos de cada Projeto e
 * a Capa. Tudo vale no build e muda pelo mesmo motivo — uma mudança no que é um Projeto —,
 * por isso mora junto.
 *
 * O módulo fica fora de `content.config.ts` para o teste de contrato carregá-lo sem o runtime
 * do Astro: o validador de imagem entra por parâmetro, e é o `image()` do Astro em produção
 * e um dublê nos testes.
 */
import { z } from 'astro/zod';

/**
 * Campo de texto editado no CMS. Nenhum aceita HTML: o que precisa virar link tem um campo
 * de URL próprio, para que uma colagem de editor de texto rico não chegue à página.
 */
const texto = () =>
  z
    .string()
    .trim()
    .min(1, 'não pode ficar em branco')
    .regex(/^[^<>]*$/, 'não aceita HTML: use o campo de URL para links');

export const esquemaDeProjeto = <T extends z.ZodType>(imagem: () => T) =>
  z.object({
    titulo: texto(),
    tipo: texto(),
    /** Sem Capa, a primeira imagem da Galeria representa o Projeto. */
    capa: imagem().optional(),
    descricao: texto(),
    ferramentas: z.array(texto()).min(1, 'liste ao menos uma Ferramenta'),
    local: texto(),
    ano: texto(),
    area: texto(),
    equipe: texto(),
    equipeUrl: z.url({ protocol: /^https$/ }).optional(),
    /** Renders primeiro, pranchas por último. Vazia é o estado Em breve. */
    galeria: z.array(imagem()),
    ordem: z.int(),
  });

type ProjetoOrdenavel = { id: string; data: { ordem: number } };

/**
 * A Ordem posiciona o Projeto na grade e na navegação anterior/próximo, então precisa ser
 * única: duas Ordens iguais deixariam a sequência à mercê da ordem de leitura dos arquivos.
 * Chamada no build, uma duplicata derruba a publicação em vez de embaralhar o site.
 */
export function ordenarProjetos<T extends ProjetoOrdenavel>(projetos: readonly T[]): T[] {
  const vistos = new Map<number, string>();
  for (const projeto of projetos) {
    const anterior = vistos.get(projeto.data.ordem);
    if (anterior !== undefined)
      throw new Error(
        `Ordem ${projeto.data.ordem} repetida em "${anterior}" e "${projeto.id}": cada Projeto precisa de uma Ordem única.`,
      );
    vistos.set(projeto.data.ordem, projeto.id);
  }
  return [...projetos].sort((a, b) => a.data.ordem - b.data.ordem);
}

type ProjetoIlustrado<T> = { data: { capa?: T | undefined; galeria: readonly T[] } };

/**
 * A imagem que representa o Projeto fora da sua página. Sem Capa própria, é a primeira da
 * Galeria; sem Galeria nenhuma, o Projeto está Em breve e não tem imagem para mostrar.
 */
export function capaDe<T>({ data }: ProjetoIlustrado<T>): T | undefined {
  return data.capa ?? data.galeria[0];
}

/**
 * Os Projetos vizinhos na Ordem, para a navegação ao pé da página. A sequência é circular —
 * do último se volta ao primeiro —, e não existe quando não há para onde navegar: menos de
 * dois Projetos, ou um índice fora da lista.
 */
export function vizinhosNaOrdem<T>(
  projetos: readonly T[],
  indice: number,
): { anterior: T; proximo: T } | undefined {
  const total = projetos.length;
  const anterior = projetos[(indice - 1 + total) % total];
  const proximo = projetos[(indice + 1) % total];
  if (total < 2 || anterior === undefined || proximo === undefined) return undefined;
  return { anterior, proximo };
}
