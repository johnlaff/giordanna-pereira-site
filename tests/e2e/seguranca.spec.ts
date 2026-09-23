import { expect, test, type Page } from '@playwright/test';
import { rotas } from './rotas.ts';

/** As duas origens externas que a CSP admite, ambas da Cloudflare (ADR 0005). */
const TURNSTILE = 'https://challenges.cloudflare.com';
const WEB_ANALYTICS = 'https://static.cloudflareinsights.com';

/** A política da página, diretiva por diretiva. */
const diretivas = (politica: string) =>
  new Map(
    politica
      .split(';')
      .map((trecho) => trecho.trim().split(/\s+/))
      .filter(([nome]) => nome)
      .map(([nome, ...fontes]) => [nome!, fontes]),
  );

for (const rota of rotas) {
  test(`a CSP de ${rota} admite só o site, o Turnstile e o Web Analytics`, async ({ page }) => {
    await page.goto(rota);
    const politica = await page
      .locator('meta[http-equiv="content-security-policy"]')
      .getAttribute('content');
    expect(politica, 'a página não tem CSP').not.toBeNull();
    const csp = diretivas(politica!);

    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('connect-src')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('frame-src')).toEqual([TURNSTILE]);
    const scripts = csp.get('script-src') ?? [];
    expect(scripts).toEqual(expect.arrayContaining(["'self'", TURNSTILE, WEB_ANALYTICS]));
    // Com 'strict-dynamic' o navegador ignora a lista de hosts, e o beacon injetado pela
    // Cloudflare, que não tem hash do build, seria barrado em silêncio (ADR 0005).
    expect(scripts).not.toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(csp.get('style-src') ?? []).not.toContain("'unsafe-inline'");
  });
}

/**
 * Registra toda violação de CSP da página: a do evento `securitypolicyviolation`, que o
 * navegador dispara no documento, e a do console, que é onde elas aparecem para quem depura.
 */
const vigiarViolacoes = async (page: Page) => {
  const doConsole: string[] = [];
  page.on('console', (mensagem) => {
    if (/Content Security Policy/i.test(mensagem.text())) doConsole.push(mensagem.text());
  });
  await page.addInitScript(() => {
    const registro: string[] = [];
    Object.assign(window, { violacoesDeCsp: registro });
    document.addEventListener('securitypolicyviolation', (evento) =>
      registro.push(`${evento.violatedDirective} barrou ${evento.blockedURI || 'inline'}`),
    );
  });
  return async () => [
    ...doConsole,
    ...(await page.evaluate(
      () => (window as unknown as { violacoesDeCsp: string[] }).violacoesDeCsp,
    )),
  ];
};

for (const rota of rotas) {
  test(`nenhuma violação de CSP em ${rota}`, async ({ page }) => {
    const violacoes = await vigiarViolacoes(page);
    await page.goto(rota);
    // Descer a página inteira carrega as imagens preguiçosas e dispara cada bloco que entra ao
    // aparecer; passar o mouse num link interno faz o prefetch dele.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
        scrollTo(0, y);
        await new Promise((pronto) => setTimeout(pronto, 50));
      }
    });
    const link = page.locator('main a[href^="/"]:visible').first();
    if ((await link.count()) > 0) await link.hover();
    await page.waitForLoadState('networkidle');
    expect(await violacoes()).toEqual([]);
  });
}

test('o lightbox abre, navega e amplia sem violação de CSP', async ({ page }) => {
  const violacoes = await vigiarViolacoes(page);
  await page.goto('/projetos/edificio-vitalis');
  await page.locator('.gal .item').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.locator('.pswp__button--zoom').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.pswp')).toBeHidden();
  expect(await violacoes()).toEqual([]);
});

/** Os headers de segurança que toda resposta do site leva, estática ou do Worker. */
const conferirHeaders = (headers: Record<string, string>) => {
  // Dois anos, subdomínios inclusos: o que o HSTS preload exige, sem ainda pedir a inclusão.
  expect(headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  // Nada no site usa câmera, microfone, localização ou pagamento; a política os desliga para
  // a página e para o iframe do Turnstile.
  const permissoes = headers['permissions-policy'] ?? '';
  for (const recurso of ['camera', 'microphone', 'geolocation', 'payment', 'usb'])
    expect(permissoes).toContain(`${recurso}=()`);
};

for (const rota of rotas) {
  test(`${rota} responde com os headers de segurança`, async ({ request }) => {
    conferirHeaders((await request.get(rota)).headers());
  });
}

// O `public/_headers` só vale para o que é estático; a resposta do Worker leva os seus.
test('o endpoint do contato responde com os headers de segurança', async ({ request, baseURL }) => {
  const resposta = await request.post('/api/contato', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: baseURL ?? '' },
    data: 'nome=Ana',
  });
  // Sem chaves, o Worker da suíte recusa tudo (ADR 0011): a recusa também é resposta dele.
  expect(resposta.status()).toBe(503);
  conferirHeaders(resposta.headers());
});

// O CMS fica fora das rotas públicas e da regra das duas origens (ADR 0014), mas não dos headers.
test('o CMS responde com os headers de segurança', async ({ request }) => {
  conferirHeaders((await request.get('/admin')).headers());
});

// A janela de login é uma navegação, como a do CMS: sem as rotas da API indo antes ao Worker,
// ela receberia a página 404 dos arquivos estáticos.
test('a janela de login do CMS é do Worker, com os headers de segurança e CSP só dela', async ({
  request,
}) => {
  const resposta = await request.get('/api/admin/entrar?provider=github', {
    headers: { 'Sec-Fetch-Mode': 'navigate', Accept: 'text/html' },
  });
  // Sem as chaves do OAuth App, o Worker da suíte falha fechado e diz o motivo ao CMS.
  expect(resposta.status()).toBe(200);
  expect(await resposta.text()).toContain('MISCONFIGURED_CLIENT');
  const headers = resposta.headers();
  conferirHeaders(headers);
  expect(headers['cache-control']).toBe('no-store');
  const csp = diretivas(headers['content-security-policy'] ?? '');
  expect(csp.get('default-src')).toEqual(["'none'"]);
  expect(csp.get('script-src')).toEqual([expect.stringMatching(/^'sha256-[\w+/]+=*'$/)]);
  expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
});

/**
 * Serve `rota` com `trecho` logo antes do `</body>`, como a Cloudflare faz ao injetar o beacon
 * na zona. O resto da resposta — a CSP inclusive — é o que o Worker entregou.
 */
const injetarNoFimDoBody = async (page: Page, rota: string, trecho: string) =>
  page.route(
    (url) => url.pathname === rota,
    async (route) => {
      const resposta = await route.fetch();
      const html = (await resposta.text()).replace('</body>', `${trecho}</body>`);
      await route.fulfill({ response: resposta, body: html });
    },
  );

// A suíte roda sem rede e sem chaves: os scripts da Cloudflare são dublês, servidos das URLs
// reais. O que se prova é a CSP — que ela deixa o script carregar, rodar e falar com quem ele
// fala em Produção —, não o comportamento do script.
test('o beacon do Web Analytics roda sob a CSP e reporta à própria origem', async ({ page }) => {
  const violacoes = await vigiarViolacoes(page);
  await page.route(`${WEB_ANALYTICS}/beacon.min.js`, (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: "navigator.sendBeacon('/cdn-cgi/rum', '{}');",
    }),
  );
  await page.route('**/cdn-cgi/rum', (route) => route.fulfill({ status: 204 }));
  await injetarNoFimDoBody(
    page,
    '/',
    `<script defer src="${WEB_ANALYTICS}/beacon.min.js" data-cf-beacon='{"token": "teste"}'></script>`,
  );
  const relato = page.waitForRequest('**/cdn-cgi/rum');
  await page.goto('/');
  await relato;
  expect(await violacoes()).toEqual([]);
});

test('o Turnstile carrega o script e o desafio sob a CSP', async ({ page }) => {
  const violacoes = await vigiarViolacoes(page);
  const desafio = `${TURNSTILE}/cdn-cgi/challenge-platform/turnstile/if/teste`;
  await page.route(`${TURNSTILE}/turnstile/v0/api.js`, (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `const f = document.createElement('iframe');
        f.src = '${desafio}';
        f.title = 'Turnstile';
        document.querySelector('.cf-turnstile').append(f);`,
    }),
  );
  await page.route(desafio, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>desafio</title>' }),
  );
  // O que o FormContato escreve quando o build tem a chave de site.
  await injetarNoFimDoBody(
    page,
    '/contato',
    `<div class="cf-turnstile" data-sitekey="teste"></div>
     <script src="${TURNSTILE}/turnstile/v0/api.js" async defer></script>`,
  );
  await page.goto('/contato');
  await expect.poll(() => page.frames().some((frame) => frame.url() === desafio)).toBe(true);
  expect(await violacoes()).toEqual([]);
});

test.describe('sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  // Sem JavaScript ninguém revela os blocos `.rv`, e o conteúdo aparece assim mesmo. A regra
  // que garante isso não pode ser um `<style>` dentro de `<noscript>`: sem hash no build, a CSP
  // o barra e o conteúdo some.
  for (const rota of ['/', '/projetos', '/contato']) {
    test(`os blocos que entram ao rolar aparecem em ${rota}`, async ({ page }) => {
      const violacoes: string[] = [];
      page.on('console', (mensagem) => {
        if (/Content Security Policy/i.test(mensagem.text())) violacoes.push(mensagem.text());
      });
      await page.goto(rota);
      const opacidades = await page
        .locator('.rv')
        .evaluateAll((blocos) => blocos.map((bloco) => getComputedStyle(bloco).opacity));
      expect(opacidades.length).toBeGreaterThan(0);
      expect(opacidades.every((opacidade) => opacidade === '1')).toBe(true);
      expect(violacoes).toEqual([]);
    });
  }
});
