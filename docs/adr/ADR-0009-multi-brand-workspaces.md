# ADR-0009: Marcas múltiplas como workspaces selecionáveis

## Status

Accepted — 2026-09-24

## Contexto

O produto precisa permitir que a mesma conta mantenha várias marcas e escolha qual briefing orienta cada geração. A base usa `brands` como workspaces e vincula rascunhos e permissões ao `brand_id`. A assinatura também aponta para uma marca, que funciona como workspace de cobrança da conta. A restrição `brands.user_id unique` impedia a criação de uma segunda marca.

## Decisão

- Cada marca continua sendo um workspace independente. A associação existente em `brand_members` é a fonte de autorização.
- O BFF expõe `/api/brands` para listar somente marcas às quais o usuário tem acesso e para criar uma marca com membership `owner`.
- O frontend mantém a lista de workspaces autorizados, oferece seleção no estúdio de IA e na configuração da agenda e envia o `workspaceId` escolhido ao BFF.
- O briefing completo da marca acompanha a geração. O rascunho é persistido no workspace selecionado, sem depender do workspace que estava aberto antes do pedido.
- A seleção também pode trocar o workspace ativo para que calendário, marca e edição de rascunhos continuem coerentes depois da geração.
- A restrição de unicidade em `brands.user_id` é removida por migração incremental; membership e autorização continuam obrigatórios.
- Uma assinatura ativa em uma marca própria pode cobrir as demais marcas criadas pela mesma conta. Cada geração consome a franquia no workspace que mantém o plano.
- Contas comuns podem cadastrar até duas marcas próprias. A RPC aplica o limite com lock por usuário; `platform_owner` é isento para administração e testes.

## Consequências

- Uma conta pode criar e reutilizar até duas marcas próprias sem duplicar usuários ou permissões.
- Rascunhos permanecem isolados por marca e os endpoints existentes continuam protegidos por `requireWorkspaceContext`.
- No login, a API resolve a marca com assinatura ativa e mantém esse identificador na sessão. A franquia pode ser usada nas marcas próprias sem contratar uma assinatura por marca.
- O modelo permite no futuro convidar membros para uma marca sem alterar o fluxo de seleção.

## Validação

Complemento de autorização — 29/10/2026: o uso de plano entre marcas exige
membership `owner` na marca de conteúdo e titularidade real (`brands.user_id`)
nas duas marcas. `viewer`, `editor` e `admin` não delegam cobrança de outra
marca pelo cabeçalho `X-Billing-Workspace-Id`. Não existe delegação de cobrança
implementada. API, reserva de franquia e worker compartilham a resolução em
`workspaceBilling.ts`; a franquia é reservada na marca pagadora resolvida.

- O backend valida o briefing antes de chamar `create_brand_with_owner`, que insere a marca e o membership `owner` na mesma transação SQL.
- A lista de marcas é derivada de `brand_members`, nunca de IDs enviados pelo cliente sem verificação. A titularidade para aplicar o limite vem de `brands.user_id`.
- `ensure_default_workspace` usa lock transacional por usuário para que chamadas simultâneas não criem workspaces iniciais duplicados após remover `brands.user_id unique`.
- A migração `20260928172236_account_billing_and_brand_limit.sql` limita a criação dentro da RPC; a verificação com Postgres local descartável ainda é necessária para validar o comportamento transacional real.
