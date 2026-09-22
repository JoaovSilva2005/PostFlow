# ADR-0007: Contratos compartilhados fora das camadas de execução

## Status

Accepted — 2026-09-22

## Context

O frontend e o backend são compilados no mesmo repositório, mas representam
camadas de execução diferentes. O backend importava `src/domain` para reutilizar
o catálogo de segmentos e os cálculos fiscais. Isso fazia a API depender da
árvore de apresentação e tornava uma futura separação dos builds arriscada.

## Decision

Contratos e regras puras usados pelos dois lados ficam em `shared/`. Essa pasta
não pode importar framework, banco, rede, ambiente ou APIs de navegador.

`src/domain` mantém fachadas de compatibilidade para o frontend durante a
migração. O backend importa diretamente de `shared/` e nunca de `src/`.

## Consequences

- frontend e backend compartilham uma fonte única para contratos financeiros,
  regras fiscais e catálogo de segmentos;
- os builds continuam simples, sem criar um pacote publicado ou um workspace
  de monorepo antes de haver necessidade real;
- a pasta `shared/` exige disciplina para não virar um depósito genérico;
- regras específicas de UI, HTTP, Supabase e ambiente continuam em suas camadas.

## Alternatives considered

1. Manter o backend importando `src/domain`: simples agora, mas mantém a
   dependência invertida e dificulta separar os runtimes.
2. Duplicar as regras em frontend e backend: isolaria os builds, mas permitiria
   divergência silenciosa em cálculos e contratos.
3. Criar um pacote npm interno imediatamente: seria mais isolado, porém adiciona
   tooling de workspace sem benefício proporcional ao tamanho atual do projeto.

## Validation

- `npm run typecheck` deve compilar `src`, `backend`, `api` e `shared`;
- o teste arquitetural deve falhar se qualquer arquivo de `backend/` importar
  `src/`;
- testes fiscais e financeiros devem continuar passando com os contratos de
  `shared/`;
- arquivos de `shared/` devem permanecer livres de imports de infraestrutura.
