/**
 * Contrato do conteúdo dos Projetos: a forma de cada arquivo e a invariante de Ordem única
 * entre eles. As duas garantias valem no build e mudam pelo mesmo motivo — uma mudança no
 * que é um Projeto —, por isso moram juntas.
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
