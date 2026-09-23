import { projetos } from './projetos.ts';

/** Uma rota que não existe: a página 404 do site, servida com status 404. */
export const rota404 = '/nao-existe';

/**
 * Rotas públicas cobertas pela suíte; cada ticket que cria página acrescenta a sua aqui.
 * As páginas de Projeto saem da própria collection: um Projeto novo, inclusive cadastrado
 * no CMS, já entra nas verificações de acessibilidade e de rede sem tocar neste arquivo.
 */
export const rotas = [
  '/',
  '/projetos',
  ...projetos.map(({ rota }) => rota),
  '/contato',
  rota404,
] as const;
