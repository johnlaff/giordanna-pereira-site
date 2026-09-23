/**
 * Os headers de segurança do site (ADR 0005). O `public/_headers` só vale para o que é
 * estático; esta é a cópia para as respostas que o Worker escreve — o endpoint do contato e as
 * duas páginas do login do CMS. `seguranca.spec.ts` cobra as duas com a mesma lista, então uma
 * não muda sem a outra.
 */
export const HEADERS_DE_SEGURANCA = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
} as const;
