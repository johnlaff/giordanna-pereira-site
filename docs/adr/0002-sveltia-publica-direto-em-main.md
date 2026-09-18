# Sveltia CMS publica direto em `main`, apesar da branch protegida

Giordanna edita conteúdo pelo Sveltia CMS em `/admin`: um CMS git-based sem servidor próprio, com upload e redimensionamento de imagens pelo celular, UI em pt-BR e compatibilidade com o formato de configuração do Decap, escolhido em vez do Decap (sem otimização de imagem no upload, manutenção lenta) e do Keystatic (exige framework React e projeto na nuvem para login sem token). Ela não faz trabalho de engenharia; a regra branch → PR → squash vale para código, não para publicação de conteúdo. O ruleset de `main` exige PR e checks obrigatórios com bypass para o papel write, que neste repositório cobre apenas os colaboradores que publicam pelo CMS; "bloquear force push" e "restringir exclusão" não têm bypass para ninguém. João continua seguindo branch → PR → squash sempre, independente do bypass existir.

## Consequences

- O CI roda também em push direto em `main`, para que uma publicação que quebre o build apareça vermelha e notifique João. Workers Builds não implanta um build que falhou: o site permanece na última versão boa.
- O `config.yml` do Sveltia marca campos obrigatórios com `required: true` e valida padrões (área, ano) no próprio formulário, para que o erro apareça para Giordanna antes do commit. O schema Zod das content collections é a segunda barreira.
- O fluxo editorial do Sveltia (publicação via PR) foi descartado porque a feature está com regressão aberta (issue 990, verificado 2026-09) e adiciona à Giordanna um estado "rascunho → revisão → publicado" sem benefício para um site com um único editor. Revisitar quando o Sveltia 1.0 estabilizar.
