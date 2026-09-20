import { inflateSync } from 'node:zlib';

/**
 * Leitura de PNG de 8 bits, sem dependência nova. Alguns acertos do Preview só aparecem na
 * cor que o navegador de fato pintou — a moldura do retrato e o escuro atrás do cabeçalho —,
 * e o `screenshot` do Playwright entrega PNG cru. São poucas linhas porque a suíte só precisa
 * de recortes pequenos: cabeçalho de chunks, inflate e a desfiltragem das linhas.
 */

const ASSINATURA = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Canais por tipo de cor do PNG. Só os dois que o `screenshot` do Playwright grava. */
const CANAIS: Record<number, number> = { 2: 3, 6: 4 };

export type Imagem = {
  largura: number;
  altura: number;
  canais: number;
  pixels: Buffer;
};

export type Cor = { r: number; g: number; b: number };

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const da = Math.abs(p - a);
  const db = Math.abs(p - b);
  const dc = Math.abs(p - c);
  if (da <= db && da <= dc) return a;
  return db <= dc ? b : c;
};

const desfiltrar = (filtro: number, a: number, b: number, c: number) => {
  switch (filtro) {
    case 0:
      return 0;
    case 1:
      return a;
    case 2:
      return b;
    case 3:
      return (a + b) >> 1;
    case 4:
      return paeth(a, b, c);
    default:
      throw new Error(`filtro de linha desconhecido: ${filtro}`);
  }
};

export const lerPng = (arquivo: Buffer): Imagem => {
  if (!arquivo.subarray(0, 8).equals(ASSINATURA)) throw new Error('o arquivo não é um PNG');

  let largura = 0;
  let altura = 0;
  let canais = 0;
  const comprimidos: Buffer[] = [];

  for (let pos = 8; pos + 8 <= arquivo.length;) {
    const tamanho = arquivo.readUInt32BE(pos);
    const tipo = arquivo.toString('ascii', pos + 4, pos + 8);
    const corpo = arquivo.subarray(pos + 8, pos + 8 + tamanho);
    if (tipo === 'IHDR') {
      largura = corpo.readUInt32BE(0);
      altura = corpo.readUInt32BE(4);
      const profundidade = corpo[8] ?? 0;
      if (profundidade !== 8) throw new Error(`profundidade ${profundidade} não suportada`);
      canais = CANAIS[corpo[9] ?? -1] ?? 0;
      if (canais === 0) throw new Error(`tipo de cor ${corpo[9]} não suportado`);
    }
    if (tipo === 'IDAT') comprimidos.push(corpo);
    if (tipo === 'IEND') break;
    pos += tamanho + 12;
  }

  const cru = inflateSync(Buffer.concat(comprimidos));
  const passo = largura * canais;
  const pixels = Buffer.alloc(altura * passo);

  for (let linha = 0; linha < altura; linha++) {
    const inicio = linha * (passo + 1);
    const filtro = cru[inicio] ?? 0;
    for (let i = 0; i < passo; i++) {
      const anterior = i >= canais ? (pixels[linha * passo + i - canais] ?? 0) : 0;
      const acima = linha > 0 ? (pixels[(linha - 1) * passo + i] ?? 0) : 0;
      const diagonal =
        linha > 0 && i >= canais ? (pixels[(linha - 1) * passo + i - canais] ?? 0) : 0;
      const bruto = cru[inicio + 1 + i] ?? 0;
      pixels[linha * passo + i] = (bruto + desfiltrar(filtro, anterior, acima, diagonal)) & 0xff;
    }
  }

  return { largura, altura, canais, pixels };
};

export const corDoPixel = ({ largura, canais, pixels }: Imagem, x: number, y: number): Cor => {
  const base = (y * largura + x) * canais;
  return { r: pixels[base] ?? 0, g: pixels[base + 1] ?? 0, b: pixels[base + 2] ?? 0 };
};

/** Luminância perceptual (Rec. 601), de 0 (preto) a 255 (branco). */
export const luminancia = ({ r, g, b }: Cor) => 0.299 * r + 0.587 * g + 0.114 * b;
