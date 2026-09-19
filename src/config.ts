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

/**
 * Qualidade das variantes que o build gera, a mesma para AVIF e WebP — o Astro aplica um
 * número só aos dois. Medido nos renders e pranchas do GinecoCare: a nitidez do AVIF empaca a
 * partir de 60 (95% de um redimensionamento sem perda, contra 97% em 80 pesando 70% mais), e
 * o WebP, alternativa de quem não tem AVIF, fica igual em qualquer qualidade acima de 55.
 * Vale para toda imagem do site; entra no hash do arquivo, então mudá-la regera as variantes.
 */
export const qualidadeDeImagem = 65;

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
