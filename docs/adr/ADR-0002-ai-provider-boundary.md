# ADR-0002: Porta de provedor para IA

## Status

Accepted — 2026-09-17

## Context

O chat precisa usar IA real sem acoplar páginas, domínio ou dados persistidos ao
contrato de um fornecedor.

## Decision

`ContentService` depende de `ContentProvider`. O adapter OpenAI chama a
Responses API no servidor e converte saída estruturada para o contrato interno.
Depois, o mesmo provider chama a Image Generation API para produzir uma única
imagem quadrada de prévia. O padrão é GPT-6 Luna para texto e
`gpt-image-2.5-flare` para imagem, com qualidade `medium` e tamanho `1024x1024`.
No estúdio individual, a escolha `quality` é validada pelo BFF e mapeada para
`gpt-image-2.5-sunburst`; o navegador não escolhe nem envia IDs de modelos.
Modelos, qualidade e tamanho são configuráveis no ambiente do backend.

## Consequences

A chave não chega ao navegador e o fornecedor pode ser trocado. A integração
exige monitoramento de custo, latência e falhas, além de limites por tenant.
Imagem é retornada somente para a prévia da sessão e não é persistida em
`post_drafts`; os campos textuais seguem o fluxo normal da agenda.

## Validation

Testes usam provider falso e validam autenticação, autorização, entrada e saída.
