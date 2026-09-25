/**
 * O zoom pela roda do mouse, suave. O PhotoSwipe aplica cada evento da roda de uma vez, e a
 * cada um redimensiona a imagem de verdade — numa prancha de 5120 px, é o navegador redesenhando
 * milhões de pixels por evento, e o zoom anda aos trancos. A pinça do celular não sofre disso:
 * durante o gesto ela só escala a imagem por `transform` e redimensiona uma vez, no fim. Aqui a
 * roda passa a fazer o mesmo: ela move um alvo, a escala persegue o alvo quadro a quadro, e a
 * imagem só ganha o tamanho novo quando a roda para.
 *
 * A aritmética fica fora do componente para ser verificável sem navegador.
 */

/** Quanto do caminho até o alvo a escala anda a cada quadro, na escala logarítmica. */
export const PASSO_POR_QUADRO = 0.25;

/** Abaixo desta distância (logarítmica) do alvo, a escala chega de vez. */
const CHEGOU = 0.002;

/**
 * Quanto tempo sem a roda, depois de a escala chegar, até a imagem ganhar o tamanho novo. Chegar
 * não basta: girando devagar, a escala alcança o alvo entre um dente e outro, e cada chegada
 * redimensionava a imagem. O Firefox decodifica a imagem no tamanho em que ela aparece, e uma
 * prancha de 5120 px redecodificada trava uns quatro quadros (medido no vídeo do João).
 */
export const REPOUSO_DA_RODA = 250;

/**
 * O fator que um evento da roda aplica ao zoom, o mesmo do PhotoSwipe: o Firefox conta a roda
 * em linhas (`deltaMode` 1), o Chrome em pixels, e os dois dão uns 15% por dente da roda.
 */
export const fatorDaRoda = ({ deltaY, deltaMode }: Pick<WheelEvent, 'deltaY' | 'deltaMode'>) => {
  const escala = deltaMode === 1 ? 0.05 : deltaMode === 0 ? 0.002 : 1;
  return 2 ** (-deltaY * escala);
};

/** O próximo quadro da escala a caminho do alvo, e se ela chegou. */
export const proximoQuadro = (atual: number, alvo: number) => {
  const distancia = Math.log(alvo / atual);
  if (Math.abs(distancia) < CHEGOU) return { zoom: alvo, chegou: true };
  return { zoom: atual * Math.exp(distancia * PASSO_POR_QUADRO), chegou: false };
};

/** O mínimo que o zoom suave precisa de um slide do PhotoSwipe. */
interface Slide {
  currZoomLevel: number;
  zoomLevels: { min: number; max: number };
  pan: { x: number; y: number };
  isZoomable(): boolean;
  setZoomLevel(zoom: number): void;
  calculateZoomToPanOffset(eixo: 'x' | 'y', ponto: { x: number; y: number }, antes: number): number;
  applyCurrentZoomPan(): void;
  zoomTo(zoom: number, ponto: { x: number; y: number }, duracao?: number): void;
}

/**
 * Liga o zoom suave a um lightbox. `slideAtual` devolve o slide em cena; `semMovimento` diz se
 * quem visita prefere menos movimento, e aí o zoom vai direto ao alvo, sem quadros no caminho.
 */
export const zoomSuave = (slideAtual: () => Slide | undefined, semMovimento: () => boolean) => {
  let alvo = 0;
  let ponto = { x: 0, y: 0 };
  let animando: Slide | undefined;
  let repouso: ReturnType<typeof setTimeout> | undefined;

  const aplicar = (slide: Slide, zoom: number) => {
    const antes = slide.currZoomLevel;
    slide.setZoomLevel(zoom);
    slide.pan.x = slide.calculateZoomToPanOffset('x', ponto, antes);
    slide.pan.y = slide.calculateZoomToPanOffset('y', ponto, antes);
    slide.applyCurrentZoomPan();
  };

  /** A roda parou: só agora a imagem ganha o tamanho novo, e o navegador escolhe a variante. */
  const assentar = (slide: Slide) => {
    repouso = undefined;
    if (slide !== slideAtual() || animando !== undefined) return;
    slide.zoomTo(slide.currZoomLevel, ponto, 0);
  };

  const quadro = () => {
    const slide = slideAtual();
    if (slide === undefined || slide !== animando) {
      animando = undefined;
      return;
    }
    const { zoom, chegou } = proximoQuadro(slide.currZoomLevel, alvo);
    aplicar(slide, zoom);
    if (chegou) {
      animando = undefined;
      repouso = setTimeout(() => assentar(slide), REPOUSO_DA_RODA);
      return;
    }
    requestAnimationFrame(quadro);
  };

  /** Recebe um evento da roda; devolve `false` quando ele não é zoom e fica com o PhotoSwipe. */
  return (evento: WheelEvent) => {
    const slide = slideAtual();
    if (slide === undefined || !slide.isZoomable()) return false;
    clearTimeout(repouso);
    repouso = undefined;
    if (animando !== slide) alvo = slide.currZoomLevel;
    const { min, max } = slide.zoomLevels;
    alvo = Math.min(max, Math.max(min, alvo * fatorDaRoda(evento)));
    ponto = { x: evento.clientX, y: evento.clientY };
    if (semMovimento()) {
      animando = undefined;
      slide.zoomTo(alvo, ponto, 0);
    } else if (animando !== slide) {
      animando = slide;
      requestAnimationFrame(quadro);
    }
    return true;
  };
};

/**
 * Os níveis de zoom de uma imagem, do ajuste à tela até o teto. Os botões + e − andam por eles,
 * em múltiplos do ajuste que se leem na porcentagem (150%, 200%, 300%…), como num leitor de PDF;
 * o teto entra sempre, para o + chegar ao máximo mesmo quando ele não cai num múltiplo redondo.
 */
const MULTIPLOS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16];

export const degrausDoZoom = (ajuste: number, teto: number) => {
  const degraus = MULTIPLOS.map((m) => ajuste * m).filter((z) => z < teto * 0.97);
  return [...degraus, Math.max(teto, ajuste)];
};

/** O degrau seguinte na direção pedida, ou `undefined` quando já está na ponta. */
export const proximoDegrau = (atual: number, degraus: readonly number[], direcao: 1 | -1) =>
  direcao === 1 ? degraus.find((z) => z > atual * 1.01) : degraus.findLast((z) => z < atual * 0.99);

/**
 * O que o clique na imagem faz: amplia em dois tempos — primeiro ao zoom de leitura, depois ao
 * teto — e, no teto, volta ao ajuste. Quem não tem roda nem pinça chega ao máximo só clicando.
 */
export const cliqueNoZoom = (
  atual: number,
  { initial, secondary, max }: { initial: number; secondary: number; max: number },
) => {
  if (atual >= max * 0.99) return initial;
  if (atual < secondary * 0.99) return secondary;
  return max;
};

/** A porcentagem mostrada entre os botões: 100% é a imagem inteira na tela. */
export const porcentagem = (atual: number, ajuste: number) =>
  `${Math.round((atual / ajuste) * 100)}%`;
