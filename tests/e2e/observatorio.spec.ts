import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { certificado, hostDoObservatorio, prepararScanner, scanner } from './observatorio.ts';
import { rota404, rotas } from './rotas.ts';

type Varredura = {
  scan: { grade: string; score: number };
  tests: Record<string, { pass: boolean; result: string; scoreModifier: number }>;
};

/**
 * O MDN HTTP Observatory sobre uma rota do Worker local em HTTPS (ADR 0013). O HTTP puro não
 * existe nele — em Produção quem responde no `http://` e redireciona é a Cloudflare —, e o
 * scanner, sem porta HTTP, dá o redirecionamento por desnecessário. O resto é a varredura
 * inteira: a CSP de cada página, os headers de `public/_headers`, SRI, cookies e CORS.
 */
const varrer = async (rota: string): Promise<Varredura> => {
  prepararScanner();
  // Sem proxy: a varredura é da própria máquina, e o scanner herdaria o do ambiente.
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_EXTRA_CA_CERTS: certificado };
  for (const nome of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']) delete env[nome];
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [scanner, `${hostDoObservatorio}${rota}`],
    { env },
  );
  return JSON.parse(stdout) as Varredura;
};

// A 404 fica de fora: o Observatory só varre página que responde 2xx ou 3xx.
for (const rota of rotas.filter((rota) => rota !== rota404)) {
  test(`HTTP Observatory dá A ou mais a ${rota}`, async () => {
    // A varredura é do servidor, não do navegador: basta um projeto do Playwright.
    test.skip(test.info().project.name !== 'desktop', 'a varredura não depende da tela');
    const { scan, tests } = await varrer(rota);
    const reprovados = Object.values(tests)
      .filter(({ scoreModifier }) => scoreModifier < 0)
      .map(({ result, scoreModifier }) => `${result} (${scoreModifier})`);
    expect(reprovados, `nota ${scan.grade}`).toEqual([]);
    expect(scan.score).toBeGreaterThanOrEqual(90);
  });
}
