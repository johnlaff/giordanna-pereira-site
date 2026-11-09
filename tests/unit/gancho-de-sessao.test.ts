import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const gancho = resolve('.claude/hooks/session-start.sh');

// Roda o gancho num projeto de mentira: `node` responde a versão dada, `pnpm` não faz nada e
// o nvm só anota o que pediram a ele.
const rodar = (nodeVersion: string, nodeInstalado: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'gancho-'));
  const bin = join(dir, 'bin');
  const nvm = join(dir, 'nvm');
  const log = join(dir, 'nvm.log');
  mkdirSync(bin);
  mkdirSync(nvm);
  writeFileSync(join(dir, '.node-version'), `${nodeVersion}\n`);
  writeFileSync(join(bin, 'node'), `#!/bin/sh\necho v${nodeInstalado}\n`);
  writeFileSync(join(bin, 'pnpm'), '#!/bin/sh\n');
  chmodSync(join(bin, 'node'), 0o755);
  chmodSync(join(bin, 'pnpm'), 0o755);
  writeFileSync(join(nvm, 'nvm.sh'), `nvm() { echo "nvm $*" >> '${log}'; }\n`);
  execFileSync('bash', [gancho], {
    env: {
      PATH: `${bin}:/usr/bin:/bin`,
      CLAUDE_CODE_REMOTE: 'true',
      CLAUDE_PROJECT_DIR: dir,
      NVM_DIR: nvm,
    },
  });
  return existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
};

test('o gancho instala pelo nvm a versão inteira da .node-version quando a major é maior', () => {
  assert.deepEqual(rodar('26.13.0', '24.22.0'), ['nvm install 26.13.0', 'nvm use 26.13.0']);
});

test('o gancho não troca de Node quando a major instalada já é a pedida', () => {
  assert.deepEqual(rodar('24.22.2', '24.22.0'), []);
});
