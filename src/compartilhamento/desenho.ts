/**
 * O desenho do Cartão de compartilhamento, com o sharp que o build já usa para as imagens.
 *
 * Reproduz o template do Preview (`docs/reference/tests-preview/og.js`), que era uma página
 * HTML fotografada por um navegador: a imagem cobrindo o Cartão, o véu em diagonal que
 * escurece o canto do texto, a marca, o olho, o título e o subtítulo, empilhados a partir da
 * base. Aqui não há navegador — o build roda na Cloudflare —, então cada peça é desenhada à
 * parte e posta onde o CSS do Preview a poria: o fundo e as formas em SVG, o texto pelo Pango
 * do sharp, com as fontes do site em `fontes/`.
 *
 * As medidas abaixo são as do CSS do Preview, em px, e as posições verticais seguem a caixa de
 * linha do CSS: a linha de base de um texto fica a meia entrelinha mais a ascendente da fonte
 * do topo da caixa. Por isso as métricas de cada fonte (ascendente e descendente da tabela
 * `hhea`, em fração do corpo) moram junto das fontes.
 */
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { Cartao } from './cartoes.ts';

export const LARGURA = 1200;
export const ALTURA = 630;

/** A margem do texto à esquerda e à base do Cartão. */
const MARGEM = 72;
const BASE = 64;

const cor = {
  papel: '#F1F2F0',
  areia: '#CDBCA4',
  enfase: '#AFC0CC',
  tinta: '#232D38',
  tintaSuave: '#5A646E',
  fundoDeImagem: '#E4E8EA',
} as const;

type Fonte = {
  /** O nome que o Pango procura, sem o corpo. */
  nome: string;
  arquivo: string;
  ascendente: number;
  descendente: number;
  /**
   * Largura, em px, de "Hamburgefonstiv" a 100 px. Se a fonte não carregar, o Pango cai numa
   * fonte do sistema sem avisar; conferir esta medida faz o build parar em vez de publicar
   * um Cartão na fonte errada.
   */
  amostra: number;
};

const fonte = (arquivo: string) => fileURLToPath(new URL(`fontes/${arquivo}`, import.meta.url));

const serifa: Fonte = {
  nome: 'Cormorant Garamond Medium',
  arquivo: fonte('cormorant-garamond-500.ttf'),
  ascendente: 0.924,
  descendente: 0.287,
  amostra: 684,
};
const leve: Fonte = {
  nome: 'Jost Light',
  arquivo: fonte('jost-300.ttf'),
  ascendente: 1.07,
  descendente: 0.375,
  amostra: 688,
};
const regular: Fonte = {
  nome: 'Jost',
  arquivo: fonte('jost-400.ttf'),
  ascendente: 1.07,
  descendente: 0.375,
  amostra: 713,
};

/** A altura de uma linha com `line-height: normal`: ascendente mais descendente. */
const linhaNormal = (f: Fonte, corpo: number) => corpo * (f.ascendente + f.descendente);

/** Onde fica a linha de base dentro de uma caixa de linha de altura `linha`, como no CSS. */
const baseNaLinha = (f: Fonte, corpo: number, linha: number) =>
  (linha - linhaNormal(f, corpo)) / 2 + corpo * f.ascendente;

const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Espaçamento entre letras em unidades do Pango (1/1024 de ponto; a 72 dpi, 1 ponto = 1 px). */
const espacamento = (corpo: number, em: number) => Math.round(corpo * em * 1024);

const renderizar = async (markup: string, f: Fonte, corpo: number, extra = {}) => {
  const { data, info } = await sharp({
    text: {
      text: markup,
      font: `${f.nome} ${corpo}`,
      fontfile: f.arquivo,
      rgba: true,
      dpi: 72,
      ...extra,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { png: data, largura: info.width, altura: info.height };
};

const conferidas = new Map<Fonte, Promise<void>>();

/** Para o build se o Pango não desenhar com a fonte pedida (ver `Fonte.amostra`). */
const conferir = (f: Fonte) => {
  let conferida = conferidas.get(f);
  if (conferida === undefined) {
    conferida = renderizar('Hamburgefonstiv', f, 100).then(({ largura }) => {
      if (Math.abs(largura - f.amostra) > 3)
        throw new Error(
          `o Cartão de compartilhamento não carregou a fonte ${f.nome} (${f.arquivo}): a amostra mediu ${largura} px, e não ${f.amostra}`,
        );
    });
    conferidas.set(f, conferida);
  }
  return conferida;
};

/**
 * O Pango devolve a imagem recortada na tinta do texto, e a tinta muda com as letras: um "g"
 * desce, um "Á" sobe. Para saber onde caem as linhas de base, o texto vai entre duas linhas
 * invisíveis de altura conhecida — um "Á" em cima, um "g" embaixo, recuados por espaços para
 * não mexer na borda esquerda —, e a conta sai delas.
 */
const ESTACA_DE_CIMA = '<span alpha="1">    Á</span>';
const ESTACA_DE_BAIXO = '<span alpha="1">    g</span>';

type Bloco = { png: Buffer; linhas: number; primeiraBase: number };

type Medidas = { passo: number; espaco: number; acima: number; vazio: number };
const medidas = new Map<string, Promise<Medidas>>();

/**
 * O que o Pango faz com uma fonte num corpo e numa altura de linha: o espaço extra que leva o
 * passo natural entre linhas ao do CSS, a altura do "Á" acima da linha de base e a altura do
 * bloco sem nenhuma linha de texto entre as estacas.
 */
const medir = (f: Fonte, corpo: number, linha: number) => {
  const chave = `${f.nome}|${corpo}|${linha}`;
  let m = medidas.get(chave);
  if (m === undefined) {
    m = (async () => {
      await conferir(f);
      const uma = await renderizar('a', f, corpo);
      const duas = await renderizar('a\na', f, corpo);
      const natural = duas.altura - uma.altura;
      const espaco = Math.round(linha - natural);
      const passo = natural + espaco;
      const acima = (await renderizar('    Á', f, corpo)).altura;
      const vazio = (
        await renderizar(`${ESTACA_DE_CIMA}\n${ESTACA_DE_BAIXO}`, f, corpo, { spacing: espaco })
      ).altura;
      return { passo, espaco, acima, vazio };
    })();
    medidas.set(chave, m);
  }
  return m;
};

/** Um bloco de texto que quebra na largura dada, com o número de linhas e a primeira base. */
const bloco = async (
  markup: string,
  f: Fonte,
  corpo: number,
  { linha = linhaNormal(f, corpo), largura }: { linha?: number; largura?: number } = {},
): Promise<Bloco> => {
  const { passo, espaco, acima, vazio } = await medir(f, corpo, linha);
  const { png, altura } = await renderizar(
    `${ESTACA_DE_CIMA}\n${markup}\n${ESTACA_DE_BAIXO}`,
    f,
    corpo,
    {
      spacing: espaco,
      ...(largura === undefined ? {} : { width: largura, wrap: 'word' }),
    },
  );
  return { png, linhas: Math.round((altura - vazio) / passo), primeiraBase: acima + passo };
};

/** A marca do site, o monograma de quatro peças do cabeçalho, a 34 px. */
const marca = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" fill="${cor.papel}">
  <circle cx="8" cy="8" r="8" opacity=".55"/>
  <circle cx="26" cy="8" r="8"/>
  <path d="M0 18H16V34A16 16 0 0 1 0 18Z"/>
  <path d="M18 18H34A16 16 0 0 1 18 34Z" opacity=".35"/>
</svg>`;

/**
 * O véu do Preview: `linear-gradient(12deg, …)` sobre o Cartão inteiro. No CSS o ângulo
 * aponta para cima, 12° para a direita, e a linha do degradê tem o comprimento que faz os
 * cantos opostos tocarem as pontas; aqui ela vira os dois pontos de um degradê do SVG.
 */
const veu = (() => {
  const angulo = (12 * Math.PI) / 180;
  const [dx, dy] = [Math.sin(angulo), -Math.cos(angulo)];
  const meio = (LARGURA * Math.abs(dx) + ALTURA * Math.abs(dy)) / 2;
  const [cx, cy] = [LARGURA / 2, ALTURA / 2];
  const n = (v: number) => v.toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">
  <linearGradient id="v" gradientUnits="userSpaceOnUse" x1="${n(cx - dx * meio)}" y1="${n(cy - dy * meio)}" x2="${n(cx + dx * meio)}" y2="${n(cy + dy * meio)}">
    <stop offset="0" stop-color="${cor.tinta}" stop-opacity=".94"/>
    <stop offset=".45" stop-color="${cor.tinta}" stop-opacity=".55"/>
    <stop offset=".8" stop-color="${cor.tinta}" stop-opacity=".08"/>
  </linearGradient>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`;
})();

/**
 * O estado Em breve de `EmBreve.astro`, na largura do Cartão: o fundo claro, o círculo em
 * traço que sai pelo canto de cima, o cheio em areia que sai pelo de baixo. As medidas do
 * componente são frações da largura (`cqw`), e aqui valem sobre os 1200 px.
 */
const emBreve = (() => {
  const w = (fracao: number) => LARGURA * fracao;
  const traco = { r: w(0.53) / 2, x: LARGURA + w(0.15) - w(0.53) / 2, y: -w(0.22) + w(0.53) / 2 };
  const cheio = { r: w(0.43) / 2, x: -w(0.17) + w(0.43) / 2, y: ALTURA + w(0.2) - w(0.43) / 2 };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">
  <rect width="100%" height="100%" fill="${cor.fundoDeImagem}"/>
  <circle cx="${traco.x}" cy="${traco.y}" r="${traco.r}" fill="none" stroke="rgb(46,58,72)" stroke-opacity=".16"/>
  <circle cx="${cheio.x}" cy="${cheio.y}" r="${cheio.r}" fill="${cor.areia}" fill-opacity=".22"/>
</svg>`;
})();

/** A imagem cobrindo o Cartão, com o corte vertical no `enquadramento` (centro na horizontal). */
const cobrir = async (arquivo: string, enquadramento: number) => {
  const { width = LARGURA, height = ALTURA } = await sharp(arquivo).metadata();
  const escala = Math.max(LARGURA / width, ALTURA / height);
  const w = Math.max(LARGURA, Math.round(width * escala));
  const h = Math.max(ALTURA, Math.round(height * escala));
  return sharp(arquivo)
    .resize(w, h)
    .extract({
      left: Math.round((w - LARGURA) / 2),
      top: Math.round((h - ALTURA) * enquadramento),
      width: LARGURA,
      height: ALTURA,
    });
};

/**
 * O título no maior corpo em que ele cabe em duas linhas, a partir do pedido. Os nomes do
 * Preview cabem todos no corpo cheio; um nome longo cadastrado no CMS encolhe, porque em três
 * ou quatro linhas ele empurraria a marca e o olho para o alto do Cartão, onde o véu é quase
 * transparente e o texto claro se perde na imagem. Abaixo do menor corpo, ele quebra no que
 * precisar.
 */
const tituloQueCabe = async (markup: string, pedido: number) => {
  let corpo = pedido;
  for (;;) {
    const titulo = await bloco(markup, serifa, corpo, { linha: corpo * 1.02, largura: 820 });
    if (titulo.linhas <= 2 || corpo <= 56) return { titulo, corpo };
    corpo = Math.max(56, Math.round(corpo * 0.84));
  }
};

type Peca = { input: Buffer; left: number; top: number };

/**
 * O Cartão em JPEG. `raiz` é a raiz do projeto, de onde parte o caminho do fundo.
 *
 * O texto se empilha de baixo para cima, como no Preview (`bottom: 64px`): subtítulo, título,
 * olho e marca, cada um com a margem do CSS até o de cima.
 */
export async function desenharCartao(cartao: Cartao, raiz: URL): Promise<Buffer> {
  const pecas: Peca[] = [];
  const pos = (input: Buffer, left: number, top: number) =>
    pecas.push({ input, left: Math.round(left), top: Math.round(top) });

  let base = ALTURA - BASE;

  if (cartao.subtitulo !== undefined) {
    const corpoSub = 24;
    const linha = linhaNormal(leve, corpoSub);
    const sub = await bloco(
      `<span foreground="${cor.papel}" alpha="85%">${escapar(cartao.subtitulo)}</span>`,
      leve,
      corpoSub,
      { largura: 680 },
    );
    const topo = base - sub.linhas * linha;
    pos(sub.png, MARGEM, topo + baseNaLinha(leve, corpoSub, linha) - sub.primeiraBase);
    base = topo - 18;
  }

  const enfase =
    cartao.enfase === undefined
      ? ''
      : ` <span foreground="${cor.enfase}">${escapar(cartao.enfase)}</span>`;
  const { titulo, corpo } = await tituloQueCabe(
    `<span foreground="${cor.papel}">${escapar(cartao.titulo)}${enfase}</span>`,
    cartao.corpo ?? 84,
  );
  const linhaDoTitulo = corpo * 1.02;
  const topoDoTitulo = base - titulo.linhas * linhaDoTitulo;
  pos(
    titulo.png,
    MARGEM,
    topoDoTitulo + baseNaLinha(serifa, corpo, linhaDoTitulo) - titulo.primeiraBase,
  );
  base = topoDoTitulo;

  if (cartao.olho !== undefined) {
    const corpoOlho = 14;
    const linha = linhaNormal(regular, corpoOlho);
    const olho = await bloco(
      `<span foreground="${cor.areia}" letter_spacing="${espacamento(corpoOlho, 0.26)}">${escapar(cartao.olho.toLocaleUpperCase('pt-BR'))}</span>`,
      regular,
      corpoOlho,
    );
    const topo = base - 14 - linha;
    pos(olho.png, MARGEM, topo + baseNaLinha(regular, corpoOlho, linha) - olho.primeiraBase);
    base = topo;
  }

  // A marca: o monograma, o nome e a área, centrados numa fileira da altura do nome.
  const corpoNome = 30;
  const corpoArea = 13;
  const fileira = linhaNormal(serifa, corpoNome);
  const topoDaFileira = base - 26 - fileira;
  pos(Buffer.from(marca), MARGEM, topoDaFileira + (fileira - 34) / 2);
  const nome = await bloco(
    `<span foreground="${cor.papel}" letter_spacing="${espacamento(corpoNome, 0.02)}">Giordanna Pereira</span>`,
    serifa,
    corpoNome,
  );
  const xNome = MARGEM + 34 + 16;
  pos(nome.png, xNome, topoDaFileira + baseNaLinha(serifa, corpoNome, fileira) - nome.primeiraBase);
  const larguraDoNome = (await sharp(nome.png).metadata()).width ?? 0;
  const area = await bloco(
    `<span foreground="${cor.areia}" letter_spacing="${espacamento(corpoArea, 0.2)}">ARQUITETURA</span>`,
    regular,
    corpoArea,
  );
  pos(
    area.png,
    xNome + larguraDoNome + 16 + 10,
    topoDaFileira + baseNaLinha(regular, corpoArea, fileira) - area.primeiraBase,
  );

  // O fundo e o véu vão por baixo de todo o texto; no Em breve, a legenda também.
  const fundo =
    cartao.fundo === undefined
      ? { imagem: sharp(Buffer.from(emBreve)), pecas: [await legendaEmBreve()] }
      : {
          imagem: await cobrir(
            fileURLToPath(new URL(cartao.fundo, raiz)),
            cartao.enquadramento ?? 0.4,
          ),
          pecas: [],
        };

  return fundo.imagem
    .composite([...fundo.pecas, { input: Buffer.from(veu), left: 0, top: 0 }, ...pecas])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

/** A legenda do Em breve, centrada no Cartão como o componente a centra no bloco. */
async function legendaEmBreve(): Promise<Peca> {
  const corpo = 14;
  const legenda = await bloco(
    `<span foreground="${cor.tintaSuave}" letter_spacing="${espacamento(corpo, 0.28)}">IMAGENS EM BREVE</span>`,
    leve,
    corpo,
  );
  const { width = 0 } = await sharp(legenda.png).metadata();
  const linha = corpo * 1.65;
  const topo = (ALTURA - linha) / 2;
  // O espaçamento sobra depois da última letra, e o `text-indent` do componente põe o mesmo
  // tanto antes da primeira: a tinta fica no centro exato, que é onde ela vai aqui.
  return {
    input: legenda.png,
    left: Math.round((LARGURA - width) / 2),
    top: Math.round(topo + baseNaLinha(leve, corpo, linha) - legenda.primeiraBase),
  };
}
