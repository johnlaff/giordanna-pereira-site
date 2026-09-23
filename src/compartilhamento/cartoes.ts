/**
 * Os Cartões de compartilhamento do site: a imagem 1200×630 que o WhatsApp, o LinkedIn e os
 * demais mostram quando alguém cola um link (as tags Open Graph de `Base.astro` apontam para
 * ela). Um por rota pública, gerados no build a partir do conteúdo: um Projeto cadastrado no
 * CMS ganha o seu no mesmo build em que ganha página.
 *
 * Este módulo só decide o que cada Cartão diz e sobre qual imagem; quem desenha é
 * `desenho.ts`, e quem grava no build é `integracao.ts`. Fica sem o sharp e sem o runtime do
 * Astro para o teste de unidade carregá-lo direto.
 */
// A extensão é explícita porque o teste de unidade carrega este módulo pelo runner do Node.
import { contato, hero, projetos as grade } from '../config.ts';
import { rotaDoProjeto } from '../rotas.ts';

export type Cartao = {
  /** Onde o Cartão é publicado, relativo à raiz do site. */
  arquivo: string;
  /** A imagem de fundo, relativa à raiz do projeto. Sem ela, o Cartão é o do estado Em breve. */
  fundo?: string;
  /**
   * Onde o recorte do fundo cai na vertical, de 0 (topo) a 1 (base): a imagem cobre o Cartão
   * inteiro e o que sobra de altura é cortado nesta proporção. O padrão, 0,4, é o do Preview.
   */
  enquadramento?: number;
  /** A linha curta acima do título: o Tipo do Projeto, ou o nome da página. */
  olho?: string;
  titulo: string;
  /** A continuação do título em tom mais claro, como no hero da home. */
  enfase?: string;
  /** A linha abaixo do título. */
  subtitulo?: string;
  /** O corpo do título em px. O padrão, 84, é o de um nome de Projeto; frase longa pede menos. */
  corpo?: number;
};

/**
 * O endereço do Cartão de uma rota. A home não tem nome no caminho e fica com `home`; o de
 * cada Projeto mora na pasta dos Projetos, como a página, para um slug nunca disputar o
 * Cartão de outra página do site.
 */
export const caminhoDoCartao = (rota: string): string => `/og${rota === '/' ? '/home' : rota}.jpg`;

const arquivoDoCartao = (rota: string): string => caminhoDoCartao(rota).slice(1);

type ProjetoDoCartao = {
  id: string;
  data: { titulo: string; tipo: string; capa?: string | undefined; galeria: readonly string[] };
};

/** A imagem que representa o Projeto: a mesma regra de `capaDe`, em `content.schema.ts`. */
const fundoDe = ({ data }: ProjetoDoCartao): { fundo?: string } => {
  const fundo = data.capa ?? data.galeria[0];
  return fundo === undefined ? {} : { fundo };
};

/**
 * Os Cartões do site, na ordem do sitemap: a home, a Grade, cada Projeto e o contato. Os
 * Projetos chegam já na Ordem, com as imagens como caminhos relativos à raiz do projeto.
 *
 * A home e o contato usam os renders do Preview; a Grade, a Capa do Projeto que a abre.
 */
export const cartoesDoSite = (projetos: readonly ProjetoDoCartao[]): Cartao[] => [
  {
    arquivo: arquivoDoCartao('/'),
    fundo: 'src/assets/hero.webp',
    enquadramento: 0.3,
    titulo: hero.titulo,
    enfase: hero.enfase,
    subtitulo: 'Arquiteta e urbanista · Uberlândia, MG',
  },
  {
    arquivo: arquivoDoCartao('/projetos'),
    ...(projetos[0] === undefined ? {} : fundoDe(projetos[0])),
    titulo: grade.titulo,
    subtitulo: 'Arquitetura, habitação, interiores e documentação executiva.',
  },
  ...projetos.map((projeto) => ({
    arquivo: arquivoDoCartao(rotaDoProjeto(projeto.id)),
    ...fundoDe(projeto),
    olho: projeto.data.tipo,
    titulo: projeto.data.titulo,
  })),
  {
    arquivo: arquivoDoCartao('/contato'),
    fundo: 'src/assets/vitalis-d09.webp',
    olho: contato.titulo,
    titulo: contato.chamada.join(' '),
    corpo: 70,
  },
];
