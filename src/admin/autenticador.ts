/**
 * O autenticador do CMS: o caminho de ida e volta entre `/admin` e o GitHub que termina com
 * Giordanna logada (ADR 0014). É o mesmo protocolo do Sveltia CMS Authenticator, só que
 * dentro do Worker do site e na mesma origem do CMS, e não num Worker à parte.
 *
 * 1. O CMS abre uma janela em `/api/admin/entrar`. Com as chaves do OAuth App, ela segue para
 *    o GitHub levando um estado aleatório, que também fica num cookie; sem as chaves, falha
 *    fechado e o CMS mostra o motivo.
 * 2. O GitHub devolve a janela em `/api/admin/retorno` com um código. O estado precisa bater
 *    com o do cookie — é o que prova que o login começou aqui, e não num link de terceiros —,
 *    e só então o código é trocado pelo token, com o segredo que nunca sai do Worker.
 * 3. A página do retorno entrega o token ao CMS por `postMessage`, e só à própria origem.
 *
 * Mora fora de `src/pages/api/admin/` para ser verificável sem o runtime: os endpoints só leem
 * as variáveis do Worker, e o GitHub entra por parâmetro, trocado por um dublê nos testes.
 */
import { HEADERS_DE_SEGURANCA } from '../headers-de-seguranca.ts';

/** As variáveis do Worker que o login lê: as credenciais do OAuth App do GitHub. */
export type VariaveisDoLogin = {
  GITHUB_CLIENT_ID?: string | undefined;
  GITHUB_CLIENT_SECRET?: string | undefined;
};

/** O que vai ao GitHub para trocar o código pelo token. */
export type PedidoDeToken = {
  code: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
};

/** A troca do código pelo token: o token, a recusa do GitHub ou a falha em ouvi-lo. */
export type Troca = (
  pedido: PedidoDeToken,
) => Promise<{ token: string } | { erro: string } | { falha: 'rede' | 'formato' }>;

/**
 * Os motivos de falha, com os códigos que o Sveltia traduz na tela de login
 * (`sign_in_error.*` dos locales dele).
 */
type Falha =
  | 'MISCONFIGURED_CLIENT'
  | 'AUTH_CODE_REQUEST_FAILED'
  | 'CSRF_DETECTED'
  | 'TOKEN_REQUEST_FAILED'
  | 'MALFORMED_RESPONSE';

/** O único backend do CMS; o protocolo o repete em cada mensagem. */
const PROVEDOR = 'github';

/**
 * O que o token pode fazer: ler e gravar nos repositórios públicos de quem entra, e nada nos
 * privados. O repositório do site é público. O CMS manda o escopo que quer na janela
 * (`auth_scope` de `src/admin/configuracao.ts`), e este endpoint não o lê: é aberto a qualquer
 * um, e o token guarda o escopo que o GitHub concedeu, que é sempre este.
 */
const ESCOPO = 'public_repo';

const COOKIE_DO_ESTADO = 'estado-do-login';

/** O cookie só volta para as duas rotas do login, e vive o tempo de um login. */
const ATRIBUTOS_DO_COOKIE = 'HttpOnly; Secure; SameSite=Lax; Path=/api/admin';

const DEZ_MINUTOS = 600;

const retornoDe = (pedido: Request) => `${new URL(pedido.url).origin}/api/admin/retorno`;

/**
 * O script da janela de login, igual em toda resposta: o que muda vai no bloco de dados ao
 * lado. Por ser fixo, a CSP o libera pelo hash, e nada mais roda na página.
 *
 * O CMS abre a janela e espera `authorizing:github`; responde com a mesma mensagem, e aí recebe
 * o resultado. As duas pontas só aceitam a própria origem, então o token não sai do site
 * mesmo que outra página tenha aberto a janela.
 */
const SCRIPT = `const { provider, estado, conteudo } = JSON.parse(document.getElementById('relato').textContent);
const resultado = 'authorization:' + provider + ':' + estado + ':' + JSON.stringify(conteudo);
addEventListener('message', ({ data, origin }) => {
  if (origin === location.origin && data === 'authorizing:' + provider)
    opener?.postMessage(resultado, location.origin);
});
opener?.postMessage('authorizing:' + provider, location.origin);`;

let hashDoScript: Promise<string> | undefined;

const hash = (texto: string) =>
  crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(texto))
    .then((bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))));

/** A página que a janela de login mostra ao fim de cada passo, com o relato para o CMS. */
const pagina = async (
  relato: { estado: 'success'; token: string } | { estado: 'error'; codigo: Falha; erro: string },
  cabecalhos: Record<string, string> = {},
): Promise<Response> => {
  const conteudo =
    relato.estado === 'success'
      ? { provider: PROVEDOR, token: relato.token }
      : { provider: PROVEDOR, error: relato.erro, errorCode: relato.codigo };
  // Dentro de `<script>`, um `</script>` no conteúdo fecharia o bloco: o `<` vai escapado.
  const dados = JSON.stringify({ provider: PROVEDOR, estado: relato.estado, conteudo }).replaceAll(
    '<',
    '\\u003c',
  );
  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Entrar no CMS</title></head>
<body>
<p>${relato.estado === 'success' ? 'Pronto. Você pode fechar esta janela.' : 'Não foi possível entrar. Feche esta janela e tente de novo.'}</p>
<script type="application/json" id="relato">${dados}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
  hashDoScript ??= hash(SCRIPT);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'sha256-${await hashDoScript}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      // A página pode carregar um token: nem o navegador nem a Cloudflare podem guardá-la.
      'Cache-Control': 'no-store',
      ...HEADERS_DE_SEGURANCA,
      ...cabecalhos,
    },
  });
};

const falha = (codigo: Falha, erro: string, cabecalhos?: Record<string, string>) => {
  console.warn(`login do CMS recusado: ${codigo}`);
  return pagina({ estado: 'error', codigo, erro }, cabecalhos);
};

/** Uma variável vazia ou só com espaço conta como ausente, como em `src/contato/modo.ts`. */
const credenciais = (variaveis: VariaveisDoLogin) => {
  const id = variaveis.GITHUB_CLIENT_ID?.trim();
  const segredo = variaveis.GITHUB_CLIENT_SECRET?.trim();
  return id && segredo ? { id, segredo } : undefined;
};

const SEM_CHAVES = 'O login do CMS ainda não foi configurado: faltam as chaves do OAuth App.';

/** 32 dígitos hexadecimais, o formato que `estadoGuardado` reconhece no cookie. */
const estadoAleatorio = () => crypto.randomUUID().replaceAll('-', '');

/** O primeiro passo: leva ao GitHub, ou diz ao CMS por que não. */
export const iniciarLogin = async (
  pedido: Request,
  variaveis: VariaveisDoLogin,
  { gerarEstado = estadoAleatorio }: { gerarEstado?: () => string } = {},
): Promise<Response> => {
  const chaves = credenciais(variaveis);
  if (chaves === undefined) return falha('MISCONFIGURED_CLIENT', SEM_CHAVES);

  const estado = gerarEstado();
  const destino = new URL('https://github.com/login/oauth/authorize');
  destino.search = new URLSearchParams({
    client_id: chaves.id,
    redirect_uri: retornoDe(pedido),
    scope: ESCOPO,
    state: estado,
  }).toString();

  return new Response(null, {
    status: 302,
    headers: {
      Location: destino.href,
      'Set-Cookie': `${COOKIE_DO_ESTADO}=${estado}; ${ATRIBUTOS_DO_COOKIE}; Max-Age=${DEZ_MINUTOS}`,
      'Cache-Control': 'no-store',
      ...HEADERS_DE_SEGURANCA,
    },
  });
};

/** O estado que o primeiro passo guardou no navegador, se houver. */
const estadoGuardado = (pedido: Request) =>
  new RegExp(`(?:^|;\\s*)${COOKIE_DO_ESTADO}=([0-9a-f]{32})(?:;|$)`).exec(
    pedido.headers.get('Cookie') ?? '',
  )?.[1];

/** A troca de verdade, no endpoint de tokens do GitHub. */
export const trocarNoGitHub: Troca = async (pedido) => {
  let resposta: Response;
  try {
    resposta = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido),
    });
  } catch {
    return { falha: 'rede' };
  }
  try {
    const corpo = (await resposta.json()) as { access_token?: unknown; error?: unknown };
    if (typeof corpo.access_token === 'string' && corpo.access_token !== '')
      return { token: corpo.access_token };
    return { erro: typeof corpo.error === 'string' ? corpo.error : `HTTP ${resposta.status}` };
  } catch {
    return { falha: 'formato' };
  }
};

/** O segundo passo: confere o estado, troca o código pelo token e o entrega ao CMS. */
export const concluirLogin = async (
  pedido: Request,
  variaveis: VariaveisDoLogin,
  { trocar = trocarNoGitHub }: { trocar?: Troca } = {},
): Promise<Response> => {
  // O estado é de uso único: toda resposta do retorno o apaga, dê certo ou não.
  const apagarEstado = {
    'Set-Cookie': `${COOKIE_DO_ESTADO}=; ${ATRIBUTOS_DO_COOKIE}; Max-Age=0`,
  };
  const chaves = credenciais(variaveis);
  if (chaves === undefined) return falha('MISCONFIGURED_CLIENT', SEM_CHAVES, apagarEstado);

  const busca = new URL(pedido.url).searchParams;
  const estado = busca.get('state');
  const guardado = estadoGuardado(pedido);
  if (guardado === undefined || estado !== guardado)
    return falha('CSRF_DETECTED', 'O login não começou nesta janela. Tente de novo.', apagarEstado);

  const codigo = busca.get('code');
  if (!codigo)
    return falha(
      'AUTH_CODE_REQUEST_FAILED',
      `O GitHub não autorizou o acesso (${busca.get('error') ?? 'sem código'}).`,
      apagarEstado,
    );

  const troca = await trocar({
    code: codigo,
    client_id: chaves.id,
    client_secret: chaves.segredo,
    redirect_uri: retornoDe(pedido),
  });
  if ('token' in troca) return pagina({ estado: 'success', token: troca.token }, apagarEstado);
  if ('erro' in troca) return falha('TOKEN_REQUEST_FAILED', troca.erro, apagarEstado);
  return troca.falha === 'rede'
    ? falha('TOKEN_REQUEST_FAILED', 'O GitHub não respondeu. Tente de novo.', apagarEstado)
    : falha('MALFORMED_RESPONSE', 'O GitHub respondeu algo inesperado.', apagarEstado);
};
