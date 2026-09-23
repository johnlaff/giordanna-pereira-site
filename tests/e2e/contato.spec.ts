import AxeBuilder from '@axe-core/playwright';
import { expect, request, test, type Page } from '@playwright/test';
import { contatos, emailExibido } from '../../src/config.ts';
import { assuntos, LIMITE_DO_CORPO } from '../../src/contato/mensagem.ts';
import { EMAIL_QUE_FALHA, TOKEN_DE_TESTE } from '../../src/contato/servicos.ts';
import { urlDoModoDeTeste, urlDoTeto } from './modo-de-teste.ts';

/**
 * A página de contato e o formulário, nos dois Workers da suíte (ver `playwright.config.ts`):
 * o comum, sem chave nenhuma, onde o envio tem de falhar fechado, e o do modo de teste, onde o
 * Turnstile e o Resend são dublês e o caminho inteiro — validação, sucesso e falha — roda de
 * verdade no navegador. É a migração do `form-dist.js` e da parte de formulário do `qa.js` do
 * Preview.
 */

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const preencher = async (page: Page, email = 'ana@exemplo.com') => {
  await page.fill('#f-nome', 'Ana Souza');
  await page.fill('#f-email', email);
  await page.selectOption('#f-assunto', 'Outro');
  await page.fill('#f-mensagem', 'Mensagem de teste com mais de dez caracteres');
  await page.check('#f-consentimento');
};

/** Um corpo de formulário válido, para os envios que não passam pelo navegador. */
const corpo = (mudancas: Record<string, string> = {}) =>
  new URLSearchParams({
    empresa: '',
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    whatsapp: '',
    assunto: 'Outro',
    mensagem: 'Mensagem de teste com mais de dez caracteres',
    consentimento: 'on',
    'cf-turnstile-response': TOKEN_DE_TESTE,
    ...mudancas,
  }).toString();

/**
 * Os cabeçalhos de um envio feito pela própria página. O `Origin` é o que o navegador manda
 * sozinho: sem ele o Astro recusa o POST de formulário com 403 antes de o endpoint rodar
 * (`security.checkOrigin`), a primeira defesa contra envio forjado de outro site.
 */
const formulario = (origem: string) => ({
  'Content-Type': 'application/x-www-form-urlencoded',
  Origin: origem,
});

/** Um POST direto ao endpoint, sem passar pela página, numa conexão só dele. */
const postar = async (url: string, origem: string, dados: string) => {
  const contexto = await request.newContext();
  try {
    const resposta = await contexto.post(url, { headers: formulario(origem), data: dados });
    const texto = await resposta.text();
    return { status: resposta.status(), json: () => JSON.parse(texto) as unknown };
  } finally {
    await contexto.dispose();
  }
};
const noModoDeTeste = (dados: string, origem = urlDoModoDeTeste) =>
  postar(`${urlDoModoDeTeste}/api/contato`, origem, dados);

test.describe('a página', () => {
  test('mostra os quatro Contatos e o formulário com os campos do Preview', async ({ page }) => {
    await page.goto('/contato');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      /Tem um projeto\s+para tirar do\u00a0papel\?/,
    );
    await expect(page.locator('.nav a[aria-current="page"]')).toHaveText('Contato');

    const canais = page.locator('.c-list a');
    await expect(canais).toHaveCount(contatos.length);
    for (const [i, contato] of contatos.entries()) {
      await expect(canais.nth(i)).toHaveAttribute('href', contato.href);
      await expect(canais.nth(i)).toContainText(contato.texto);
    }

    const form = page.locator('#cf');
    for (const rotulo of ['Nome', 'E-mail', 'WhatsApp', 'Assunto', 'Mensagem'])
      await expect(form.getByLabel(new RegExp(`^${rotulo}`))).toBeVisible();
    await expect(page.locator('#f-assunto option')).toHaveText(['Selecione', ...assuntos]);
    await expect(page.getByRole('checkbox', { name: /LGPD/ })).toBeVisible();
    await expect(page.locator('.f-privacidade')).toContainText('Para apagá-los');
  });

  test('o link Política de privacidade do rodapé leva à política, junto do formulário', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('footer').getByRole('link', { name: 'Política de privacidade' }).click();
    await expect(page).toHaveURL('/contato#privacidade');
    await expect(page.locator('#privacidade')).toBeInViewport();
  });

  test('sem a chave de site no build, nenhum widget nem script do Turnstile', async ({ page }) => {
    await page.goto('/contato');
    await expect(page.locator('.cf-turnstile')).toHaveCount(0);
    await expect(page.locator('script[src*="challenges.cloudflare.com"]')).toHaveCount(0);
  });
});

test.describe('a validação no navegador', () => {
  test('enviar vazio aponta cada campo que falta, leva o foco ao primeiro e não envia', async ({
    page,
  }) => {
    const envios: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/contato')) envios.push(req.url());
    });
    await page.goto('/contato');
    await page.click('#f-send');

    for (const id of ['nome', 'email', 'assunto', 'mensagem', 'consentimento']) {
      await expect(page.locator(`#f-${id}`)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator(`#e-${id}`)).toBeVisible();
      // O erro vira a descrição do campo: é o que o leitor de tela lê quando o foco chega nele.
      await expect(page.locator(`#f-${id}`)).toHaveAttribute('aria-describedby', `e-${id}`);
    }
    await expect(page.locator('#consent-w')).toHaveClass(/err/);
    await expect(page.locator('#f-nome')).toBeFocused();
    expect(envios).toEqual([]);

    // Os erros à mostra também passam no axe: o vermelho do erro tem o contraste da WCAG.
    const resultado = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(resultado.violations).toEqual([]);
  });

  test('o erro aparece ao sair do campo e some enquanto o visitante corrige', async ({ page }) => {
    await page.goto('/contato');
    await page.fill('#f-email', 'ana@');
    await page.locator('#f-email').blur();
    await expect(page.locator('#e-email')).toBeVisible();

    await page.fill('#f-email', 'ana@exemplo.com');
    await expect(page.locator('#e-email')).toBeHidden();
    await expect(page.locator('#f-email')).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('#f-email')).not.toHaveAttribute('aria-describedby');
  });

  test('digitar num campo ainda não visitado não acusa erro antes da hora', async ({ page }) => {
    await page.goto('/contato');
    // Antes de qualquer erro, nenhum campo carrega descrição: o leitor de tela não anuncia um
    // "Digite seu nome." a quem ainda nem começou.
    for (const id of ['nome', 'email', 'assunto', 'mensagem', 'consentimento'])
      await expect(page.locator(`#f-${id}`)).not.toHaveAttribute('aria-describedby');
    await page.locator('#f-nome').pressSequentially('A');
    await expect(page.locator('#e-nome')).toBeHidden();
  });
});

test.describe('sem chaves, o envio falha fechado', () => {
  test('o endpoint recusa e o formulário mostra o e-mail alternativo', async ({ page }) => {
    await page.goto('/contato');
    await preencher(page);
    const resposta = page.waitForResponse('**/api/contato');
    await page.click('#f-send');
    expect((await resposta).status()).toBe(503);

    const falha = page.locator('#f-fail');
    await expect(falha).toBeVisible();
    await expect(falha).toBeFocused();
    await expect(falha.getByRole('link', { name: emailExibido })).toHaveAttribute(
      'href',
      `mailto:${emailExibido}`,
    );
    await expect(page.locator('#f-ok')).toBeHidden();
    await expect(page.locator('#cf')).toBeVisible();
    await expect(page.locator('#f-send')).toBeEnabled();

    const resultado = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(resultado.violations).toEqual([]);
  });

  test('nem um envio perfeito, com o token de teste, passa sem as chaves', async ({ baseURL }) => {
    const origem = baseURL ?? '';
    const resposta = await postar(`${origem}/api/contato`, origem, corpo());
    expect(resposta.status).toBe(503);
    expect(resposta.json()).toEqual({ ok: false, erro: 'indisponivel' });
  });
});

test.describe('no modo de teste', () => {
  test('um envio válido mostra a confirmação no lugar do formulário', async ({ page }) => {
    await page.goto(`${urlDoModoDeTeste}/contato`);
    await preencher(page);
    const resposta = page.waitForResponse('**/api/contato');
    await page.click('#f-send');
    expect((await resposta).status()).toBe(200);

    await expect(page.locator('#f-ok')).toBeVisible();
    await expect(page.locator('#f-ok')).toBeFocused();
    await expect(page.locator('#f-ok')).toContainText('Mensagem enviada.');
    await expect(page.locator('#cf')).toBeHidden();
    await expect(page.locator('#f-fail')).toBeHidden();
  });

  test('uma falha do serviço de envio mostra o e-mail alternativo e deixa tentar de novo', async ({
    page,
  }) => {
    await page.goto(`${urlDoModoDeTeste}/contato`);
    await preencher(page, EMAIL_QUE_FALHA);
    const resposta = page.waitForResponse('**/api/contato');
    await page.click('#f-send');
    expect((await resposta).status()).toBe(502);

    await expect(page.locator('#f-fail')).toBeVisible();
    await expect(page.locator('#f-fail')).toContainText(emailExibido);
    await expect(page.locator('#f-ok')).toBeHidden();
    await expect(page.locator('#cf')).toBeVisible();

    // Corrigido o e-mail, o mesmo formulário envia, e o aviso de falha sai de cena.
    await page.fill('#f-email', 'ana@exemplo.com');
    await page.click('#f-send');
    await expect(page.locator('#f-ok')).toBeVisible();
    await expect(page.locator('#f-fail')).toBeHidden();
  });

  test.describe('pedidos diretos ao endpoint', () => {
    // Nenhum deles depende da largura da tela: rodar de novo no celular só dobraria os pedidos,
    // e o do teto teria com quem colidir no Worker reservado a ele.
    test.skip(({ isMobile }) => isMobile === true, 'não dependem da largura da tela');

    test('a isca preenchida é recusada', async () => {
      const resposta = await noModoDeTeste(corpo({ empresa: 'ACME Ltda' }));
      expect(resposta.status).toBe(400);
      expect(resposta.json()).toEqual({ ok: false, erro: 'isca' });
    });

    test('um corpo acima do teto é recusado', async () => {
      const resposta = await postar(
        `${urlDoTeto}/api/contato`,
        urlDoTeto,
        corpo({ mensagem: 'a'.repeat(LIMITE_DO_CORPO) }),
      );
      expect(resposta.status).toBe(413);
    });

    test('um token que o Turnstile recusa é recusado', async () => {
      const resposta = await noModoDeTeste(corpo({ 'cf-turnstile-response': 'token-forjado' }));
      expect(resposta.status).toBe(403);
      expect(resposta.json()).toEqual({ ok: false, erro: 'verificacao' });
    });

    test('um POST de formulário vindo de outro site é barrado antes do endpoint', async () => {
      const resposta = await noModoDeTeste(corpo(), 'https://outro-site.example');
      expect(resposta.status).toBe(403);
    });

    test('um campo inválido volta com a lista do que falta', async () => {
      const resposta = await noModoDeTeste(corpo({ email: 'ana@', consentimento: '' }));
      expect(resposta.status).toBe(400);
      expect(resposta.json()).toEqual({
        ok: false,
        erro: 'campos',
        campos: ['email', 'consentimento'],
      });
    });
  });
});
