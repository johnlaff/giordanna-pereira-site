# Os envios do formulário contam no Analytics Engine

Em 2026-11-17 o João perguntou quais métricas de uso o site tem. Visitas, origem e páginas vêm do Cloudflare Web Analytics; buscas e cliques, do Search Console. O que ninguém sabia dizer era quantas pessoas escreveram pelo formulário. O Web Analytics não conta eventos, e a análise HTTP da zona (plano gratuito) só guarda 31 dias: o `POST /api/contato` aparece ali com o status, mas some depois de um mês, e o status 403 não diz se foi o Turnstile ou outra recusa.

Agora cada pedido ao formulário grava um ponto no dataset `contato_envios` do Analytics Engine da Cloudflare: o desfecho (`enviado`, ou o motivo da recusa, o mesmo `Recusa` que já ia para o log) e o Modo (`real` ou `teste`). `receberContato` decide o desfecho num lugar só e chama um `Contador`; o endpoint passa o binding `CONTATO_ENVIOS` do `wrangler.jsonc`. Nada do que o visitante escreveu entra no ponto, e uma escrita que falhe não muda a resposta.

O Analytics Engine faz parte do Workers Paid que a conta já assina (ver `docs/esteira.md`), com 10 milhões de pontos por mês incluídos; o formulário grava um por envio, e a regra de rate limit da zona barra o excesso antes de o Worker acordar. Não há dependência nova no `package.json`: o tipo do binding é uma declaração de poucas linhas em `src/cloudflare-workers.d.ts`.

## Considered Options

- **Só a análise HTTP da zona**: já existe e não pede código, mas guarda 31 dias e não separa os motivos de recusa.
- **Workers Logs** (`observability` já ligado): guarda o log de cada recusa, mas por poucos dias, e contar exige ler log por log.
- **Um evento no Web Analytics**: não existe; o beacon só mede carregamento de página.
- **Um serviço de analytics de terceiros**: abriria um domínio externo na CSP e um cookie, contra a regra do site.

## Consequences

- Os pontos ficam 3 meses. Uma contagem mais longa pede exportar de tempos em tempos.
- As versões de preview usam os mesmos bindings da produção: um envio no modo de teste conta com `blob2 = 'teste'`, e a consulta filtra por `real`.
- O `wrangler dev` dos testes de ponta a ponta simula o dataset localmente; nada chega à conta.
