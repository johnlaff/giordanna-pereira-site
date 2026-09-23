/**
 * Os dados estruturados (JSON-LD, vocabulário do schema.org) que o buscador lê nas páginas:
 * Giordanna como `Person` na home e cada Projeto como `CreativeWork` na sua página.
 *
 * As URLs saem de `site`, a forma canônica (ADR 0007), como no sitemap e no Compartilhe. A
 * imagem de um Projeto é o seu Cartão de compartilhamento: é a única imagem com endereço fixo
 * — as variantes do Astro levam um hash no nome — e existe até para o Projeto Em breve.
 */
// A extensão é explícita porque o teste de unidade carrega este módulo pelo runner do Node.
import { contatos, emailExibido, marca, pessoa, site as dadosDoSite } from '../config.ts';
import { rotaDoProjeto } from '../rotas.ts';
import { caminhoDoCartao } from './cartoes.ts';

/** Os perfis de Giordanna fora do site. O WhatsApp é um canal, não um perfil. */
const perfis = contatos
  .filter(({ tipo }) => tipo === 'linkedin' || tipo === 'behance')
  .map(({ href }) => href);

const giordanna = (site: URL) => ({
  '@type': 'Person' as const,
  name: marca.nome,
  url: new URL('/', site).href,
});

export const dadosDaPessoa = (site: URL) => ({
  '@context': 'https://schema.org' as const,
  ...giordanna(site),
  jobTitle: pessoa.profissao,
  description: dadosDoSite.descricao,
  email: emailExibido,
  address: {
    '@type': 'PostalAddress' as const,
    addressLocality: pessoa.cidade,
    addressRegion: pessoa.estado,
    addressCountry: 'BR',
  },
  sameAs: perfis,
});

/** O que o CreativeWork lê de um Projeto: um recorte dos campos da collection. */
type Obra = {
  titulo: string;
  tipo: string;
  descricao: string;
  local: string;
  ano: string;
  equipe: string;
};

/**
 * O Projeto como obra. A Equipe entra como crédito, em texto, porque é assim que o CMS a
 * guarda; Giordanna entra como colaboradora, o papel que ela tem em todo Projeto do
 * portfólio, mesmo nos que outra pessoa assina. O Ano é texto livre ("2025 (acadêmico)"), e só
 * o ano do começo vira data.
 */
export const dadosDoProjeto = (slug: string, obra: Obra, site: URL) => {
  const [ano] = /^\d{4}\b/.exec(obra.ano) ?? [];
  return {
    '@context': 'https://schema.org' as const,
    '@type': 'CreativeWork' as const,
    name: obra.titulo,
    description: obra.descricao,
    genre: obra.tipo,
    url: new URL(rotaDoProjeto(slug), site).href,
    image: new URL(caminhoDoCartao(rotaDoProjeto(slug)), site).href,
    creditText: obra.equipe,
    contributor: giordanna(site),
    locationCreated: { '@type': 'Place' as const, name: obra.local },
    ...(ano === undefined ? {} : { dateCreated: ano }),
    inLanguage: 'pt-BR',
  };
};

/**
 * O JSON-LD pronto para ir dentro de um `<script>`. Nenhum campo do CMS aceita `<`, mas o
 * escape não depende disso: um `</script>` no texto fecharia o bloco e viraria HTML.
 */
export const jsonLd = (dados: object): string => JSON.stringify(dados).replace(/</g, '\\u003c');
