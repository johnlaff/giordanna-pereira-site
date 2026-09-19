import { projetos } from './projetos.ts';

/**
 * Rotas públicas cobertas pela suíte; cada ticket que cria página acrescenta a sua aqui.
 * As páginas de Projeto saem da própria collection: um Projeto novo, inclusive cadastrado
 * no CMS, já entra nas verificações de acessibilidade e de rede sem tocar neste arquivo.
 */
export const rotas = ['/', ...projetos.map(({ rota }) => rota), '/nao-existe'] as const;
