# ADR-0001: BFF e isolamento por membership

## Status

Accepted — 2026-09-17

## Context

O protótipo mistura Supabase direto no navegador com uma API autenticada e
identificadores de demonstração. Isso impede isolamento real entre clientes.

## Decision

A API Express será a fronteira canônica. Cada requisição terá contexto de
usuário e marca, e o Supabase aplicará RLS por `auth.uid()` e `brand_members`.
O frontend não será autoridade sobre `brand_id` nem papel de acesso.

## Consequences

Há uma única política de acesso auditável e testável. Em contrapartida, marca e
posts precisam ser migrados do repositório direto para endpoints da API.

## Validation

Teste automatizado com dois usuários deve provar que nenhum UUID de outro
tenant pode ser lido, alterado ou excluído.
