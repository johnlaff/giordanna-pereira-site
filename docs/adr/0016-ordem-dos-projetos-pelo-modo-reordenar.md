# A Ordem dos Projetos muda arrastando a lista do CMS

A Ordem de cada Projeto era um campo numérico no formulário do CMS, de 10 em 10, para caber um Projeto novo entre dois sem renumerar os outros. Na prática, Giordanna acabou com Ordens como 1, 5, 6, 7 e 12 para encaixar Projetos, achou cansativo escolher o número (2026-09-27), e numa dessas edições dois Projetos ficaram com a Ordem 10: o build recusou a duplicata e o site ficou parado na versão anterior até alguém consertar o arquivo.

Agora a coleção de Projetos usa o modo Reordenar do próprio Sveltia (`reorder: { key: 'ordem' }`, em `src/admin/configuracao.ts`): na lista de Projetos, ela toca em Reordenar, arrasta os Projetos ou usa as setas (que são o que funciona no celular) e conclui. O Sveltia grava a Ordem de todos de 1 em diante, na sequência da lista, num commit só, e dá a um Projeto novo a maior Ordem mais um, no fim da grade. Ao excluir um Projeto, renumera os que ficam. O campo Ordem sai do formulário: se ficasse, o Projeto novo seria barrado por um campo obrigatório vazio antes de o Sveltia numerá-lo.

O arquivo continua com a chave `ordem`, e o schema continua exigindo um inteiro único: a grade, a navegação anterior/próximo e o sitemap não mudam, e um arquivo editado fora do CMS com Ordem repetida ainda para o build.

## Considered Options

- **Manter o campo com uma dica melhor**: não tira o trabalho de escolher o número nem o risco de repetir.
- **Um arquivo só com a lista dos Projetos** (uma lista ordenável em `src/content/home/`, como a Familiaridade): a ordem viraria arrastar itens de uma lista, mas a lista teria de citar cada Projeto pelo nome do arquivo, e um Projeto criado sem ser posto nela sumiria da grade ou exigiria outra regra. O modo Reordenar faz o mesmo sem um segundo lugar para manter em dia.

## Consequences

- Reordenar reescreve todos os arquivos cuja Ordem mudou, num commit só: o primeiro uso troca as Ordens antigas (1, 5, 6, 7…) por 1, 2, 3… em todos os Projetos.
- O Sveltia grava `ordem` no topo de cada arquivo que salva, antes dos campos do formulário. O schema não depende da ordem das chaves.
- `tests/e2e/admin.spec.ts` reordena pelo "Trabalhar com Repositório Local" e confere que o que chega ao repositório passa por `ordenarProjetos`, o mesmo que o build chama.
