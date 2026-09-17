# ADR-0003: Produção sem fallback silencioso

## Status

Accepted — 2026-09-17

## Context

Gravar em memória após falha do Supabase informa sucesso para dados que somem
em reinicializações da Vercel.

## Decision

Produção sempre falha de forma fechada. O fallback demo só existe quando
`POSTFLOW_ALLOW_DEMO_FALLBACK=true` e `NODE_ENV` não é `production`.

## Consequences

Falhas ficam visíveis e não há falsa persistência. Demonstrações locais ainda
podem optar conscientemente por dados efêmeros.

## Validation

Uma configuração de produção jamais instancia o repositório resiliente.
