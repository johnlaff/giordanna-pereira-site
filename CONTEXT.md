# Site de Giordanna Pereira

Portfólio público de uma arquiteta e urbanista: apresenta seus projetos, quem ela é, o que já disseram sobre seu trabalho e como contatá-la. O conteúdo é editado por ela mesma em um CMS; o código é mantido por João.

## Language

### Portfólio

**Projeto**:
Uma obra do portfólio, com ficha técnica, descrição, capa e galeria. Tem uma página própria em `/projetos/<slug>`.
_Avoid_: obra, trabalho, case

**Tipo**:
A categoria curta de um Projeto exibida junto ao título (ex.: "Comercial", "Residencial", "Habitação de interesse social").
_Avoid_: kind, categoria, segmento

**Capa**:
A imagem que representa o Projeto no card da grade e na imagem de compartilhamento. Pode ser uma imagem que não está na galeria; quando não é definida, é a primeira imagem da galeria. A página do Projeto não usa a Capa: ela abre com a primeira imagem da Galeria.
_Avoid_: cover, thumbnail, destaque

**Galeria**:
A lista ordenada de imagens de um Projeto. Renders vêm primeiro; pranchas, por último.
_Avoid_: gallery, fotos, álbum

**Render**:
Imagem de perspectiva realista de um Projeto.
_Avoid_: perspectiva, visualização, imagem 3D

**Prancha**:
Desenho técnico ou lâmina de apresentação de um Projeto.
_Avoid_: planta, lâmina, desenho

**Ficha técnica**:
O bloco de dados objetivos de um Projeto: local, ano, área e equipe. Na página, aparece sob o título "Detalhes do projeto".
_Avoid_: ficha, detalhes, dados técnicos

**Ferramenta**:
Software usado em um Projeto (ex.: Archicad, Enscape), listado na página do Projeto.
_Avoid_: tool, programa, skill

**Familiaridade**:
O bloco "Ferramentas" da home: o conjunto de softwares que Giordanna domina, em três níveis, do maior para o menor. É independente das Ferramentas de cada Projeto (inclui, por exemplo, Pacote Office e AutoCAD, que nenhum Projeto lista).
_Avoid_: skills, competências, nível

**Ordem**:
A posição de um Projeto na grade e na navegação anterior/próximo. Número inteiro, único entre os Projetos, numerado de 10 em 10 para inserir um novo sem renumerar os demais.
_Avoid_: posição, índice, peso

**Grade de projetos**:
A listagem de todos os Projetos em `/projetos`, com o primeiro em destaque.
_Avoid_: grid, lista de projetos, portfólio

### Depoimentos e contato

**Depoimento**:
Uma citação curta de alguém que trabalhou com Giordanna, com nome e papel, exibida no carrossel da home. Um Depoimento sem texto é exibido como "em breve".
_Avoid_: quote, testemunho, review

**Em breve**:
O estado de um Projeto sem imagens ou de um Depoimento sem texto: cadastrado, visível no site, aguardando conteúdo. É desenhado pelo site, nunca por uma imagem de conteúdo.
_Avoid_: placeholder, mock, rascunho

**Contato**:
Um canal público para falar com Giordanna (WhatsApp, LinkedIn, Behance, e-mail), exibido na página de contato e no rodapé. Contatos, hero, Sobre e CTA são mantidos por João, não pelo CMS.
_Avoid_: social, rede, link

### Ambientes

**Preview**:
O arquivo único aprovado que serve de referência visual e funcional para o site.
_Avoid_: protótipo, mock, site antigo

**Produção**:
O site Astro publicado em `giordannapereira.arq.br`.
_Avoid_: site novo, versão final

## Campos do Projeto

Identificadores sem acento nem cedilha; acentos só no rótulo que Giordanna vê no CMS. Nenhum campo de conteúdo aceita HTML: o que precisa virar link tem um campo de URL próprio.

| Termo          | Identificador | Rótulo no CMS |
| -------------- | ------------- | ------------- |
| Título         | `titulo`      | Título        |
| Tipo           | `tipo`        | Tipo          |
| Capa           | `capa`        | Capa          |
| Descrição      | `descricao`   | Descrição     |
| Ferramentas    | `ferramentas` | Ferramentas   |
| Local          | `local`       | Local         |
| Ano            | `ano`         | Ano           |
| Área           | `area`        | Área          |
| Equipe         | `equipe`      | Equipe        |
| Link da equipe | `equipeUrl`   | Link da equipe |
| Galeria        | `galeria`     | Galeria       |
| Ordem          | `ordem`       | Ordem         |

## Campos do Depoimento

| Termo   | Identificador | Rótulo no CMS |
| ------- | ------------- | ------------- |
| Nome    | `nome`        | Nome          |
| Papel   | `papel`       | Papel         |
| Texto   | `texto`       | Texto         |
