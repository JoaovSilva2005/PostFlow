# ADR-0001: BFF e isolamento por membership

## Status

Accepted — 2026-09-17

## Context

O protótipo mistura Supabase direto no navegador com uma API autenticada e
identificadores de demonstração. Isso impede isolamento real entre clientes.

## Decision

A API Express será a fronteira canônica para dados de negócio. Cada requisição
valida a sessão, resolve o membership e o papel do workspace no backend; somente
depois o BFF usa seu cliente server-side para acessar o PostgreSQL. O frontend
não será autoridade sobre `brand_id` nem papel de acesso. O cliente de dados do
BFF usa `service_role`, que ignora RLS; por isso, as verificações de membership
e papel no backend são obrigatórias, e RLS continua como defesa para acessos
diretos autenticados onde concedidos.

## Consequences

Há uma única fronteira de autorização auditável e testável e as rotas do
navegador não acessam as tabelas diretamente. O custo é manter autorização e
limites de entrada no BFF antes de qualquer acesso com a chave privilegiada.

## Validation

Testes de rota verificam sessão, contexto e papel; uma validação de integração
com banco local descartável ainda é necessária para provar isolamento entre
dois usuários e memberships reais.
