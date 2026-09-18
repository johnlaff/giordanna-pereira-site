# Imagens do site vivem no repositório como WebP ≤ 2560 px; os originais ficam no Drive

Os originais dos renders e pranchas são arquivos grandes (PSD, PNG e PDF de dezenas de MB) que pertencem à Giordanna e ficam no Google Drive dela. O repositório guarda, em `src/assets/`, um redimensionamento determinístico de cada imagem para no máximo 2560 px em WebP q90, sem retoque, e `docs/content/origem-imagens.json` mapeia cada chave ao original. O Astro gera AVIF e WebP com `srcset`/`sizes` no build a partir desses arquivos; uploads pelo CMS passam pela mesma transformação (WebP q90, 2560 px) antes do commit.

## Considered Options

- **Originais no repo com geração no build**: repositório de vários GB, clone e CI lentos, e os originais expostos publicamente.
- **CDN de imagens (Cloudinary, Cloudflare Images)**: serviço pago e uma origem externa a mais na CSP; o ganho de otimização em runtime não compensa para um catálogo de ~140 imagens que muda pouco.
- **Repo público com os originais**: descartado também porque a Giordanna é a titular do material e o repositório é público.

## Consequences

- 2560 px é o teto porque o lightbox abre a maior variante em telas QHD/retina; abaixo disso os renders ficam visivelmente borrados.
- Nenhum arquivo em `src/assets/` passa de 2 MB; o build falha se um projeto referenciar uma chave de imagem inexistente.
