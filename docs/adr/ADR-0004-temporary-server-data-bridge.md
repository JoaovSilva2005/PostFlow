# ADR-0004: Ponte temporária de dados server-side

## Status

Accepted — 2026-09-17

## Context

As tabelas financeiras estão protegidas por políticas Supabase que impedem o
uso direto da chave pública do navegador. Isso fazia os módulos Financeiro e
Fiscal exibirem erro em vez de dados.

## Decision

O backend terá dois clientes Supabase separados. `createSupabaseAuthClient`
usa somente a chave publicável para Supabase Auth. `createSupabaseAdminDataClient`
usa `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SECRET_KEY`) exclusivamente no
repositório financeiro, compartilhado pelo módulo fiscal. O frontend continua
chamando a API Express autenticada e nunca recebe o segredo administrativo.

## Consequences

O aplicativo deixa de depender de alterações manuais de permissões para a
demonstração. Esta é uma ponte temporária: a service role ignora RLS, portanto
o repositório ainda usa a marca acadêmica fixa e não está pronto para múltiplos
clientes. A migração para `brand_members` e escopo por usuário continua sendo
obrigatória antes de operar dados reais de clientes.

## Validation

Fitness tests verificam que nenhum segredo use prefixo `VITE_`, que os clientes
tenham nomes e responsabilidades distintos e que o provedor de autenticação
receba apenas o cliente público.
