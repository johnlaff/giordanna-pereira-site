#!/usr/bin/env bash
# Prepara o container das sessões do Claude Code na web para compilar e testar o site.
# Duas coisas faltam lá, nenhuma delas do repositório: o container vem com Node 22, e o
# Chromium que ele traz pré-instalado é de outra versão do Playwright. Sem a primeira o
# `pnpm build` não roda; sem a segunda todo teste e2e que abre navegador falha com
# "Executable doesn't exist" e só passam os que usam requisição direta.
set -euo pipefail

# Só no ambiente remoto: na máquina de quem desenvolve, o ambiente é o dela.
[ "${CLAUDE_CODE_REMOTE:-}" = 'true' ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

pedido="$(tr -dc '0-9' < .node-version)"
atual="$(node -v 2>/dev/null | sed 's/^v//; s/\..*//')"

if [ -z "$atual" ] || [ "$atual" -lt "$pedido" ]; then
  export NVM_DIR="${NVM_DIR:-/opt/nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm install "$pedido"
    nvm use "$pedido"
  else
    echo "Node $pedido é necessário (.node-version) e não há nvm em $NVM_DIR: instale-o à mão."
    exit 0
  fi
fi

# O nvm vale só neste processo; o PATH do arquivo de ambiente é o que alcança a sessão toda.
# O gancho roda de novo a cada retomada da sessão, e sem a checagem o arquivo cresceria a
# cada vez com as mesmas três linhas.
if [ -n "${CLAUDE_ENV_FILE:-}" ] && ! grep -q 'ASTRO_TELEMETRY_DISABLED' "$CLAUDE_ENV_FILE" 2> /dev/null; then
  {
    echo "export PATH=\"$(dirname "$(command -v node)"):\$PATH\""
    # Os mesmos silenciadores do CI (.github/workflows/ci.yml), para a sessão medir o mesmo
    # que a esteira mede.
    echo 'export ASTRO_TELEMETRY_DISABLED=1'
    echo "export WRANGLER_SEND_METRICS='false'"
  } >> "$CLAUDE_ENV_FILE"
fi

command -v pnpm > /dev/null 2>&1 || corepack enable pnpm

pnpm install --frozen-lockfile

# O `channel: 'chromium'` do playwright.config.ts pede o Chromium completo da versão exata
# do @playwright/test. A variável que o container usa para pular download de navegador vale
# para este comando também, e aqui o download é justamente o que se quer.
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='' pnpm exec playwright install chromium

echo "Ambiente pronto: Node $(node -v), pnpm $(pnpm -v) e o Chromium do Playwright."
# Fora daqui de propósito: o `pnpm build` gera quase dois mil recortes de imagem e leva uns
# vinte minutos na primeira vez (seis segundos com node_modules/.astro quente). Esperar por
# isso a cada sessão custa mais do que pagar uma vez, quando o build for necessário.
