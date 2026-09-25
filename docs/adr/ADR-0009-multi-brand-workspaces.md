# ADR-0009: Marcas múltiplas como workspaces selecionáveis

## Status

Accepted — 2026-09-24

## Contexto

O produto precisa permitir que a mesma conta mantenha várias marcas e escolha qual briefing orienta cada geração. A base já usa `brands` como workspaces e vincula rascunhos, permissões e assinatura ao `brand_id`. A restrição `brands.user_id unique` impedia a criação de uma segunda marca.

## Decisão

- Cada marca continua sendo um workspace independente. A associação existente em `brand_members` é a fonte de autorização.
- O BFF expõe `/api/brands` para listar somente marcas às quais o usuário tem acesso e para criar uma marca com membership `owner`.
- O frontend mantém a lista de workspaces autorizados, oferece seleção no estúdio de IA e na configuração da agenda e envia o `workspaceId` escolhido ao BFF.
- O briefing completo da marca acompanha a geração. O rascunho é persistido no workspace selecionado, sem depender do workspace que estava aberto antes do pedido.
- A seleção também pode trocar o workspace ativo para que calendário, marca e edição de rascunhos continuem coerentes depois da geração.
- A restrição de unicidade em `brands.user_id` é removida por migração incremental; membership e autorização continuam obrigatórios.

## Consequências

- Uma conta pode criar e reutilizar várias marcas sem duplicar usuários ou permissões.
- Rascunhos permanecem isolados por marca e os endpoints existentes continuam protegidos por `requireWorkspaceContext`.
- A assinatura é avaliada para o workspace usado na geração; uma marca sem plano ativo recebe a mesma resposta de bloqueio das demais funções protegidas.
- O modelo permite no futuro convidar membros para uma marca sem alterar o fluxo de seleção.

## Validação

- O backend valida o briefing antes de chamar `create_brand_with_owner`, que insere a marca e o membership `owner` na mesma transação SQL.
- A lista de marcas é derivada de `brand_members`, nunca de IDs enviados pelo cliente sem verificação.
- `ensure_default_workspace` usa lock transacional por usuário para que chamadas simultâneas não criem workspaces iniciais duplicados após remover `brands.user_id unique`.
- Testes de contrato verificam a chamada única às RPCs; uma execução contra Postgres local descartável ainda é necessária para validar o comportamento transacional real.
