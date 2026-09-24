/**
 * A integração que grava os Cartões de compartilhamento no build, e os serve no `astro dev`.
 *
 * Os Cartões não saem de uma página do Astro porque o prerender roda no workerd do adapter da
 * Cloudflare, onde o sharp não existe; o gancho de fim de build roda no Node, como as
 * variantes de imagem. Por isso os Projetos são lidos aqui direto dos arquivos da collection,
 * com o mesmo contrato de `content.schema.ts` — o build já os validou antes de chegar aqui, e
 * a leitura só precisa do título, do Tipo e das imagens.
 */
import { globSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { z } from 'astro/zod';
import { parse } from 'yaml';
import { esquemaDeProjeto, ordenarProjetos } from '../content.schema.ts';
import { cartoesDoSite, type Cartao } from './cartoes.ts';
import { desenharCartao } from './desenho.ts';

const PASTA_DOS_PROJETOS = 'src/content/projetos/';

/**
 * Os Projetos da collection, na Ordem, com as imagens como caminhos relativos à raiz do
 * projeto. O `id` é o que o loader `glob` dá a um arquivo: o caminho sem a extensão.
 */
export function lerProjetos(raiz: URL) {
  const pasta = new URL(PASTA_DOS_PROJETOS, raiz);
  return ordenarProjetos(
    globSync('**/*.yml', { cwd: fileURLToPath(pasta) }).map((arquivo) => {
      const origem = new URL(arquivo, pasta);
      // O caminho vem relativo ao arquivo ou, como o CMS grava uma foto que já estava no site, a
      // partir da raiz do projeto (`/src/assets/...`): o `image()` do Astro aceita os dois.
      const imagem = () =>
        z.string().transform((caminho) => {
          const url = caminho.startsWith('/')
            ? new URL(`.${caminho}`, raiz)
            : new URL(caminho, origem);
          return url.href.slice(raiz.href.length);
        });
      const data = esquemaDeProjeto(imagem).parse(parse(readFileSync(origem, 'utf8')));
      return { id: arquivo.replace(/\.yml$/, ''), data };
    }),
  );
}

const gravar = async (cartao: Cartao, raiz: URL, destino: URL) => {
  const arquivo = new URL(cartao.arquivo, destino);
  await mkdir(new URL('.', arquivo), { recursive: true });
  await writeFile(arquivo, await desenharCartao(cartao, raiz));
};

export function cartoesDeCompartilhamento(): AstroIntegration {
  let raiz: URL;
  return {
    name: 'cartoes-de-compartilhamento',
    hooks: {
      'astro:config:done': ({ config }) => {
        raiz = config.root;
      },
      'astro:build:done': async ({ dir, pages, logger }) => {
        const projetos = lerProjetos(raiz);
        // O `id` lido aqui precisa ser o slug que o loader deu à página. Para um nome de arquivo
        // que o loader reescreve (maiúscula, acento, espaço) os dois divergiriam, e o og:image da
        // página apontaria para um Cartão que não existe: melhor o build parar e dizer.
        const paginas = new Set(pages.map(({ pathname }) => pathname.replace(/^\/|\/$/g, '')));
        for (const { id } of projetos)
          if (!paginas.has(`projetos/${id}`))
            throw new Error(
              `o Projeto "${id}" não tem página em /projetos/${id}: renomeie o arquivo em ${PASTA_DOS_PROJETOS} para letras minúsculas, sem acento e com hífen no lugar do espaço`,
            );
        const cartoes = cartoesDoSite(projetos);
        await Promise.all(cartoes.map((cartao) => gravar(cartao, raiz, dir)));
        logger.info(`${cartoes.length} Cartões de compartilhamento em og/`);
      },
      // No dev não há fim de build: o Cartão é desenhado na hora em que é pedido.
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((pedido, resposta, seguir) => {
          const caminho = pedido.url?.split('?')[0]?.slice(1);
          if (pedido.method !== 'GET' || !caminho?.startsWith('og/')) return seguir();
          const cartao = cartoesDoSite(lerProjetos(raiz)).find((c) => c.arquivo === caminho);
          if (cartao === undefined) return seguir();
          desenharCartao(cartao, raiz).then(
            (jpeg) => resposta.writeHead(200, { 'content-type': 'image/jpeg' }).end(jpeg),
            seguir,
          );
        });
      },
    },
  };
}
