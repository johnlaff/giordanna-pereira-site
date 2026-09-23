import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import { esquemaDeProjeto } from '../../src/content.schema.ts';

/**
 * O CMS em `/admin` (ADR 0002 e 0014), no seam de sempre: a página construída, servida pelo
 * Worker local.
 *
 * O Sveltia busca fora do site a tradução da interface, a versão mais nova dele, o status do
 * GitHub e as fontes. A suíte não depende de rede: a tradução vem do próprio pacote instalado,
 * que é o mesmo arquivo que o UNPKG serviria, e o resto é respondido aqui.
 */
const prepararCms = async (page: Page) => {
  const versao = (
    JSON.parse(readFileSync('node_modules/@sveltia/cms/package.json', 'utf8')) as {
      version: string;
    }
  ).version;
  await page.route(`https://unpkg.com/@sveltia/cms@${versao}/locales/*.json`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: readFileSync(
        `node_modules/@sveltia/cms/locales/${new URL(route.request().url()).pathname.split('/').pop()}`,
      ),
    }),
  );
  await page.route('https://unpkg.com/@sveltia/cms/package.json', (route) =>
    route.fulfill({ json: { version: versao } }),
  );
  await page.route('https://www.githubstatus.com/**', (route) =>
    route.fulfill({ json: { status: { indicator: 'none' } } }),
  );
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({ status: 404 }));
};

/** Um arquivo do repositório, como o navegador o guarda: caminho e conteúdo. */
type Arquivo = { caminho: string; base64: string };

/**
 * Em `localhost`, o Sveltia edita uma pasta da máquina em vez do GitHub ("Trabalhar com
 * Repositório Local"), e é esse caminho que a suíte usa para cadastrar pelo CMS sem login. A
 * pasta que o navegador pede vira uma pasta do armazenamento privado da página (OPFS), com o
 * conteúdo das collections: o CMS lê e grava nela como leria e gravaria no clone do repositório.
 */
const abrirRepositorioLocal = async (page: Page) => {
  const arquivos: Arquivo[] = ['src/content/projetos', 'src/content/depoimentos'].flatMap((pasta) =>
    readdirSync(pasta).map((nome) => ({
      caminho: `${pasta}/${nome}`,
      base64: readFileSync(`${pasta}/${nome}`).toString('base64'),
    })),
  );
  await page.addInitScript(() => {
    Object.assign(window, {
      showDirectoryPicker: async () =>
        (await navigator.storage.getDirectory()).getDirectoryHandle('repo'),
    });
  });
  await page.goto('/admin');
  await page.evaluate(async (arquivos: Arquivo[]) => {
    const raiz = await navigator.storage.getDirectory();
    await raiz.removeEntry('repo', { recursive: true }).catch(() => undefined);
    const repo = await raiz.getDirectoryHandle('repo', { create: true });
    // O Sveltia só aceita a pasta se ela for a raiz de um repositório git.
    await repo.getDirectoryHandle('.git', { create: true });
    const pastaDe = async (caminho: string[]) => {
      let pasta = repo;
      for (const nome of caminho) pasta = await pasta.getDirectoryHandle(nome, { create: true });
      return pasta;
    };
    await pastaDe(['src', 'assets']);
    for (const { caminho, base64 } of arquivos) {
      const partes = caminho.split('/');
      const pasta = await pastaDe(partes.slice(0, -1));
      const escrita = await (
        await pasta.getFileHandle(partes.at(-1)!, { create: true })
      ).createWritable();
      await escrita.write(Uint8Array.from(atob(base64), (letra) => letra.charCodeAt(0)));
      await escrita.close();
    }
  }, arquivos);
  await page.getByRole('button', { name: 'Trabalhar com Repositório Local' }).click();
};

/** O que o CMS gravou na pasta: um arquivo, se existir, em base64. */
const lerDoRepositorio = (page: Page, caminho: string) =>
  page.evaluate(async (caminho: string) => {
    const partes = caminho.split('/');
    try {
      let pasta = await (await navigator.storage.getDirectory()).getDirectoryHandle('repo');
      for (const nome of partes.slice(0, -1)) pasta = await pasta.getDirectoryHandle(nome);
      const arquivo = await (await pasta.getFileHandle(partes.at(-1)!)).getFile();
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      let binario = '';
      for (const byte of bytes) binario += String.fromCharCode(byte);
      return btoa(binario);
    } catch {
      return undefined;
    }
  }, caminho);

// A interface do CMS é a do navegador de quem entra: a de Giordanna está em português.
test.use({ locale: 'pt-BR' });

test.describe('a página do CMS', () => {
  test('carrega em português, com a configuração aceita pelo Sveltia', async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', (erro) => erros.push(erro.message));
    page.on('console', (mensagem) => {
      if (mensagem.type() === 'error' && !/Failed to load resource/.test(mensagem.text()))
        erros.push(mensagem.text());
    });
    await page.addInitScript(() => {
      const registro: string[] = [];
      Object.assign(window, { violacoesDeCsp: registro });
      document.addEventListener('securitypolicyviolation', (evento) =>
        registro.push(`${evento.violatedDirective} barrou ${evento.blockedURI || 'inline'}`),
      );
    });
    await prepararCms(page);

    await page.goto('/admin');
    // Com a configuração errada, o Sveltia mostra os erros no lugar do botão de login.
    await expect(page.getByRole('button', { name: /Entrar com.*GitHub/ })).toBeVisible();
    await expect(page.getByText('Site da Giordanna', { exact: true })).toBeVisible();

    expect(erros).toEqual([]);
    expect(
      await page.evaluate(() => (window as unknown as { violacoesDeCsp: string[] }).violacoesDeCsp),
    ).toEqual([]);
  });

  test('fica fora da busca', async ({ page, request }) => {
    await prepararCms(page);
    await page.goto('/admin');
    // A página já nasce com `noindex`, e o Sveltia soma o dele quando carrega.
    await expect(page.getByRole('button', { name: /Entrar com.*GitHub/ })).toBeVisible();
    const robots = await page
      .locator('meta[name="robots"]')
      .evaluateAll((metas) => metas.map((meta) => meta.getAttribute('content')));
    expect(robots.length).toBeGreaterThan(0);
    for (const conteudo of robots) expect(conteudo).toMatch(/noindex/);
    expect(await (await request.get('/robots.txt')).text()).toMatch(/^Disallow: \/admin$/m);
  });

  // O Worker da suíte sobe sem as chaves do OAuth App, como a Produção antes do João criá-lo.
  // O caminho inteiro roda: o CMS abre a janela, o Worker responde, a janela conversa com o
  // CMS por `postMessage`, e o CMS mostra o motivo em português.
  test('sem o OAuth App configurado, o login avisa o que falta', async ({ page }) => {
    await prepararCms(page);
    await page.goto('/admin');
    const janela = page.waitForEvent('popup');
    await page.getByRole('button', { name: /Entrar com.*GitHub/ }).click();
    expect(new URL((await janela).url()).pathname).toBe('/api/admin/entrar');
    await expect(
      page.getByText('O ID do cliente ou o segredo do aplicativo OAuth não está configurado.'),
    ).toBeVisible();
  });
});

test.describe('num navegador em inglês', () => {
  test.use({ locale: 'en-US' });

  test('o CMS abre em português', async ({ page }) => {
    await prepararCms(page);
    await page.goto('/admin');
    await expect(page.getByRole('button', { name: /Entrar com.*GitHub/ })).toBeVisible();
  });
});

test.describe('cadastrar pelo CMS', () => {
  // O caminho de Giordanna com um Projeto novo: preenche, erra, corrige, sobe a foto do celular
  // e salva. O que conta é o que chega ao repositório: um `.yml` que o schema das collections
  // aceita e a foto já convertida, como o build a espera.
  test('um Projeto com a foto do celular chega ao repositório pronto para o build', async ({
    page,
  }) => {
    test.slow();
    // Uma foto como a de um celular: 4032 px de largura, em JPEG, com mais de 2 MB. Fica numa
    // pasta temporária, e não na do teste: com acento no caminho, que o nome do teste põe na
    // pasta dele, o Playwright entrega o arquivo ao campo e o navegador não o recebe.
    const foto = join(mkdtempSync(join(tmpdir(), 'cms-')), 'Foto do Celular.jpg');
    await sharp(readFileSync('src/assets/gineco-r01.webp'))
      .resize({ width: 4032 })
      .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
      .toFile(foto);
    expect((await sharp(foto).metadata()).width).toBe(4032);
    expect(statSync(foto).size).toBeGreaterThan(2 * 1024 * 1024);

    await prepararCms(page);
    await abrirRepositorioLocal(page);
    // No celular, o CMS abre na lista de coleções; no computador, já na primeira.
    await page.getByRole('treeitem', { name: 'Projetos' }).click();
    await page.getByRole('button', { name: 'Criar Nova Entrada' }).click();

    const campo = (rotulo: string) => page.getByLabel(rotulo, { exact: true });
    // O formulário novo ainda se monta logo depois de aberto e pode apagar o que chegou cedo:
    // cada campo é preenchido até guardar o valor.
    const preencher = (rotulo: string, valor: string) =>
      expect(async () => {
        await campo(rotulo).fill(valor);
        await expect(campo(rotulo)).toHaveValue(valor, { timeout: 1_000 });
      }).toPass();
    await preencher('Título', 'Casa do Teste');
    await preencher('Tipo', 'Residencial');
    await preencher('Descrição', 'Uma casa de teste, cadastrada pelo CMS.');
    await page.getByRole('button', { name: /Adicionar.*Ferramenta/ }).click();
    await preencher('Ferramenta', 'SketchUp');
    await preencher('Local', 'Uberlândia · MG');
    await preencher('Ano', '2026');
    await preencher('Área', '120 metros');
    await preencher('Ordem', '110');

    // Sem Equipe e com a área fora do padrão, o CMS não salva e diz o que corrigir.
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Este campo é obrigatório.')).toBeVisible();
    await expect(
      page.getByText(
        'Escreva a área como 46,88 m² ou 1.125,54 m²: milhar com ponto e decimal com vírgula.',
      ),
    ).toBeVisible();
    expect(await lerDoRepositorio(page, 'src/content/projetos/casa-do-teste.yml')).toBeUndefined();

    await preencher('Área', '120,5 m²');
    await preencher('Equipe', 'Estúdio Teste');
    // A Galeria é o único campo de várias imagens do formulário.
    await page.locator('input[type="file"][multiple]').first().setInputFiles(foto);
    // A foto é convertida no navegador antes de entrar no campo, e só então pode ser salva.
    await expect(page.getByRole('button', { name: 'Remove Image' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Entrada salva.')).toBeVisible({ timeout: 30_000 });

    const yml = await lerDoRepositorio(page, 'src/content/projetos/casa-do-teste.yml');
    expect(yml).toBeDefined();
    const projeto = esquemaDeProjeto(() => z.string().startsWith('../../assets/')).parse(
      parse(Buffer.from(yml!, 'base64').toString('utf8')),
    );
    expect(projeto).toMatchObject({
      titulo: 'Casa do Teste',
      area: '120,5 m²',
      ordem: 110,
      galeria: ['../../assets/foto-do-celular.webp'],
    });

    const webp = await lerDoRepositorio(page, 'src/assets/foto-do-celular.webp');
    expect(webp).toBeDefined();
    const bytes = Buffer.from(webp!, 'base64');
    const { format, width, height } = await sharp(bytes).metadata();
    expect(format).toBe('webp');
    expect(Math.max(width, height)).toBeLessThanOrEqual(2560);
    expect(bytes.length).toBeLessThanOrEqual(2 * 1024 * 1024);
  });
});
