/**
 * Um validador de JSON-LD contra o vocabulário do schema.org, restrito aos tipos que o site
 * publica. As propriedades de cada tipo e o que elas aceitam foram copiados das páginas do
 * próprio schema.org (https://schema.org/Person, /CreativeWork, /PostalAddress, /Place e
 * /Thing, de que todos herdam) — é a fonte independente contra a qual os dados do site são
 * conferidos, e não uma segunda leitura do código que os monta.
 *
 * Não é o vocabulário inteiro: uma propriedade válida no schema.org que o site ainda não usa
 * não está aqui, e usá-la pede acrescentá-la, com a fonte.
 */

type Valor = 'texto' | 'url' | 'data' | 'PostalAddress' | 'Place' | 'Person';

const coisa: Record<string, Valor> = {
  name: 'texto',
  description: 'texto',
  url: 'url',
  image: 'url',
  sameAs: 'url',
  identifier: 'texto',
  alternateName: 'texto',
};

const vocabulario: Record<string, Record<string, Valor>> = {
  Person: {
    ...coisa,
    jobTitle: 'texto',
    email: 'texto',
    telephone: 'texto',
    address: 'PostalAddress',
    homeLocation: 'Place',
    workLocation: 'Place',
  },
  CreativeWork: {
    ...coisa,
    genre: 'texto',
    creditText: 'texto',
    dateCreated: 'data',
    locationCreated: 'Place',
    inLanguage: 'texto',
    contributor: 'Person',
    creator: 'Person',
    author: 'Person',
  },
  PostalAddress: {
    ...coisa,
    addressLocality: 'texto',
    addressRegion: 'texto',
    addressCountry: 'texto',
  },
  Place: { ...coisa, address: 'PostalAddress' },
};

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function conferirValor(tipo: Valor, valor: unknown, onde: string, erros: string[]) {
  if (tipo === 'texto') {
    if (typeof valor !== 'string' || valor.trim() === '')
      erros.push(`${onde}: texto vazio ou não texto`);
  } else if (tipo === 'url') {
    if (typeof valor !== 'string' || !/^https:\/\/[^\s]+$/.test(valor))
      erros.push(`${onde}: não é uma URL https absoluta (${String(valor)})`);
  } else if (tipo === 'data') {
    if (typeof valor !== 'string' || !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(valor))
      erros.push(`${onde}: não é uma data ISO 8601 (${String(valor)})`);
  } else {
    conferirNo(valor, onde, erros, tipo);
  }
}

function conferirNo(no: unknown, onde: string, erros: string[], esperado?: string) {
  if (!ehObjeto(no)) return void erros.push(`${onde}: não é um objeto`);
  const tipo = no['@type'];
  if (typeof tipo !== 'string' || !(tipo in vocabulario))
    return void erros.push(`${onde}: @type desconhecido (${String(tipo)})`);
  if (esperado !== undefined && tipo !== esperado)
    erros.push(`${onde}: esperava ${esperado}, veio ${tipo}`);
  const propriedades = vocabulario[tipo] ?? {};
  for (const [chave, valor] of Object.entries(no)) {
    if (chave === '@type' || chave === '@context' || chave === '@id') continue;
    const aceita = propriedades[chave];
    if (aceita === undefined) {
      erros.push(`${onde}.${chave}: não é propriedade de ${tipo} no schema.org`);
      continue;
    }
    const valores = Array.isArray(valor) ? valor : [valor];
    if (valores.length === 0) erros.push(`${onde}.${chave}: lista vazia`);
    valores.forEach((v, i) =>
      conferirValor(
        aceita,
        v,
        Array.isArray(valor) ? `${onde}.${chave}[${i}]` : `${onde}.${chave}`,
        erros,
      ),
    );
  }
}

/**
 * Os erros de um documento JSON-LD: vazio quando ele é válido. O documento precisa declarar o
 * contexto do schema.org e ter um dos tipos acima na raiz.
 */
export function errosDeJsonLd(documento: unknown): string[] {
  const erros: string[] = [];
  if (!ehObjeto(documento)) return ['o documento não é um objeto'];
  if (documento['@context'] !== 'https://schema.org')
    erros.push(`@context não é https://schema.org (${String(documento['@context'])})`);
  conferirNo(documento, '$', erros);
  return erros;
}
