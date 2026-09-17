# ADR-0002: Porta de provedor para IA

## Status

Accepted — 2026-09-17

## Context

O chat precisa usar IA real sem acoplar páginas, domínio ou dados persistidos ao
contrato de um fornecedor.

## Decision

`ContentService` depende de `ContentProvider`. O adapter OpenAI chama a
Responses API no servidor e converte saída estruturada para o contrato interno.
O modelo padrão é GPT-5.6 Luna; imagem será uma ação opcional separada.

## Consequences

A chave não chega ao navegador e o fornecedor pode ser trocado. A integração
exige monitoramento de custo, latência e falhas, além de limites por tenant.

## Validation

Testes usam provider falso e validam autenticação, autorização, entrada e saída.
