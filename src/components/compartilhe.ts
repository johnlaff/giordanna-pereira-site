/**
 * Para onde leva cada destino do bloco Compartilhe da Ficha.
 *
 * Os quatro destinos são âncoras comuns, montadas no build: o endereço já sai pronto no HTML,
 * sem requisição a domínio externo e sem depender de JavaScript. O que eles carregam é a URL
 * canônica da página (`site` de `astro.config.ts`, sem barra final — ADR 0007), e não o
 * `location.href` de quem navega: um link de preview ou com parâmetro de campanha colado numa
 * conversa levaria o visitante a um endereço que não é o do site.
 *
 * O compartilhamento nativo e o copiar link ficam em `Compartilhe.astro`, que precisa do
 * navegador para saber se existem.
 */
// A extensão é explícita porque o teste de unidade carrega este módulo pelo runner do Node,
// que resolve como ESM e não tem o bundler do Astro para adivinhá-la.
import { tituloDaPagina } from '../config.ts';

export type TipoDeDestino = 'whatsapp' | 'linkedin' | 'facebook' | 'email';

export type Destino = {
  tipo: TipoDeDestino;
  /** Rótulo acessível, distinto entre os seis controles da fileira. */
  rotulo: string;
  /** Dica do ponteiro: só o nome do destino, que o ícone já sugere. */
  dica: string;
  href: string;
  /** Abre em aba nova (sai do site); o e-mail fica no aplicativo do visitante. */
  externo: boolean;
};

/**
 * Os destinos na ordem do Preview. O que vai escrito é o título da página — o Projeto e de
 * quem ele é —, para a conversa mostrar o mesmo que a aba do navegador.
 * Cada um espera o seu parâmetro: o WhatsApp recebe uma
 * mensagem única — título e endereço separados por espaço —, o LinkedIn e o Facebook só a URL,
 * e o e-mail traz o título no assunto e o endereço no corpo.
 */
export const destinosDeCompartilhamento = (titulo: string, url: string): readonly Destino[] => {
  const t = encodeURIComponent(tituloDaPagina(titulo));
  const u = encodeURIComponent(url);
  return [
    {
      tipo: 'whatsapp',
      rotulo: 'Compartilhar no WhatsApp',
      dica: 'WhatsApp',
      href: `https://wa.me/?text=${t}%20${u}`,
      externo: true,
    },
    {
      tipo: 'linkedin',
      rotulo: 'Compartilhar no LinkedIn',
      dica: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      externo: true,
    },
    {
      tipo: 'facebook',
      rotulo: 'Compartilhar no Facebook',
      dica: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      externo: true,
    },
    {
      tipo: 'email',
      rotulo: 'Compartilhar por e-mail',
      dica: 'E-mail',
      href: `mailto:?subject=${t}&body=${u}`,
      externo: false,
    },
  ];
};
