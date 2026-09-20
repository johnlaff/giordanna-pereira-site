/**
 * As rotas públicas do site e o que o buscador lê sobre elas: o sitemap e o `robots.txt`.
 *
 * A lista sai do conteúdo, e não de uma relação escrita à mão: um Projeto novo, cadastrado no
 * CMS, entra no sitemap no mesmo build em que ganha página. As páginas que não são conteúdo —
 * a home e a Grade — são as duas únicas escritas aqui, e uma rota nova de outro tipo entra
 * nesta função, no lugar onde ela deve aparecer para o buscador.
 *
 * Fica fora dos endpoints por ser texto puro, verificável sem o runtime do Astro: o que os
 * arquivos de `src/pages/` fazem é só servir o que sai daqui.
 */

/**
 * As rotas na ordem em que o sitemap as apresenta: a home, a Grade e cada Projeto na Ordem.
 * Sem barra final, a forma canônica do site (ADR 0007) — a única barra é a da home, que é a
 * raiz do domínio e não existe sem ela.
 */
export const rotasPublicas = (slugs: readonly string[]): string[] => [
  '/',
  '/projetos',
  ...slugs.map(rotaDoProjeto),
];

/**
 * O endereço da página de um Projeto. A forma mora aqui para o sitemap, a navegação entre
 * Projetos e o link que se compartilha nunca divergirem em silêncio.
 */
export const rotaDoProjeto = (slug: string): string => `/projetos/${slug}`;

/** O que um caractere reservado do XML vira dentro de uma `<loc>`. */
const escapado: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * O sitemap do site. Sem `lastmod`: a data que o build conhece é a do build, não a da última
 * mudança de cada página, e uma data errada em toda URL vale menos para o buscador que
 * nenhuma.
 */
export const sitemapDe = (rotas: readonly string[], site: URL): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rotas.map(
      (rota) =>
        `  <url><loc>${new URL(rota, site).href.replace(/[&<>"']/g, (c) => escapado[c] ?? c)}</loc></url>`,
    ),
    '</urlset>',
    '',
  ].join('\n');

/**
 * O `robots.txt`. O site inteiro é público e o que há a dizer ao buscador é onde está o
 * sitemap; a área do CMS, que não é conteúdo, entra aqui quando existir (#15).
 */
export const robotsDe = (site: URL): string =>
  ['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL('/sitemap.xml', site).href}`, ''].join(
    '\n',
  );

/**
 * As rotas que o site ainda vai ganhar. O link já está no lugar, como no Preview, mas o
 * prefetch não pode persegui-lo: a página não existe, e cada visita gastaria uma requisição
 * para receber um 404. A página de contato entra em #11, e a lista esvazia com ela.
 */
export const rotasPendentes: readonly string[] = ['/contato'];

/**
 * O que vale no `data-astro-prefetch` de um link interno: `false` enquanto a página não
 * existir, e nada — o padrão, que é pré-buscar — quando ela existir.
 */
export const prefetchDe = (href: string): 'false' | undefined =>
  rotasPendentes.includes(href) ? 'false' : undefined;
