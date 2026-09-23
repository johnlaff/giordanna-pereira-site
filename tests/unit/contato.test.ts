import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESTINO_PADRAO, lerModo, REMETENTE_PADRAO, type Modo } from '../../src/contato/modo.ts';
import {
  assuntos,
  emailDaMensagem,
  LIMITE_DO_CORPO,
  lerMensagem,
  type Email,
} from '../../src/contato/mensagem.ts';
import { receberContato } from '../../src/contato/receber.ts';
import {
  EMAIL_QUE_FALHA,
  servicosDe,
  TOKEN_DE_TESTE,
  type Servicos,
} from '../../src/contato/servicos.ts';

/** Um formulário preenchido como o de um visitante de verdade. */
const valido = (mudancas: Record<string, string> = {}) =>
  new URLSearchParams({
    empresa: '',
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    whatsapp: '',
    assunto: 'Projeto residencial',
    mensagem: 'Quero reformar a cozinha do meu apartamento.',
    consentimento: 'on',
    'cf-turnstile-response': 'token-do-widget',
    ...mudancas,
  });

const real: Modo = lerModo({ RESEND_API_KEY: 're_x', TURNSTILE_SECRET_KEY: '0x_y' });

/** Serviços espiões: dizem sim ou não e anotam o que receberam. */
const espioes = ({ verifica = true, envia = true } = {}) => {
  const enviados: Email[] = [];
  const tokens: string[] = [];
  const servicos: Servicos = {
    verificar: async (token) => (tokens.push(token), verifica),
    enviar: async (email) => (enviados.push(email), envia),
  };
  return { servicos, enviados, tokens };
};

const pedido = (corpo: string | URLSearchParams, cabecalhos: Record<string, string> = {}) =>
  new Request('https://giordannapereira.arq.br/api/contato', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...cabecalhos },
    body: corpo.toString(),
  });

const erroDe = async (resposta: Response) => ((await resposta.json()) as { erro?: string }).erro;

// O console do teste não precisa dos avisos que o Worker grava no log.
console.warn = () => {};
console.error = () => {};

// ——— a Mensagem ———

test('um formulário completo vira uma Mensagem, com os espaços das pontas aparados', () => {
  const leitura = lerMensagem(valido({ nome: '  Ana Souza ', whatsapp: ' (34) 99999-0000 ' }));
  assert.deepEqual(leitura, {
    ok: true,
    mensagem: {
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      whatsapp: '(34) 99999-0000',
      assunto: 'Projeto residencial',
      mensagem: 'Quero reformar a cozinha do meu apartamento.',
    },
  });
});

test('a isca preenchida recusa antes de olhar qualquer outro campo', () => {
  assert.deepEqual(lerMensagem(valido({ empresa: 'ACME', nome: '' })), {
    ok: false,
    motivo: 'isca',
  });
});

test('todos os campos inválidos voltam de uma vez, não um por envio', () => {
  const leitura = lerMensagem(
    valido({
      nome: 'A',
      email: 'ana@',
      assunto: 'Orçamento',
      mensagem: 'curta',
      consentimento: '',
    }),
  );
  assert.deepEqual(leitura, {
    ok: false,
    motivo: 'campos',
    campos: ['nome', 'email', 'assunto', 'mensagem', 'consentimento'],
  });
});

test('o assunto precisa ser um dos cinco do formulário', () => {
  for (const assunto of assuntos) assert.equal(lerMensagem(valido({ assunto })).ok, true);
  assert.equal(lerMensagem(valido({ assunto: '' })).ok, false);
});

test('a mensagem conta o texto sem os espaços das pontas: dez letras, não dez espaços', () => {
  assert.equal(lerMensagem(valido({ mensagem: `  ${'a'.repeat(9)}          ` })).ok, false);
  assert.equal(lerMensagem(valido({ mensagem: 'a'.repeat(10) })).ok, true);
  assert.equal(lerMensagem(valido({ mensagem: 'a'.repeat(4001) })).ok, false);
});

test('o e-mail chega a Giordanna com o visitante no reply-to e o assunto de uma linha só', () => {
  const leitura = lerMensagem(valido({ nome: 'Ana\r\nBcc: robo@spam.com' }));
  assert.ok(leitura.ok);
  const email = emailDaMensagem(leitura.mensagem, { de: 'site@x.br', para: 'contato@x.br' });
  assert.equal(email.responderPara, 'ana@exemplo.com');
  assert.equal(email.para, 'contato@x.br');
  assert.doesNotMatch(email.assunto, /[\r\n]/);
  assert.match(email.assunto, /^Contato pelo site: Projeto residencial — Ana Bcc/);
  assert.match(email.texto, /WhatsApp: não informado/);
  assert.match(email.texto, /Quero reformar a cozinha/);
});

// ——— o Modo ———

test('sem as duas chaves o Modo é incompleto e diz qual falta', () => {
  assert.deepEqual(lerModo({}), {
    tipo: 'incompleto',
    faltando: ['RESEND_API_KEY', 'TURNSTILE_SECRET_KEY'],
  });
  assert.deepEqual(lerModo({ RESEND_API_KEY: 're_x', TURNSTILE_SECRET_KEY: '  ' }), {
    tipo: 'incompleto',
    faltando: ['TURNSTILE_SECRET_KEY'],
  });
});

test('a falta de chave nunca liga o modo de teste: só a variável de modo, com o valor exato', () => {
  for (const modo of [undefined, '', 'Teste', 'test', 'true', '1'])
    assert.equal(lerModo({ CONTATO_MODO: modo }).tipo, 'incompleto', `modo ${modo}`);
  assert.equal(lerModo({ CONTATO_MODO: 'teste' }).tipo, 'teste');
});

test('com as duas chaves o Modo é real, com os endereços padrão ou os do painel', () => {
  assert.deepEqual(real, {
    tipo: 'real',
    chaves: { resend: 're_x', turnstile: '0x_y' },
    enderecos: { de: REMETENTE_PADRAO, para: DESTINO_PADRAO },
  });
  const outro = lerModo({
    RESEND_API_KEY: 're_x',
    TURNSTILE_SECRET_KEY: '0x_y',
    CONTATO_DESTINO: 'giordanna@exemplo.com',
  });
  assert.equal(outro.tipo === 'real' && outro.enderecos.para, 'giordanna@exemplo.com');
  assert.equal(DESTINO_PADRAO, 'contato@giordannapereira.arq.br');
});

// ——— o endpoint ———

test('um envio válido passa pelo Turnstile, sai pelo serviço de envio e responde 200', async () => {
  const { servicos, enviados, tokens } = espioes();
  const resposta = await receberContato(pedido(valido()), real, servicos);
  assert.equal(resposta.status, 200);
  assert.deepEqual(await resposta.json(), { ok: true });
  assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(tokens, ['token-do-widget']);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0]?.para, DESTINO_PADRAO);
  assert.equal(enviados[0]?.responderPara, 'ana@exemplo.com');
});

test('sem as chaves o endpoint recusa com 503, sem ler o corpo nem enviar nada', async () => {
  const resposta = await receberContato(pedido(valido()), lerModo({}));
  assert.equal(resposta.status, 503);
  assert.equal(await erroDe(resposta), 'indisponivel');
});

test('a isca preenchida é recusada sem gastar o token nem enviar', async () => {
  const { servicos, enviados, tokens } = espioes();
  const resposta = await receberContato(pedido(valido({ empresa: 'ACME' })), real, servicos);
  assert.equal(resposta.status, 400);
  assert.equal(await erroDe(resposta), 'isca');
  assert.deepEqual([tokens, enviados], [[], []]);
});

test('campo inválido é recusado com a lista dos campos, sem gastar o token', async () => {
  const { servicos, enviados, tokens } = espioes();
  const resposta = await receberContato(pedido(valido({ email: 'x' })), real, servicos);
  assert.equal(resposta.status, 400);
  assert.deepEqual(await resposta.json(), { ok: false, erro: 'campos', campos: ['email'] });
  assert.deepEqual([tokens, enviados], [[], []]);
});

test('corpo acima do teto é recusado com 413, declarado ou não', async () => {
  const grande = valido({ mensagem: 'a'.repeat(LIMITE_DO_CORPO) });
  for (const cabecalhos of [{}, { 'Content-Length': String(LIMITE_DO_CORPO + 1) }]) {
    const { servicos, enviados } = espioes();
    const resposta = await receberContato(pedido(grande, cabecalhos), real, servicos);
    assert.equal(resposta.status, 413);
    assert.equal(await erroDe(resposta), 'grande');
    assert.equal(enviados.length, 0);
  }
});

test('um corpo que não veio de formulário é recusado com 415', async () => {
  const { servicos, enviados } = espioes();
  const resposta = await receberContato(
    pedido('{"nome":"Ana"}', { 'Content-Type': 'application/json' }),
    real,
    servicos,
  );
  assert.equal(resposta.status, 415);
  assert.equal(enviados.length, 0);
});

test('token recusado pelo Turnstile é recusado com 403, sem enviar', async () => {
  const { servicos, enviados } = espioes({ verifica: false });
  const resposta = await receberContato(pedido(valido()), real, servicos);
  assert.equal(resposta.status, 403);
  assert.equal(await erroDe(resposta), 'verificacao');
  assert.equal(enviados.length, 0);
});

test('Turnstile fora do ar vira recusa, não erro do Worker', async () => {
  const servicos: Servicos = {
    verificar: () => Promise.reject(new Error('timeout')),
    enviar: () => assert.fail('não deveria enviar'),
  };
  const resposta = await receberContato(pedido(valido()), real, servicos);
  assert.equal(resposta.status, 403);
});

test('falha no serviço de envio responde 502, e o formulário mostra a alternativa', async () => {
  for (const enviar of [async () => false, () => Promise.reject(new Error('fora do ar'))]) {
    const servicos: Servicos = { verificar: async () => true, enviar };
    const resposta = await receberContato(pedido(valido()), real, servicos);
    assert.equal(resposta.status, 502);
    assert.equal(await erroDe(resposta), 'envio');
  }
});

// ——— os dublês do modo de teste ———

test('o dublê do Turnstile aceita o vazio e o token de teste, e recusa qualquer outro', async () => {
  const dubles = servicosDe(lerModo({ CONTATO_MODO: 'teste' }));
  assert.ok(dubles);
  assert.equal(await dubles.verificar('', undefined), true);
  assert.equal(await dubles.verificar(TOKEN_DE_TESTE, undefined), true);
  assert.equal(await dubles.verificar('token-forjado', undefined), false);
});

test('o dublê do envio falha só para o e-mail reservado à falha', async () => {
  const dubles = servicosDe(lerModo({ CONTATO_MODO: 'teste' }));
  assert.ok(dubles);
  const email = (responderPara: string): Email => ({
    de: 'a',
    para: 'b',
    responderPara,
    assunto: 'c',
    texto: 'd',
  });
  assert.equal(await dubles.enviar(email('ana@exemplo.com')), true);
  assert.equal(await dubles.enviar(email(EMAIL_QUE_FALHA)), false);
});

test('sem chave não há serviço algum, nem dublê', () => {
  assert.equal(servicosDe(lerModo({})), undefined);
});

// ——— os serviços reais, com a rede trocada por um `fetch` falso ———

/** Troca o `fetch` global durante o teste e devolve os pedidos que ele recebeu. */
const comFetch = async (responder: () => Response, corpo: () => Promise<void>) => {
  const original = globalThis.fetch;
  const pedidos: { url: string; init: RequestInit | undefined }[] = [];
  globalThis.fetch = async (url, init) => (pedidos.push({ url: String(url), init }), responder());
  try {
    await corpo();
  } finally {
    globalThis.fetch = original;
  }
  return pedidos;
};

const reais = () => {
  const servicos = servicosDe(real);
  assert.ok(servicos);
  return servicos;
};

test('sem token o Turnstile real recusa sem nem perguntar à Cloudflare', async () => {
  const pedidos = await comFetch(
    () => Response.json({ success: true }),
    async () => assert.equal(await reais().verificar('', '203.0.113.9'), false),
  );
  assert.deepEqual(pedidos, []);
});

test('o Turnstile real manda a chave secreta, o token e o IP, e só aceita success true', async () => {
  let resposta = { success: true } as object;
  const pedidos = await comFetch(
    () => Response.json(resposta),
    async () => {
      assert.equal(await reais().verificar('tok', '203.0.113.9'), true);
      resposta = { success: false };
      assert.equal(await reais().verificar('tok', undefined), false);
      resposta = { success: 'true' };
      assert.equal(await reais().verificar('tok', undefined), false);
    },
  );
  assert.equal(pedidos[0]?.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  const enviado = pedidos[0]?.init?.body as URLSearchParams;
  assert.equal(enviado.get('secret'), '0x_y');
  assert.equal(enviado.get('response'), 'tok');
  assert.equal(enviado.get('remoteip'), '203.0.113.9');
});

test('o Resend real recebe o reply-to do visitante e a chave no cabeçalho', async () => {
  const leitura = lerMensagem(valido());
  assert.ok(leitura.ok);
  const email = emailDaMensagem(leitura.mensagem, { de: 'site@x.br', para: 'contato@x.br' });
  const pedidos = await comFetch(
    () => new Response('{}', { status: 200 }),
    async () => assert.equal(await reais().enviar(email), true),
  );
  assert.equal(pedidos[0]?.url, 'https://api.resend.com/emails');
  const cabecalhos = pedidos[0]?.init?.headers as Record<string, string>;
  assert.equal(cabecalhos['Authorization'], 'Bearer re_x');
  assert.deepEqual(JSON.parse(String(pedidos[0]?.init?.body)), {
    from: 'site@x.br',
    to: ['contato@x.br'],
    reply_to: 'ana@exemplo.com',
    subject: email.assunto,
    text: email.texto,
  });
});

test('uma recusa do Resend chega ao endpoint como envio falho', async () => {
  await comFetch(
    () => new Response('{"message":"domínio não verificado"}', { status: 403 }),
    async () => {
      const leitura = lerMensagem(valido());
      assert.ok(leitura.ok);
      assert.equal(
        await reais().enviar(emailDaMensagem(leitura.mensagem, { de: 'a@x.br', para: 'b@x.br' })),
        false,
      );
    },
  );
});
