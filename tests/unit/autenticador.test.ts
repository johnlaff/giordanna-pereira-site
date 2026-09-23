import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  concluirLogin,
  iniciarLogin,
  type Troca,
  type VariaveisDoLogin,
} from '../../src/admin/autenticador.ts';

const ORIGEM = 'https://giordanna-pereira-site.joaoaraxaiba.workers.dev';
const CHAVES: VariaveisDoLogin = { GITHUB_CLIENT_ID: 'id-do-app', GITHUB_CLIENT_SECRET: 'segredo' };
const ESTADO = '0123456789abcdef0123456789abcdef';

const entrar = (busca = '?provider=github&site_id=site&scope=repo') =>
  new Request(`${ORIGEM}/api/admin/entrar${busca}`);

const retorno = (busca: string, cookie?: string) =>
  new Request(`${ORIGEM}/api/admin/retorno${busca}`, {
    headers: cookie === undefined ? {} : { Cookie: cookie },
  });

/** O cookie que `iniciarLogin` deixa no navegador, como ele volta no retorno do GitHub. */
const COOKIE = `estado-do-login=${ESTADO}`;

/** O que a janela de login entrega ao CMS, lido do bloco de dados da página. */
const relato = async (resposta: Response) => {
  const html = await resposta.text();
  const bloco = /<script type="application\/json" id="relato">(.*?)<\/script>/s.exec(html);
  assert.ok(bloco, 'a página não traz o relato para o CMS');
  return JSON.parse(bloco[1]!) as {
    provider: string;
    estado: 'success' | 'error';
    conteudo: { token?: string; error?: string; errorCode?: string };
  };
};

/** Um GitHub de mentira que registra o que recebeu e devolve o que o teste mandar. */
const gitHub = (resposta: Awaited<ReturnType<Troca>>) => {
  const pedidos: Parameters<Troca>[0][] = [];
  const trocar: Troca = async (pedido) => {
    pedidos.push(pedido);
    return resposta;
  };
  return { pedidos, trocar };
};

test('sem as chaves do OAuth App, o login falha fechado e diz por quê', async () => {
  for (const variaveis of [{}, { GITHUB_CLIENT_ID: 'id-do-app' }, { GITHUB_CLIENT_SECRET: ' ' }]) {
    const resposta = await iniciarLogin(entrar(), variaveis);
    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers.get('Location'), null);
    const { estado, conteudo } = await relato(resposta);
    assert.equal(estado, 'error');
    assert.equal(conteudo.errorCode, 'MISCONFIGURED_CLIENT');
  }
});

test('com as chaves, o login leva ao GitHub com o estado guardado num cookie', async () => {
  const resposta = await iniciarLogin(entrar(), CHAVES, { gerarEstado: () => ESTADO });
  assert.equal(resposta.status, 302);

  const destino = new URL(resposta.headers.get('Location') ?? '');
  assert.equal(`${destino.origin}${destino.pathname}`, 'https://github.com/login/oauth/authorize');
  assert.equal(destino.searchParams.get('client_id'), 'id-do-app');
  assert.equal(destino.searchParams.get('state'), ESTADO);
  assert.equal(destino.searchParams.get('redirect_uri'), `${ORIGEM}/api/admin/retorno`);

  const cookie = resposta.headers.get('Set-Cookie') ?? '';
  assert.match(cookie, new RegExp(`^estado-do-login=${ESTADO};`));
  for (const atributo of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/api/admin', 'Max-Age=600'])
    assert.ok(cookie.includes(atributo), `o cookie do estado precisa de ${atributo}`);
});

/** Para onde o login mandou o navegador. */
const destinoDe = async (pedido: Request) =>
  new URL((await iniciarLogin(pedido, CHAVES)).headers.get('Location') ?? '');

test('o escopo pedido ao GitHub é só o do repositório público, peça o CMS o que pedir', async () => {
  for (const busca of ['?provider=github&scope=repo,user', '?provider=github', ''])
    assert.equal((await destinoDe(entrar(busca))).searchParams.get('scope'), 'public_repo');
});

test('cada login nasce com um estado novo', async () => {
  const estadoDe = async () => (await destinoDe(entrar())).searchParams.get('state');
  const [a, b] = [await estadoDe(), await estadoDe()];
  assert.match(a ?? '', /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

test('um retorno sem o cookie do estado, ou com outro estado, é recusado sem falar com o GitHub', async () => {
  for (const [busca, cookie] of [
    [`?code=abc&state=${ESTADO}`, undefined],
    [`?code=abc&state=${ESTADO}`, 'estado-do-login=ffffffffffffffffffffffffffffffff'],
    ['?code=abc&state=ffffffffffffffffffffffffffffffff', COOKIE],
    ['?code=abc', COOKIE],
  ] as const) {
    const { pedidos, trocar } = gitHub({ token: 'não-deveria-sair' });
    const { estado, conteudo } = await relato(
      await concluirLogin(retorno(busca, cookie), CHAVES, { trocar }),
    );
    assert.equal(estado, 'error');
    assert.equal(conteudo.errorCode, 'CSRF_DETECTED', `${busca} com ${cookie}`);
    assert.equal(conteudo.token, undefined);
    assert.equal(pedidos.length, 0);
  }
});

test('quem recusa o acesso no GitHub volta sem código, e o CMS fica sabendo', async () => {
  const { pedidos, trocar } = gitHub({ token: 'não-deveria-sair' });
  const { estado, conteudo } = await relato(
    await concluirLogin(retorno(`?error=access_denied&state=${ESTADO}`, COOKIE), CHAVES, {
      trocar,
    }),
  );
  assert.equal(estado, 'error');
  assert.equal(conteudo.errorCode, 'AUTH_CODE_REQUEST_FAILED');
  assert.equal(pedidos.length, 0);
});

test('com código e estado certos, o token do GitHub vai para o CMS', async () => {
  const { pedidos, trocar } = gitHub({ token: 'gho_token' });
  const resposta = await concluirLogin(retorno(`?code=abc&state=${ESTADO}`, COOKIE), CHAVES, {
    trocar,
  });
  assert.deepEqual(pedidos, [
    {
      code: 'abc',
      client_id: 'id-do-app',
      client_secret: 'segredo',
      redirect_uri: `${ORIGEM}/api/admin/retorno`,
    },
  ]);
  assert.deepEqual(await relato(resposta.clone()), {
    provider: 'github',
    estado: 'success',
    conteudo: { provider: 'github', token: 'gho_token' },
  });
  // O estado vale uma vez só.
  assert.match(resposta.headers.get('Set-Cookie') ?? '', /^estado-do-login=; .*Max-Age=0/);
});

test('se o GitHub recusa o código, ou nem responde, o CMS fica sabendo e nenhum token sai', async () => {
  for (const [troca, codigo] of [
    [{ erro: 'bad_verification_code' }, 'TOKEN_REQUEST_FAILED'],
    [{ falha: 'rede' }, 'TOKEN_REQUEST_FAILED'],
    [{ falha: 'formato' }, 'MALFORMED_RESPONSE'],
  ] as const) {
    const { trocar } = gitHub(troca);
    const { estado, conteudo } = await relato(
      await concluirLogin(retorno(`?code=abc&state=${ESTADO}`, COOKIE), CHAVES, { trocar }),
    );
    assert.equal(estado, 'error');
    assert.equal(conteudo.errorCode, codigo);
    assert.equal(conteudo.token, undefined);
  }
});

test('sem as chaves, o retorno também falha fechado', async () => {
  const { pedidos, trocar } = gitHub({ token: 'não-deveria-sair' });
  const { conteudo } = await relato(
    await concluirLogin(retorno(`?code=abc&state=${ESTADO}`, COOKIE), {}, { trocar }),
  );
  assert.equal(conteudo.errorCode, 'MISCONFIGURED_CLIENT');
  assert.equal(pedidos.length, 0);
});

test('o relato não fecha a página antes da hora, mesmo com < no conteúdo', async () => {
  const { trocar } = gitHub({ erro: '</script><script>alert(1)</script>' });
  const resposta = await concluirLogin(retorno(`?code=abc&state=${ESTADO}`, COOKIE), CHAVES, {
    trocar,
  });
  const html = await resposta.clone().text();
  assert.equal(html.match(/<\/script>/g)?.length, 2, 'só o bloco de dados e o script fecham');
  assert.equal((await relato(resposta)).conteudo.error, '</script><script>alert(1)</script>');
});

test('a página da janela de login só roda o próprio script e não fica em cache', async () => {
  const resposta = await iniciarLogin(entrar(), {});
  const html = await resposta.text();
  const script = /<script>(.*?)<\/script>/s.exec(html)?.[1] ?? '';
  const hash = createHash('sha256').update(script).digest('base64');

  const csp = resposta.headers.get('Content-Security-Policy') ?? '';
  assert.match(csp, /default-src 'none'/);
  assert.ok(csp.includes(`script-src 'sha256-${hash}'`), `a CSP não libera o script: ${csp}`);
  assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
  assert.equal(resposta.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(resposta.headers.get('X-Content-Type-Options'), 'nosniff');
});
