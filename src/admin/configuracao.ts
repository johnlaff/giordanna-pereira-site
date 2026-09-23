/**
 * A configuração do Sveltia CMS em `/admin`: onde está o conteúdo, como Giordanna entra e o
 * formulário de cada Projeto e Depoimento.
 *
 * O formulário espelha o schema das collections (`src/content.schema.ts`): cada campo que o
 * build exige é obrigatório aqui, e as regras de forma — área, ano, nada de HTML — são as
 * mesmas, importadas de lá. É a primeira barreira, a que mostra o erro a Giordanna antes do
 * commit; o schema é a segunda, a que para o build se algo passar por fora do CMS (ADR 0002).
 * `tests/unit/admin.test.ts` confere que as duas não divergem.
 *
 * A configuração é um objeto, e não um `config.yml`, por dois motivos: o TypeScript a confere
 * contra os tipos do próprio Sveltia, e o endereço do autenticador é a origem em que o CMS
 * está aberto, que só o navegador sabe (ADR 0014).
 */
import type { CmsConfig } from '@sveltia/cms';
import { padroes, type Padrao } from '../content.schema.ts';

/** O repositório onde o CMS lê e grava. */
export const REPOSITORIO = 'johnlaff/giordanna-pereira-site';

/**
 * Onde o login começa, relativo à origem: o endpoint do Worker que leva ao GitHub
 * (`src/pages/api/admin/entrar.ts`). O retorno do GitHub cai em `retorno`, ao lado dele.
 */
export const ENDPOINT_DE_LOGIN = 'api/admin/entrar';

/** O teto de cada foto no repositório (ADR 0004), conferido depois da conversão para WebP. */
const TETO_DA_FOTO = 2 * 1024 * 1024;

/** Um padrão de `content.schema.ts` no formato do CMS: a regra e o que dizer a quem a quebrou. */
const padrao = ({ regex, mensagem }: Padrao): [RegExp, string] => [regex, mensagem];

const semHtml = padrao(padroes.semHtml);

export const configuracaoDoCms = (origem: string): CmsConfig => ({
  // Tudo está aqui; sem isso o Sveltia ainda procuraria um `config.yml` ao lado da página.
  load_config_file: false,
  app_title: 'Site da Giordanna',
  // A marca do site no lugar da do Sveltia, na tela de entrada e no cabeçalho do CMS.
  logo: { src: '/favicon.svg' },
  site_url: origem,
  backend: {
    name: 'github',
    repo: REPOSITORIO,
    branch: 'main',
    // O autenticador mora no próprio Worker do site, na mesma origem do CMS (ADR 0014).
    base_url: origem,
    auth_endpoint: ENDPOINT_DE_LOGIN,
    // O repositório é público: o CMS não precisa ver os repositórios privados de quem entra.
    auth_scope: 'public_repo',
    // Um botão só, "Entrar com GitHub". O login por token é para quem desenvolve, e confundiria.
    auth_methods: ['oauth'],
    commit_messages: {
      create: 'conteudo: cria {{collection}} "{{slug}}"',
      update: 'conteudo: atualiza {{collection}} "{{slug}}"',
      delete: 'conteudo: remove {{collection}} "{{slug}}"',
      uploadMedia: 'conteudo: envia "{{path}}"',
      deleteMedia: 'conteudo: remove "{{path}}"',
    },
  },
  // As imagens do site moram todas em `src/assets/`. O caminho que o Projeto grava é outro,
  // relativo ao arquivo dele, e é definido na coleção.
  media_folder: '/src/assets',
  media_libraries: {
    all: {
      // Toda foto sobe como WebP q90 de no máximo 2560 px, convertida no navegador antes do
      // commit (ADR 0004). O teto é conferido depois da conversão: a foto de 12 MB do celular
      // passa, porque vira WebP bem menor; a que continuar acima de 2 MB é recusada.
      transformations: {
        raster_image: { format: 'webp', quality: 90, width: 2560, height: 2560 },
      },
      max_file_size: TETO_DA_FOTO,
      slugify_filename: true,
    },
  },
  // Nome de arquivo sem acento nem espaço: o do Projeto vira a URL da página dele.
  slug: { encoding: 'ascii', clean_accents: true, sanitize_replacement: '-' },
  // Campo opcional em branco não é gravado: o schema entende ausência como "não tem", e uma
  // string vazia no lugar da Capa ou do link da equipe quebraria o build.
  output: { omit_empty_optional_fields: true },
  collections: [
    {
      name: 'projetos',
      label: 'Projetos',
      label_singular: 'Projeto',
      description: 'As obras do portfólio. A Ordem define a posição de cada uma na grade.',
      folder: 'src/content/projetos',
      format: 'yaml',
      extension: 'yml',
      identifier_field: 'titulo',
      slug: '{{slug}}',
      summary: '{{titulo}}',
      // A lista aparece na Ordem do site, a mesma da grade.
      sortable_fields: {
        fields: ['ordem', 'titulo'],
        default: { field: 'ordem', direction: 'ascending' },
      },
      // As fotos vão para `src/assets/`, e o Projeto guarda o caminho relativo ao arquivo
      // dele, que é o que o `image()` das collections resolve.
      media_folder: '/src/assets',
      public_folder: '../../assets',
      fields: [
        { name: 'titulo', label: 'Título', widget: 'string', pattern: semHtml },
        {
          name: 'tipo',
          label: 'Tipo',
          widget: 'string',
          hint: 'A categoria curta ao lado do título, como Comercial ou Residencial.',
          pattern: semHtml,
        },
        {
          name: 'capa',
          label: 'Capa',
          widget: 'image',
          required: false,
          choose_url: false,
          hint: 'A imagem do card na grade. Sem capa, vale a primeira imagem da galeria.',
        },
        { name: 'descricao', label: 'Descrição', widget: 'text', pattern: semHtml },
        {
          name: 'ferramentas',
          label: 'Ferramentas',
          label_singular: 'Ferramenta',
          widget: 'list',
          min: 1,
          field: { name: 'ferramenta', label: 'Ferramenta', widget: 'string', pattern: semHtml },
        },
        {
          name: 'local',
          label: 'Local',
          widget: 'string',
          hint: 'Cidade · UF, como Uberlândia · MG.',
          pattern: semHtml,
        },
        {
          name: 'ano',
          label: 'Ano',
          widget: 'string',
          hint: 'Como 2025, ou 2025 (acadêmico).',
          pattern: padrao(padroes.ano),
        },
        {
          name: 'area',
          label: 'Área',
          widget: 'string',
          hint: 'Como 46,88 m² ou 1.125,54 m².',
          pattern: padrao(padroes.area),
        },
        { name: 'equipe', label: 'Equipe', widget: 'string', pattern: semHtml },
        {
          name: 'equipeUrl',
          label: 'Link da equipe',
          widget: 'string',
          type: 'url',
          required: false,
          hint: 'Opcional. Com link, o nome da equipe vira um link na página do projeto.',
          pattern: [/^https:\/\/[^\s<>]+$/, 'Use o endereço completo, começando com https://'],
        },
        {
          name: 'ordem',
          label: 'Ordem',
          widget: 'number',
          value_type: 'int',
          hint: 'A posição na grade, de 10 em 10: 10 é o primeiro. Não repita a de outro projeto.',
        },
        {
          name: 'galeria',
          label: 'Galeria',
          widget: 'image',
          multiple: true,
          required: false,
          choose_url: false,
          hint: 'Renders primeiro, pranchas por último. Sem imagens, o projeto aparece como Em breve.',
        },
      ],
    },
    {
      name: 'depoimentos',
      label: 'Depoimentos',
      label_singular: 'Depoimento',
      description: 'As citações do carrossel da home.',
      folder: 'src/content/depoimentos',
      format: 'yaml',
      extension: 'yml',
      identifier_field: 'nome',
      // A vez de cada Depoimento no carrossel é a do nome do arquivo (`01-valquiria`...). Um
      // novo nasce com a data na frente, e por isso entra depois dos que já existem.
      slug: '{{year}}{{month}}{{day}}-{{slug}}',
      summary: '{{nome}}',
      sortable_fields: {
        fields: ['slug', 'nome'],
        default: { field: 'slug', direction: 'ascending' },
      },
      fields: [
        { name: 'nome', label: 'Nome', widget: 'string', pattern: semHtml },
        {
          name: 'papel',
          label: 'Papel',
          widget: 'string',
          hint: 'Cargo e empresa, ou a relação com o seu trabalho.',
          pattern: semHtml,
        },
        {
          name: 'texto',
          label: 'Texto',
          widget: 'text',
          required: false,
          hint: 'Sem texto, o depoimento aparece como Em breve.',
          pattern: semHtml,
        },
      ],
    },
  ],
});
