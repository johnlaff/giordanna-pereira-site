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

test('o cache de imagens acompanha o que decide as variantes', () => {
  // A chave presa só a `src/assets` deixaria o cache servir variantes de outra qualidade: o
  // build regeraria o acervo a cada corrida sem nunca conseguir gravar a chave de novo. O
  // serviço entra pelo motivo inverso: o nome do arquivo gerado não registra a compressão,
  // então uma mudança lá passaria despercebida e o cache continuaria servindo o antigo.
  const setup = readFileSync('.github/actions/setup/action.yml', 'utf8');
  const chave = /key: astro-assets-.*hashFiles\(([^)]*)\)/.exec(setup)?.[1] ?? '';
  for (const caminho of ["'src/assets/**'", "'src/imagens.ts'", "'src/servico-de-imagem.ts'"])
    assert.ok(chave.includes(caminho), `fora da chave do cache: ${caminho}`);
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
