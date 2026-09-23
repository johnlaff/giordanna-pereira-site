/**
 * A Mensagem do formulário de contato: o que o visitante manda, o que o Worker aceita e o
 * e-mail que sai dela.
 *
 * As regras de cada campo moram aqui, e não no formulário nem no endpoint, porque os dois
 * precisam delas: o navegador as usa para apontar o erro antes do envio, e o Worker as aplica
 * de novo, porque o que chega ao endpoint pode não ter passado por navegador nenhum. Uma regra
 * escrita duas vezes divergiria em silêncio — o visitante veria o formulário aceitar o que o
 * Worker recusa.
 *
 * Nada aqui fala com a rede nem lê variável do Worker: é texto entrando e texto saindo,
 * verificável pelo runner do Node sem o runtime da Cloudflare.
 */

/** Os assuntos do formulário, na ordem do Preview. O Worker recusa qualquer outro. */
export const assuntos = [
  'Projeto residencial',
  'Projeto comercial',
  'Documentação executiva / BIM',
  'Oportunidade de trabalho',
  'Outro',
] as const;

export type Assunto = (typeof assuntos)[number];

/**
 * O teto do corpo do POST, em bytes. Todos os campos no teto, mais o token do Turnstile (até
 * 2048 caracteres), dão uns 6,5 KB em texto sem acento; como uma letra acentuada vira seis
 * caracteres depois de codificada, o teto fica com folga para uma mensagem longa em
 * português, sem deixar alguém fazer o Worker ler um arquivo inteiro.
 */
export const LIMITE_DO_CORPO = 16 * 1024;

/** O maior tamanho aceito em cada campo de texto, em caracteres. */
export const limites = {
  nome: 120,
  email: 254,
  whatsapp: 40,
  mensagem: 4000,
} as const;

/** O mínimo da mensagem: menos que isso não dá para responder a nada. */
export const MINIMO_DA_MENSAGEM = 10;

export type Mensagem = {
  nome: string;
  email: string;
  /** Vazio quando o visitante não informou: o campo é opcional. */
  whatsapp: string;
  assunto: Assunto;
  mensagem: string;
};

/** Os campos que o formulário marca em vermelho, no nome que o HTML usa. */
export type Campo = 'nome' | 'email' | 'whatsapp' | 'assunto' | 'mensagem' | 'consentimento';

export type Leitura =
  | { ok: true; mensagem: Mensagem }
  /** A isca (`empresa`) veio preenchida: quem enviou foi um robô que preenche tudo. */
  | { ok: false; motivo: 'isca' }
  | { ok: false; motivo: 'campos'; campos: readonly Campo[] };

export const nomeValido = (valor: string): boolean => {
  const nome = valor.trim();
  return nome.length > 1 && nome.length <= limites.nome;
};

/**
 * Um e-mail com cara de e-mail: algo, arroba, domínio com ponto e terminação de duas letras ou
 * mais. É a regra do Preview; quem decide se a caixa existe é a resposta que nunca chega.
 */
export const emailValido = (valor: string): boolean => {
  const email = valor.trim();
  return email.length <= limites.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
};

export const assuntoValido = (valor: string): valor is Assunto =>
  (assuntos as readonly string[]).includes(valor);

export const mensagemValida = (valor: string): boolean => {
  const mensagem = valor.trim();
  return mensagem.length >= MINIMO_DA_MENSAGEM && mensagem.length <= limites.mensagem;
};

/** O WhatsApp é opcional; quando vem, só não pode passar do teto. */
export const whatsappValido = (valor: string): boolean => valor.trim().length <= limites.whatsapp;

/**
 * Lê o formulário como o Worker o recebe e decide se é uma Mensagem.
 *
 * A isca é olhada antes de tudo: um robô que a preencheu não merece nem a lista de campos
 * errados. Depois, todos os campos são conferidos de uma vez, para a resposta dizer tudo o
 * que falta e não um erro por envio.
 */
export const lerMensagem = (formulario: URLSearchParams): Leitura => {
  const campo = (nome: string) => formulario.get(nome) ?? '';

  if (campo('empresa').trim() !== '') return { ok: false, motivo: 'isca' };

  const nome = campo('nome');
  const email = campo('email');
  const whatsapp = campo('whatsapp');
  const assunto = campo('assunto');
  const mensagem = campo('mensagem');

  const invalidos: Campo[] = [];
  if (!nomeValido(nome)) invalidos.push('nome');
  if (!emailValido(email)) invalidos.push('email');
  if (!whatsappValido(whatsapp)) invalidos.push('whatsapp');
  if (!assuntoValido(assunto)) invalidos.push('assunto');
  if (!mensagemValida(mensagem)) invalidos.push('mensagem');
  // O navegador manda `on` para a caixa marcada e nada para a desmarcada.
  if (campo('consentimento') !== 'on') invalidos.push('consentimento');

  // O segundo teste repete um de cima só para o TypeScript saber, daqui para baixo, que o
  // assunto é um Assunto.
  if (invalidos.length > 0 || !assuntoValido(assunto))
    return { ok: false, motivo: 'campos', campos: invalidos };

  return {
    ok: true,
    mensagem: {
      nome: nome.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim(),
      assunto,
      mensagem: mensagem.trim(),
    },
  };
};

/** Quem assina o e-mail do site e para onde ele vai. */
export type Enderecos = { de: string; para: string };

/** O e-mail pronto para o serviço de envio, com os nomes que o Resend espera traduzidos. */
export type Email = {
  de: string;
  para: string;
  /** O visitante: responder ao e-mail responde a ele, e não ao remetente do site. */
  responderPara: string;
  assunto: string;
  texto: string;
};

/**
 * Tira do texto o que não pode ir num cabeçalho de e-mail: quebra de linha e caractere de
 * controle. O nome do visitante entra no assunto, e um nome com quebra de linha poderia, num
 * serviço menos cuidadoso que o Resend, virar um cabeçalho a mais.
 */
// eslint-disable-next-line no-control-regex -- o ponto da expressão é justamente achar os caracteres de controle
const semControle = (texto: string): string => texto.replace(/[\u0000-\u001f\u007f]+/g, ' ');

/**
 * O e-mail que chega a Giordanna. O assunto diz do que se trata e quem escreveu, para a caixa
 * de entrada ser lida sem abrir cada um; o corpo é texto simples, com cada campo rotulado, e
 * o visitante no `reply-to`.
 */
export const emailDaMensagem = (mensagem: Mensagem, enderecos: Enderecos): Email => ({
  de: enderecos.de,
  para: enderecos.para,
  responderPara: mensagem.email,
  assunto: semControle(`Contato pelo site: ${mensagem.assunto} — ${mensagem.nome}`),
  texto: [
    `Nome: ${mensagem.nome}`,
    `E-mail: ${mensagem.email}`,
    `WhatsApp: ${mensagem.whatsapp || 'não informado'}`,
    `Assunto: ${mensagem.assunto}`,
    '',
    mensagem.mensagem,
    '',
    '—',
    'Enviado pelo formulário de contato do site. O visitante autorizou o uso dos dados só para',
    'responder a esta mensagem (LGPD). Responder a este e-mail responde direto a ele.',
  ].join('\n'),
});
