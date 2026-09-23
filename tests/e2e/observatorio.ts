import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * O Worker em HTTPS que o MDN HTTP Observatory varre (ADR 0013). O Observatory só avalia o
 * HSTS numa resposta vinda por TLS, e a varredura confia no certificado: por isso este Worker
 * sobe com um certificado de `127.0.0.1` feito na hora, que o scanner recebe como autoridade.
 */
export const portaDoObservatorio = 8791;
/** Pelo IP e não por `localhost`: o scanner recusa host sem ponto, como recusaria `site` sem `.com`. */
export const hostDoObservatorio = `127.0.0.1:${portaDoObservatorio}`;
export const urlDoObservatorio = `https://${hostDoObservatorio}`;

const pasta = 'node_modules/.cache/observatorio';
export const certificado = join(pasta, 'certificado.pem');
const chave = join(pasta, 'chave.pem');

/** O `scan.js` do pacote. Pelo caminho real: ele só roda como CLI quando `argv[1]` é ele mesmo. */
const pacote = dirname(
  createRequire(import.meta.url).resolve('@mdn/mdn-http-observatory/package.json'),
);
export const scanner = realpathSync(join(pacote, 'src/scan.js'));

/**
 * O que o scanner precisa e a instalação não traz. O `postinstall` do pacote baixa a lista de
 * HSTS preload do Chromium; ele fica desligado (`allowBuilds` do `pnpm-workspace.yaml`) para o
 * `pnpm install` não depender da rede, e para `localhost` a lista é irrelevante. Sem o
 * arquivo, porém, o scanner nem abre.
 */
const prepararScanner = () => {
  const preload = join(pacote, 'conf/hsts-preload.json');
  if (!existsSync(preload)) writeFileSync(preload, '{}');
};

const gerarCertificado = () => {
  mkdirSync(pasta, { recursive: true });
  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '1',
    '-subj',
    '/CN=127.0.0.1',
    '-addext',
    'subjectAltName=IP:127.0.0.1',
    '-keyout',
    chave,
    '-out',
    certificado,
  ]);
};

// Rodado como comando de `webServer` pelo `playwright.config.ts`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  prepararScanner();
  gerarCertificado();
  const worker = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--ip',
      '127.0.0.1',
      '--port',
      String(portaDoObservatorio),
      '--inspector-port',
      '9232',
      '--local-protocol',
      'https',
      '--https-key-path',
      chave,
      '--https-cert-path',
      certificado,
      // O scanner sonda a porta também em HTTP puro, para saber se ela fala TLS, e o Worker
      // registra cada sonda como erro de handshake: ruído esperado, não falha.
      '--log-level',
      'none',
    ],
    { stdio: 'inherit' },
  );
  for (const sinal of ['SIGINT', 'SIGTERM'] as const) process.on(sinal, () => worker.kill(sinal));
  worker.on('exit', (codigo) => process.exit(codigo ?? 0));
}
