/**
 * Os bindings do Worker que o código do site lê por `cloudflare:workers`, declarados à mão:
 * é um só, e o pacote de tipos inteiro da Cloudflare não se paga por ele. Tem de bater com o
 * `wrangler.jsonc`.
 */
declare module 'cloudflare:workers' {
  /** Um dataset do Analytics Engine; `writeDataPoint` não espera nem lança. */
  type DatasetDoAnalyticsEngine = {
    writeDataPoint(ponto: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
  };
  export const env: {
    /** Ausente só fora do Worker; no `wrangler dev` a escrita é simulada. */
    CONTATO_ENVIOS?: DatasetDoAnalyticsEngine;
  };
}
