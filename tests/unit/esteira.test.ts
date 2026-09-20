import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';

// Um check exigido pelo ruleset que não existe como job em ci.yml bloqueia todo PR para sempre.
const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
const jobs = Object.keys(workflow.jobs);

type Regra = { type: string; parameters?: { required_status_checks?: { context: string }[] } };
type Ruleset = { bypass_actors: unknown[]; rules: Regra[] };
const rulesets: Ruleset[] = readdirSync('.github/rulesets')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`.github/rulesets/${f}`, 'utf8')));
const checksExigidos = new Set(
  rulesets
    .flatMap((r) => r.rules)
    .flatMap((regra) => regra.parameters?.required_status_checks ?? [])
    .map((c) => c.context),
);

const setup = readFileSync('.github/actions/setup/action.yml', 'utf8');
const linhaDoCache = (campo: 'key' | 'restore-keys') =>
  new RegExp(`^\\s*${campo}: (astro-assets-.*)$`, 'm').exec(setup)?.[1] ?? '';

// O que decide como uma variante é comprimida. O nome do arquivo gerado não registra isso,
// então é a chave do cache que precisa registrar.
const COMPRESSAO = ["'src/imagens.ts'", "'src/servico-de-imagem.ts'"];

test('a chave do cache de imagens cobre imagens e compressão', () => {
  const chave = linhaDoCache('key');
  for (const caminho of ["'src/assets/**'", ...COMPRESSAO])
    assert.ok(chave.includes(caminho), `fora da chave do cache: ${caminho}`);
});

test('a reserva do cache de imagens não atravessa uma mudança de compressão', () => {
  // Esta é a asserção que sustenta a outra. Com a compressão só na chave e uma reserva presa
  // apenas ao sistema operacional, a corrida seguinte erraria a chave, cairia na reserva e
  // receberia as variantes antigas — com os nomes certos, porque o nome não registra a
  // compressão —, e o build as daria por prontas. A compressão tem de estar no prefixo.
  const reserva = linhaDoCache('restore-keys');
  assert.notEqual(reserva, '', 'a action não declara restore-keys');
  for (const caminho of COMPRESSAO)
    assert.ok(reserva.includes(caminho), `fora do prefixo de reserva: ${caminho}`);
});

test('o workflow dispara em pull_request e em push para main', () => {
  assert.ok(workflow.on.pull_request !== undefined);
  assert.deepEqual(workflow.on.push.branches, ['main']);
});

test('todo check exigido pelo ruleset é um job do workflow', () => {
  assert.ok(checksExigidos.size > 0);
  for (const contexto of checksExigidos)
    assert.ok(jobs.includes(contexto), `job ausente: ${contexto}`);
});

test('todo job do workflow é exigido pelo ruleset', () => {
  for (const job of jobs) assert.ok(checksExigidos.has(job), `job sem gate: ${job}`);
});

test('force push e exclusão de main não têm bypass para ninguém', () => {
  const historico = rulesets.find((r) =>
    r.rules.some((regra) => regra.type === 'non_fast_forward'),
  );
  assert.ok(historico);
  assert.ok(historico.rules.some((regra) => regra.type === 'deletion'));
  assert.deepEqual(historico.bypass_actors, []);
});
