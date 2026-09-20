/**
 * O que decide as variantes de imagem geradas no build. Mora num arquivo só seu porque a
 * esteira usa este caminho na chave do cache de variantes: mudar a qualidade aqui regera o
 * acervo inteiro — e mudar um contato ou um texto em `config.ts` não pode custar isso.
 */

/**
 * Qualidade das variantes, a mesma para AVIF e WebP: o Astro aplica um número só aos dois.
 * Medido nos renders e pranchas do Consultório GinecoCare (2026-09): a nitidez do AVIF empaca
 * a partir de 60 — 95% de um redimensionamento sem perda, contra 97% na qualidade 80 pesando
 * 70% mais —, e o WebP, alternativa de quem não tem AVIF, fica igual acima de 55.
 */
export const qualidadeDeImagem = 65;
