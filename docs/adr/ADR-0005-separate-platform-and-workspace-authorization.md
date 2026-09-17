# ADR-0005: Separar autorização da plataforma e do workspace

## Status

Accepted — 2026-09-17

## Decision Drivers

- Financeiro, Fiscal, clientes e economia dos planos são operações internas do PostFlow.
- Clientes precisam acessar apenas os próprios conteúdos, consumo, assinatura, faturas e comprovantes acadêmicos.
- Papéis globais não conseguem representar simultaneamente privilégios internos e participação em uma marca.
- O uso server-side da `service_role` exige autorização explícita antes de cada consulta.
- A entrega acadêmica deve continuar funcionando durante uma migração incremental e não destrutiva.

## Considered Options

1. Continuar usando uma única role global em `app_metadata`.
2. Colocar toda autorização somente em políticas RLS acessadas diretamente pelo navegador.
3. Separar `WorkspaceRole` e `PlatformRole`, com o BFF como fronteira canônica.

## Decision Outcome

**Chosen option**: "Separar `WorkspaceRole` e `PlatformRole` no BFF", porque os dois papéis respondem a perguntas diferentes e não devem conceder privilégios um ao outro.

- `WorkspaceRole` pertence a `brand_members`: `owner`, `admin`, `editor` ou `viewer`.
- `PlatformRole` pertence a `platform_members`: `platform_owner`, `finance_admin`, `support` ou `null`.
- O backend resolve ambos a partir do banco; o frontend nunca informa uma role confiável.
- Rotas de workspace exigem autenticação, membership e o papel mínimo aplicável.
- Rotas `/api/admin/*` exigem `PlatformRole`; cliente comum recebe `403`.
- `support` é somente leitura. Apenas `platform_owner` e `finance_admin` alteram Financeiro e Fiscal.
- Assinaturas, consumo, faturas e comprovantes são isolados por workspace.
- Financeiro, Fiscal e economia do plano formam o backoffice interno.

### Positive Consequences

- Um cliente não herda acesso administrativo por ser owner da própria marca.
- O isolamento multitenant passa a ser verificável por API e banco.
- A navegação pode refletir permissões sem ser a barreira de segurança.
- Cobrança, receita e documento fiscal ganham relações explícitas e auditáveis.

### Negative Consequences

- A sessão precisa carregar mais contexto e a API precisa resolver o workspace atual.
- São necessárias migrations, middlewares e testes cruzados com mais de um usuário.
- A ADR-0004 permanece histórica, mas sua marca acadêmica fixa deixa de ser um caminho de produção.

## Data and Integration Boundaries

- `PaymentProvider` isola um futuro Stripe, Mercado Pago ou outro provedor.
- `FiscalProvider` isola uma futura emissão fiscal real.
- Os adapters demonstrativos não confirmam pagamento externo nem emitem NFS-e.
- Fatura paga gera ou atualiza uma única receita por chave idempotente.
- Apenas venda ou serviço faturado entra na projeção fiscal.
- A alíquota e os valores são gravados como snapshot no comprovante acadêmico.

## Validation

- APIs administrativas retornam `401` sem sessão e `403` para cliente comum.
- Membership de uma marca não permite ler outra marca.
- `support`, `editor` e `viewer` não alteram cobrança ou backoffice.
- Processar duas vezes a mesma fatura paga não duplica receita.
- Despesa e receita não tributável não geram documento fiscal.
- Alterar a alíquota padrão não muda documentos existentes.
- Nenhum caminho de produção contém `DEMO_BRAND_ID` ou segredo administrativo no bundle.

## Relationship to Previous Decisions

- Preserva a ADR-0001: Express continua sendo o BFF e `brand_members` continua sendo a base do isolamento.
- Preserva as ADR-0002 e ADR-0003.
- Substitui a limitação temporária descrita na ADR-0004; os clientes Supabase separados continuam válidos, mas a autorização passa a ser tenant-aware.
