# Domínio no nome da Giordanna; GitHub, Cloudflare e Resend no nome do João

O domínio `giordannapereira.arq.br` é registrado no registro.br com a Giordanna como titular (CPF dela, categoria de arquitetos) e o João como contato administrativo, técnico e de cobrança. As contas de GitHub, Cloudflare e Resend ficam no nome do João, que mantém o site; a Giordanna tem conta GitHub própria como colaboradora com 2FA, usada só para publicar pelo CMS.

## Consequences

- A identidade pública (domínio e e-mail `contato@`) é dela e sobrevive a uma eventual saída do João: basta trocar os contatos no registro.br e apontar o DNS para outro lugar.
- Os segredos operacionais (chaves do Resend, Turnstile e do autenticador do CMS) vivem como variáveis do Worker na conta do João, nunca no repositório, que é público.
