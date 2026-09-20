/**
 * Configuração tipada do site: o que a home, o cabeçalho, o rodapé e a página de contato
 * exibem e que não passa pelo CMS. Fica em código por decisão (HANDOFF §12).
 */

export const site = {
  nome: 'Giordanna Pereira Arquitetura',
  descricao:
    'Giordanna Pereira — arquiteta e urbanista em Uberlândia, MG. Arquitetura, habitação, interiores e documentação executiva.',
  url: 'https://giordannapereira.arq.br',
} as const;

/** Marca em texto (nome + CAU) até o logo definitivo existir. */
export const marca = {
  nome: 'Giordanna Pereira',
  cau: 'CAU nº A333733-2',
  area: 'Arquitetura',
} as const;

/**
 * E-mail exibido no site. Constante única: Contatos, rodapé e a alternativa do formulário leem daqui.
 * Passa a `contato@giordannapereira.arq.br` no lançamento (#16).
 */
export const emailExibido = 'giordannapb.arq@gmail.com';

export type TipoContato = 'whatsapp' | 'linkedin' | 'behance' | 'email';

export type Contato = {
  tipo: TipoContato;
  rotulo: string;
  href: string;
  /** Texto legível do canal, exibido na página de contato. */
  texto: string;
  /** Abre em nova aba (canais fora do site). */
  externo: boolean;
};

export const contatos: readonly Contato[] = [
  {
    tipo: 'whatsapp',
    rotulo: 'WhatsApp',
    href: 'https://wa.me/5534999461403',
    texto: '+55 34 99946-1403',
    externo: true,
  },
  {
    tipo: 'linkedin',
    rotulo: 'LinkedIn',
    href: 'https://www.linkedin.com/in/giordannapb',
    texto: 'linkedin.com/in/giordannapb',
    externo: true,
  },
  {
    tipo: 'behance',
    rotulo: 'Behance',
    href: 'https://behance.net/giordannaborges',
    texto: 'behance.net/giordannaborges',
    externo: true,
  },
  {
    tipo: 'email',
    rotulo: 'E-mail',
    href: `mailto:${emailExibido}`,
    texto: emailExibido,
    externo: false,
  },
];

/**
 * O hero da home. `titulo` e `destaque` são as duas linhas do h1; o destaque é a segunda,
 * em tom mais claro. O espaço fino antes de "executivo" é um espaço inquebrável: a palavra
 * não pode cair sozinha na última linha.
 */
export const hero = {
  titulo: 'Espaços projetados',
  destaque: 'para viver.',
  subtitulo:
    'Arquiteta e Urbanista e Técnica em Edificações, integrando metodologia BIM do estudo preliminar ao detalhamento executivo.',
  /** Descrição do render para quem não vê a imagem de fundo. */
  alt: 'Render do Edifício Vitalis: fachada curva com brises de madeira entre árvores.',
  legenda: 'Edifício Vitalis, projeto acadêmico na UFU · Uberlândia, MG',
  dica: 'Role para explorar',
} as const;

/** Uma linha da grade de credenciais do Sobre: um rótulo curto e o que ele reúne. */
export type Credencial = { rotulo: string; texto: readonly string[] };

export const sobre = {
  titulo: 'Pronta para',
  destaque: 'somar.',
  retratoAlt: 'Retrato de Giordanna Pereira com capacete de obra',
  paragrafos: [
    'Arquiteta e Urbanista formada pela Universidade Federal de Uberlândia e Técnica em Edificações pelo CEFET - MG, com três anos de experiência prática em três escritórios, da criação à documentação executiva de projetos residenciais e comerciais.',
    'Meu trabalho é pautado pela busca constante por soluções criativas e eficientes, sempre atenta às necessidades específicas e expectativas dos meus clientes. Acredito que a flexibilidade e diversidade são fundamentais, o que me permite desenvolver projetos adaptáveis e personalizados para cada perfil.',
  ],
  credenciais: [
    {
      rotulo: 'Formação',
      texto: ['Técnico em Edificações · CEFET - MG', 'Arquitetura e Urbanismo · UFU'],
    },
    { rotulo: 'Atuação', texto: ['Uberlândia, Araxá · presencial, híbrido', 'Brasil · remoto'] },
    { rotulo: 'Projetos', texto: ['Residenciais e comerciais'] },
    {
      rotulo: 'Serviços',
      texto: ['Medição, modelagem, documentação, renderização, consultoria, reforma, interiores'],
    },
  ] as readonly Credencial[],
} as const;

/**
 * Familiaridade: os softwares que Giordanna domina, em três níveis, do maior para o menor.
 * É independente das Ferramentas de cada Projeto — o Pacote Office e o AutoCAD entram aqui
 * e nenhum Projeto os lista.
 */
export type Nivel = 1 | 2 | 3;
export type Ferramenta = { nome: string; nivel: Nivel };

export const familiaridade: readonly Ferramenta[] = [
  { nome: 'Archicad', nivel: 1 },
  { nome: 'SketchUp + Layout', nivel: 2 },
  { nome: 'Enscape', nivel: 2 },
  { nome: 'Pacote Office', nivel: 2 },
  { nome: 'Revit', nivel: 3 },
  { nome: 'AutoCAD', nivel: 3 },
  { nome: 'V-Ray', nivel: 3 },
  { nome: 'Adobe Ai · Ps · Id', nivel: 3 },
];

/** O convite que fecha a home. */
export const chamada = {
  titulo: 'Conheça mais',
  destaque: 'do meu trabalho.',
  rotulo: 'Ver projetos',
  href: '/projetos',
} as const;
