import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import { esquemaDeFamiliaridade, esquemaDeProjeto } from '../../src/content.schema.ts';

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
const abrirRepositorioLocal = async (page: Page, imagens: string[] = []) => {
  const arquivos: Arquivo[] = [
    ...['src/content/projetos', 'src/content/depoimentos', 'src/content/home'].flatMap((pasta) =>
      readdirSync(pasta).map((nome) => `${pasta}/${nome}`),
    ),
    ...imagens,
  ].map((caminho) => ({ caminho, base64: readFileSync(caminho).toString('base64') }));
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
    const projeto = esquemaDeProjeto(() => z.string().startsWith('/src/assets/')).parse(
      parse(Buffer.from(yml!, 'base64').toString('utf8')),
    );
    expect(projeto).toMatchObject({
      titulo: 'Casa do Teste',
      area: '120,5 m²',
      ordem: 110,
      galeria: ['/src/assets/foto-do-celular.webp'],
    });

    const webp = await lerDoRepositorio(page, 'src/assets/foto-do-celular.webp');
    expect(webp).toBeDefined();
    const bytes = Buffer.from(webp!, 'base64');
    const { format, width, height } = await sharp(bytes).metadata();
    expect(format).toBe('webp');
    expect(Math.max(width, height)).toBeLessThanOrEqual(2560);
    expect(bytes.length).toBeLessThanOrEqual(2 * 1024 * 1024);
  });

  // A Capa de um Projeto costuma ser uma foto que já está no site. Escolhida no CMS, ela entra no
  // Projeto com o mesmo caminho de uma foto enviada, e o Cartão de compartilhamento a encontra.
  test('um Projeto com fotos que já estão no site guarda o caminho de uma foto enviada', async ({
    page,
  }) => {
    test.slow();
    await prepararCms(page);
    await abrirRepositorioLocal(page, [
      'src/assets/aparecer-r02.webp',
      'src/assets/aparecer-r05.webp',
    ]);
    await page.getByRole('treeitem', { name: 'Projetos' }).click();
    await page.getByRole('button', { name: 'Criar Nova Entrada' }).click();

    const campo = (rotulo: string) => page.getByLabel(rotulo, { exact: true });
    const preencher = (rotulo: string, valor: string) =>
      expect(async () => {
        await campo(rotulo).fill(valor);
        await expect(campo(rotulo)).toHaveValue(valor, { timeout: 1_000 });
      }).toPass();
    await preencher('Título', 'Casa Escolhida');
    await preencher('Tipo', 'Residencial');
    await preencher('Descrição', 'Uma casa com fotos que já estavam no site.');
    await page.getByRole('button', { name: /Adicionar.*Ferramenta/ }).click();
    await preencher('Ferramenta', 'Revit');
    await preencher('Local', 'Uberlândia · MG');
    await preencher('Ano', '2026');
    await preencher('Área', '48 m²');
    await preencher('Equipe', 'Giordanna Pereira');
    await preencher('Ordem', '120');

    const escolher = async (grupo: RegExp, foto: string) => {
      await page
        .getByRole('group', { name: grupo })
        .getByRole('button', { name: 'Procurar' })
        .click();
      const dialogo = page.getByRole('dialog', { name: 'Selecionar Imagem' });
      // Só as fotos do próprio site: um banco de imagens traria foto de outra pessoa ao portfólio.
      await expect(dialogo.getByText('Fotos de Banco de Imagens')).toHaveCount(0);
      // A lista de fotos ainda se arruma logo depois de aberta, e um toque cedo pode se perder.
      const inserir = dialogo.getByRole('button', { name: 'Inserir' });
      await expect(async () => {
        await dialogo.getByRole('option', { name: foto }).click();
        await expect(inserir).toBeEnabled({ timeout: 1_000 });
      }).toPass();
      await inserir.click();
      await expect(dialogo).toBeHidden();
    };
    await escolher(/Capa/, 'aparecer-r02.webp');
    await escolher(/Galeria/, 'aparecer-r05.webp');

    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Entrada salva.')).toBeVisible({ timeout: 30_000 });

    const yml = await lerDoRepositorio(page, 'src/content/projetos/casa-escolhida.yml');
    expect(yml).toBeDefined();
    expect(parse(Buffer.from(yml!, 'base64').toString('utf8'))).toMatchObject({
      capa: '/src/assets/aparecer-r02.webp',
      galeria: ['/src/assets/aparecer-r05.webp'],
    });
  });
});

test.describe('editar a home pelo CMS', () => {
  // O que Giordanna atualiza com a carreira: uma ferramenta nova na Familiaridade, com o nível
  // escolhido numa lista, chega ao arquivo como o número que o schema aceita.
  test('uma ferramenta nova chega ao arquivo da Familiaridade pronta para o build', async ({
    page,
  }) => {
    test.slow();
    await prepararCms(page);
    await abrirRepositorioLocal(page);
    await page.getByRole('treeitem', { name: 'Página inicial' }).click();
    // Só os dois blocos que mudam com a carreira dela: hero, CTA e Contatos ficam no código.
    for (const fora of ['Hero', 'CTA', 'Contatos'])
      await expect(page.getByText(fora, { exact: true })).toHaveCount(0);
    await page.getByRole('gridcell', { name: 'Ferramentas' }).click();

    // O CMS só desenha os itens abertos que estão na tela. Com a lista recolhida, o item novo,
    // que nasce aberto, é o único com campo de Nome.
    await page.getByRole('button', { name: 'Recolher Tudo' }).click();
    const nomes = page.getByRole('textbox', { name: 'Nome', exact: true });
    await expect(nomes).toHaveCount(0);
    await page.getByRole('button', { name: /Adicionar.*Ferramenta/ }).click();
    await expect(nomes).toHaveCount(1);
    const nome = nomes.first();
    await expect(async () => {
      await nome.fill('Lumion');
      await expect(nome).toHaveValue('Lumion', { timeout: 1_000 });
    }).toPass();
    await page
      .getByRole('radiogroup', { name: 'Nível' })
      .getByRole('radio', { name: 'Familiaridade média (bloco cinza)' })
      .check();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Entrada salva.')).toBeVisible({ timeout: 30_000 });

    const yml = await lerDoRepositorio(page, 'src/content/home/familiaridade.yml');
    expect(yml).toBeDefined();
    const { itens } = esquemaDeFamiliaridade().parse(
      parse(Buffer.from(yml!, 'base64').toString('utf8')),
    );
    // As oito que já estavam continuam como estavam, e a nova entra no fim.
    const antes = esquemaDeFamiliaridade().parse(
      parse(readFileSync('src/content/home/familiaridade.yml', 'utf8')),
    ).itens;
    expect(itens).toEqual([...antes, { nome: 'Lumion', nivel: 2 }]);
  });
});
