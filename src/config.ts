import { MINIMO_DA_MENSAGEM } from './contato/mensagem.ts';

/**
 * Configuração tipada do site: o que a home, o cabeçalho, o rodapé e a página de contato
 * exibem e que não passa pelo CMS. Fica em código por decisão (HANDOFF §12); do Sobre e da
 * Familiaridade, só a moldura mora aqui.
 */

export const site = {
  nome: 'Giordanna Pereira Arquitetura',
  /**
   * O título da home, que é o que o buscador mostra quando procuram por ela: o nome, a
   * profissão e a cidade, nas palavras de quem busca ("arquiteta Uberlândia").
   */
  titulo: 'Giordanna Pereira · Arquiteta e Urbanista em Uberlândia, MG',
  descricao:
    'Giordanna Pereira, arquiteta e urbanista em Uberlândia, MG, com projetos para todo o Brasil: residenciais, comerciais, interiores e documentação executiva em BIM.',
  url: 'https://giordannapereira.arq.br',
} as const;

/** Marca em texto (nome + CAU) até o logo definitivo existir. */
export const marca = {
  nome: 'Giordanna Pereira',
  cau: 'CAU nº A333733-2',
  area: 'Arquitetura',
} as const;

/**
 * Quem é Giordanna em poucas palavras: o que o Cartão de compartilhamento da home escreve sob o
 * título e o que os dados estruturados da home dizem dela.
 */
export const pessoa = {
  profissao: 'Arquiteta e urbanista',
  cidade: 'Uberlândia',
  estado: 'MG',
  /**
   * As cidades onde ela atende em pessoa, as mesmas da credencial "Atuação" do Sobre, que diz
   * também do trabalho remoto para o Brasil todo.
   */
  cidadesDeAtuacao: ['Uberlândia', 'Araxá'],
  /** Onde ela estudou, como a credencial "Formação" do Sobre. */
  formacao: ['Universidade Federal de Uberlândia', 'CEFET-MG'],
  /** Os assuntos do trabalho dela, como o buscador os lê. */
  areas: [
    'Arquitetura',
    'Urbanismo',
    'Projeto residencial',
    'Projeto comercial',
    'Design de interiores',
    'Documentação executiva',
    'BIM',
    'Habitação de interesse social',
  ],
  /** Perfis dela fora do site que não são canal de Contato, e por isso não estão em `contatos`. */
  outrosPerfis: ['https://www.instagram.com/giordannapb'],
} as const;

/**
 * Como o site nomeia uma página: o nome dela e o do site, e o título próprio na home. Fica aqui
 * porque não é só o título da aba — é o mesmo par que viaja no que se compartilha.
 */
export const tituloDaPagina = (titulo?: string): string =>
  titulo ? `${titulo} — ${site.nome}` : site.titulo;

/**
 * E-mail exibido no site. Constante única: Contatos, rodapé e a alternativa do formulário leem daqui.
 * É o do domínio: o Email Routing da Cloudflare entrega no Gmail dela, que não aparece no site.
 */
export const emailExibido = 'contato@giordannapereira.arq.br';

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
 * O hero da home. `titulo` e `enfase` são as duas linhas do h1; a ênfase é a segunda, em tom
 * mais claro. O espaço antes de "executivo" é inquebrável: a palavra não pode cair sozinha
 * na última linha.
 */
export const hero = {
  titulo: 'Espaços projetados',
  enfase: 'para viver.',
  subtitulo:
    'Arquiteta e Urbanista e Técnica em Edificações, integrando metodologia BIM do estudo preliminar ao detalhamento executivo.',
  /** Descrição do render para quem não vê a imagem de fundo. */
  alt: 'Render do Edifício Vitalis: fachada curva com brises de madeira entre árvores.',
  legenda: 'Edifício Vitalis, projeto acadêmico na UFU · Uberlândia, MG',
  dica: 'Role para explorar',
} as const;

/**
 * A moldura do Sobre: o título e o retrato. A apresentação e as Credenciais vêm do CMS
 * (`src/content/home/sobre.yml`).
 */
export const sobre = {
  titulo: 'Pronta para',
  enfase: 'somar.',
  retratoAlt: 'Retrato de Giordanna Pereira com capacete de obra',
} as const;

/**
 * A moldura da Familiaridade. Os softwares e os níveis vêm do CMS
 * (`src/content/home/familiaridade.yml`).
 */
export const familiaridade = {
  titulo: 'Ferramentas',
  /** O que o leitor de tela anuncia antes da lista, já que a ordem é a informação. */
  rotulo: 'Ferramentas, da maior para a menor familiaridade',
} as const;

/**
 * A seção de Depoimentos da home. O que cada card diz vem da collection `depoimentos`; daqui
 * sai só a moldura da seção, que não passa pelo CMS.
 */
export const depoimentos = {
  titulo: 'Quem já trabalhou comigo',
  /** Como o leitor de tela anuncia o carrossel antes de entrar nos cards. */
  rotulo: 'Depoimentos',
} as const;

/**
 * A Grade de projetos: a moldura da página que lista todos os Projetos. O que cada card mostra
 * vem da collection; o cabeçalho da página não passa pelo CMS, como o resto deste arquivo.
 * O espaço antes de "galeria" é inquebrável: a palavra não pode cair sozinha na última linha.
 */
const resumoDosProjetos = 'Arquitetura, habitação, interiores e documentação executiva.';

export const projetos = {
  titulo: 'Projetos',
  /** O que o portfólio reúne, numa frase: abre a chamada e é a linha do Cartão da Grade. */
  resumo: resumoDosProjetos,
  chamada: `${resumoDosProjetos} Cada projeto com sua ficha técnica e\u00a0galeria.`,
  descricao:
    'Os projetos de Giordanna Pereira: arquitetura, habitação de interesse social, interiores e documentação executiva, cada um com ficha técnica e galeria.',
} as const;

/** A CTA que fecha a home: o convite e o caminho para a Grade de projetos. */
export const cta = {
  titulo: 'Conheça mais',
  enfase: 'do meu trabalho.',
  rotulo: 'Ver projetos',
  href: '/projetos',
} as const;

/**
 * A página de contato: o cabeçalho, os dois blocos e tudo o que o formulário escreve na tela.
 * O e-mail da alternativa, mostrado quando o envio falha, é o `emailExibido` acima, e não uma
 * cópia: se ele mudar, muda num lugar só. Os assuntos do formulário moram em
 * `src/contato/mensagem.ts`, porque o Worker também os confere.
 *
 * Os espaços inquebráveis seguem o Preview: "papel" e "úteis" não caem sozinhos na última linha.
 */
export const contato = {
  titulo: 'Contato',
  descricao:
    'Fale com Giordanna Pereira, arquiteta e urbanista em Uberlândia, MG: projetos residenciais e comerciais, documentação executiva ou uma vaga na sua equipe.',
  /** O h1 em duas partes: no celular a segunda desce para a linha de baixo. */
  chamada: ['Tem um projeto', 'para tirar do papel?'],
  subtitulo:
    'Projetos residenciais e comerciais, documentação executiva ou uma vaga na sua equipe: escreva e eu respondo em até dois dias úteis.',
  canais: { titulo: 'Contato direto', chamada: 'Escolha o canal que preferir.' },
  formulario: {
    titulo: 'Ou envie uma mensagem',
    chamada: 'Poucos campos, sem cadastro. Uso seus dados só para responder.',
    campos: {
      nome: { rotulo: 'Nome', erro: 'Digite seu nome.' },
      email: { rotulo: 'E-mail', erro: 'Digite um e-mail válido, como nome@exemplo.com.' },
      whatsapp: { rotulo: 'WhatsApp', exemplo: '(34) 9 0000-0000' },
      assunto: { rotulo: 'Assunto', vazio: 'Selecione', erro: 'Escolha um assunto.' },
      mensagem: {
        rotulo: 'Mensagem',
        erro: `Conte um pouco sobre o projeto (pelo menos ${MINIMO_DA_MENSAGEM} caracteres).`,
      },
      consentimento: {
        rotulo:
          'Autorizo o uso dos meus dados apenas para responder a esta mensagem, conforme a LGPD.',
        erro: 'Marque a autorização para enviar.',
      },
    },
    /**
     * A política de privacidade curta que o ticket pede: o que se coleta, para quê, onde fica e
     * como pedir para apagar. É o único texto da página que o Preview não tem.
     */
    privacidade:
      'Nome, e-mail, WhatsApp e mensagem chegam só à caixa de e-mail de Giordanna, servem apenas para responder a você e não vão para lista nem cadastro. Para apagá-los, peça por qualquer canal desta página.',
    enviar: 'Enviar mensagem',
    enviando: 'Enviando…',
    nota: 'Resposta em até dois dias úteis.',
    sucesso: {
      titulo: 'Mensagem enviada.',
      texto: 'Obrigada! Respondo em até dois dias úteis pelo e-mail informado.',
    },
    /** A falha: o `emailExibido`, como link, vai entre as duas partes da frase. */
    falha: { antes: 'Não foi possível enviar agora. Escreva direto para ', depois: '.' },
  },
} as const;
