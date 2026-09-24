/**
 * Contrato do conteúdo editável: a forma de cada arquivo que Giordanna edita no CMS — Projeto,
 * Depoimento, Sobre e Familiaridade —, as invariantes entre eles — a Ordem única dos Projetos,
 * a sequência dos Depoimentos, os níveis da Familiaridade — e as leituras que derivam delas: a
 * sequência, os vizinhos de cada Projeto, a Capa e a ordem da Familiaridade. Tudo vale no build
 * e muda pelo mesmo motivo — uma mudança no que o CMS deixa editar —, por isso mora junto.
 *
 * O módulo fica fora de `content.config.ts` para o teste de contrato carregá-lo sem o runtime
 * do Astro: o validador de imagem entra por parâmetro, e é o `image()` do Astro em produção
 * e um dublê nos testes.
 */
import { z } from 'astro/zod';

/** Uma regra de forma de um campo e o que dizer a quem a quebrou. */
export type Padrao = { regex: RegExp; mensagem: string };

/**
 * As regras de forma dos campos, escritas uma vez para as duas barreiras: o formulário do CMS,
 * que barra o erro antes do commit (`src/admin/configuracao.ts`), e este schema, que barra o
 * build se algo passar por fora do CMS (ADR 0002). As mensagens falam com Giordanna, que é
 * quem as lê no CMS.
 */
export const padroes = {
  /** Nenhum campo aceita HTML: o que precisa virar link tem um campo de URL próprio. */
  semHtml: {
    regex: /^[^<>]*$/,
    mensagem: 'Não use os sinais < e >: o campo não aceita HTML. Links vão no campo de link.',
  },
  /** O número como se escreve no Brasil — milhar com ponto, decimal com vírgula — e o m². */
  area: {
    regex: /^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})? m²$/,
    mensagem:
      'Escreva a área como 46,88 m² ou 1.125,54 m²: milhar com ponto e decimal com vírgula.',
  },
  /** O ano da obra ou do projeto; "(acadêmico)" marca o que foi feito na faculdade. */
  ano: {
    regex: /^\d{4}(?: \(acadêmico\))?$/,
    mensagem: 'Escreva o ano com quatro dígitos, como 2025, ou 2025 (acadêmico).',
  },
} satisfies Record<string, Padrao>;

/**
 * Campo de texto editado no CMS. Nenhum aceita HTML, para que uma colagem de editor de texto
 * rico não chegue à página.
 */
const texto = () =>
  z
    .string()
    .trim()
    .min(1, 'não pode ficar em branco')
    .regex(padroes.semHtml.regex, padroes.semHtml.mensagem);

export const esquemaDeProjeto = <T extends z.ZodType>(imagem: () => T) =>
  z.object({
    titulo: texto(),
    tipo: texto(),
    /** Sem Capa, a primeira imagem da Galeria representa o Projeto. */
    capa: imagem().optional(),
    descricao: texto(),
    ferramentas: z.array(texto()).min(1, 'liste ao menos uma Ferramenta'),
    local: texto(),
    ano: texto().regex(padroes.ano.regex, padroes.ano.mensagem),
    area: texto().regex(padroes.area.regex, padroes.area.mensagem),
    equipe: texto(),
    equipeUrl: z.url({ protocol: /^https$/ }).optional(),
    /**
     * Renders primeiro, pranchas por último. Vazia é o estado Em breve, e ausente é o mesmo que
     * vazia: o CMS não grava campo opcional em branco.
     */
    galeria: z.array(imagem()).default([]),
    ordem: z.int(),
  });

export const esquemaDeDepoimento = () =>
  z.object({
    nome: texto(),
    papel: texto(),
    /** Sem texto, o Depoimento está cadastrado e aguardando: é o estado Em breve. */
    texto: texto().optional(),
  });

/**
 * O Sobre da home: a apresentação em parágrafos e a grade de Credenciais. O título da seção e
 * o retrato ficam na configuração tipada (`src/config.ts`); daqui vem só o que muda com a
 * carreira dela.
 */
export const esquemaDeSobre = () =>
  z.object({
    paragrafos: z.array(texto()).min(1, 'escreva ao menos um parágrafo'),
    credenciais: z
      .array(
        z.object({
          rotulo: texto(),
          /** Cada linha vira uma linha no site, na mesma ordem. */
          linhas: z.array(texto()).min(1, 'escreva ao menos uma linha'),
        }),
      )
      .min(1, 'liste ao menos uma Credencial'),
  });

/** Os três níveis da Familiaridade: 1 é o de maior domínio, e o bloco mais escuro. */
export const NIVEIS = [1, 2, 3] as const;
export type Nivel = (typeof NIVEIS)[number];

/** A Familiaridade da home: os softwares que Giordanna domina, cada um com o seu nível. */
export const esquemaDeFamiliaridade = () =>
  z.object({
    itens: z
      .array(z.object({ nome: texto(), nivel: z.literal(NIVEIS) }))
      .min(1, 'liste ao menos uma ferramenta'),
  });

/**
 * A Familiaridade na tela vai do maior nível para o menor, porque a ordem repete o que a cor
 * diz. Dentro de um nível, vale a ordem em que Giordanna escreveu: quem acrescenta uma
 * ferramenta no fim da lista não precisa achar o lugar dela.
 */
export function ordenarFamiliaridade<T extends { nivel: Nivel }>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => a.nivel - b.nivel);
}

type DepoimentoOrdenavel = { id: string };

/**
 * A sequência dos Depoimentos no carrossel, que é a do nome do arquivo — daí o prefixo
 * numérico de `src/content/depoimentos/`. Um Depoimento não tem Ordem própria como o Projeto
 * porque nada mais depende da posição dele: ela não vira URL nem navegação, só a vez de
 * aparecer. A comparação é byte a byte, e não por locale, para que a sequência do build seja
 * a mesma em qualquer máquina.
 */
export function ordenarDepoimentos<T extends DepoimentoOrdenavel>(depoimentos: readonly T[]): T[] {
  return [...depoimentos].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

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
