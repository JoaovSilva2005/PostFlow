# Arquitetura do PostFlow

O projeto é um monorepositório simples: frontend, backend e banco de dados ficam no mesmo repositório, mas cada parte possui uma responsabilidade clara.

```text
PostFlow/
├── api/                       # adaptador serverless usado pela Vercel
├── backend/                   # API, regras de negócio e acesso ao banco
│   ├── config/                # ambiente e cliente Supabase do servidor
│   ├── modules/auth/          # autenticação, cookies e autorização
│   ├── modules/tenancy/       # workspace atual, memberships e platform roles
│   ├── modules/billing/       # planos, assinaturas, consumo e faturas
│   ├── modules/finance/       # módulo financeiro completo
│   ├── modules/fiscal/        # projeção fiscal e vendas integradas ao financeiro
│   ├── shared/                # recursos compartilhados pelo backend
│   └── test/                  # apoios reutilizáveis para testes
├── database/                  # schema, migrations, seed e documentação
├── scripts/
│   ├── api/                   # validações executáveis da API
│   └── database/              # validações executáveis do banco
├── src/                       # frontend React
│   ├── app/                   # rotas, proteção e estado global
│   ├── components/            # componentes visuais compartilhados
│   ├── domain/                # tipos usados pela aplicação
│   ├── features/              # telas, serviços e testes por funcionalidade
│   ├── services/              # infraestrutura compartilhada
│   ├── styles/                # tokens e estilos globais
│   └── test/                  # configuração e utilitários dos testes
└── docs/                      # documentação e evidências visuais
```

## Fluxo de uma requisição

```text
Login React → authApi → AuthRoutes → Supabase Auth → cookie HttpOnly
Área do cliente → /workspaces/:id → autenticação + WorkspaceRole
Área administrativa → /admin/* → autenticação + PlatformRole
Financeiro → FinancialService → Repository → Supabase/PostgreSQL
Fiscal ────────────────────────────────┘
```

- A **tela** coleta os dados e apresenta o resultado.
- A **API** define as entradas e saídas HTTP.
- O **serviço** valida as regras e faz os cálculos.
- O **repositório** isola o acesso ao Supabase.
- O **banco** garante PKs, FKs, restrições e políticas RLS.

Essa separação permite trocar a interface ou a persistência sem reescrever as regras de negócio.

## Como localizar uma funcionalidade

Cada pasta em `src/features` reúne a tela, o estilo, o teste e os auxiliares específicos daquela funcionalidade:

| Funcionalidade | Frontend                | Backend                   | Banco                                                          |
| -------------- | ----------------------- | ------------------------- | -------------------------------------------------------------- |
| Login/cadastro | `src/features/auth`     | `backend/modules/auth`    | Supabase Auth, `users`, `profiles`                             |
| Marca          | `src/features/brand`    | BFF com contexto de marca | `brands` e `brand_members`                                     |
| Geração        | `src/features/content`  | IA simulada               | `post_drafts` e `post_hashtags`                                |
| Agenda         | `src/features/calendar` | Data API do Supabase      | `post_drafts`                                                  |
| Cobrança       | `src/features/billing`  | `backend/modules/billing` | `plans`, `subscriptions`, `usage_counters`, `billing_invoices` |
| Financeiro     | `src/features/finance`  | `backend/modules/finance` | `financial_transactions`                                       |
| Fiscal         | `src/features/fiscal`   | `backend/modules/fiscal`  | `fiscal_documents` e receitas faturadas                        |

Financeiro, Fiscal e economia do plano são backoffice do PostFlow. Eles não são produtos disponíveis a clientes comuns. A área `Assinatura e cobrança` apresenta somente o plano, consumo, faturas e comprovantes do workspace autenticado.

## Persistência do cadastro

O Supabase Auth é responsável por e-mail e senha. Durante o cadastro, nome da
marca e segmento seguem como metadados de onboarding, sem participar de nenhuma
decisão de autorização. No primeiro acesso confirmado, o backend provisiona os
dados normalizados:

| Campo do formulário | Destino persistente                            |
| ------------------- | ---------------------------------------------- |
| Nome completo       | `users.display_name` e `profiles.display_name` |
| E-mail              | Supabase Auth e `users.email`                  |
| Marca ou empresa    | `brands.name`                                  |
| Segmento            | `brands.segment`                               |
| Senha               | Supabase Auth, armazenada somente como hash    |
| Confirmar senha     | Não persiste; existe apenas para validação     |

O workspace inicial recebe o usuário como `owner` em `brand_members`. Contas
anteriores sem esses metadados continuam usando os valores de fallback.

## Autorização em dois contextos

`WorkspaceRole` nunca concede acesso ao backoffice e `PlatformRole` nunca substitui a associação a uma marca.

| Ação                          |       owner |       admin |   editor | viewer | platform_owner | finance_admin | support |
| ----------------------------- | ----------: | ----------: | -------: | -----: | -------------: | ------------: | ------: |
| Conteúdo do próprio workspace |    escrever |    escrever | escrever |    ler |              — |             — |       — |
| Equipe e assinatura           | administrar | administrar |      ler |    ler |              — |             — |       — |
| Próprias faturas e consumo    |         ler |         ler |      ler |    ler |              — |             — |       — |
| Financeiro/Fiscal interno     |           — |           — |        — |      — |       escrever |      escrever |     ler |
| Planos e economia interna     |           — |           — |        — |      — |    administrar |           ler |     ler |

O frontend usa essas informações para navegação e usabilidade. A autorização real acontece novamente no backend. Ausência de sessão resulta em `401`; sessão sem o papel necessário resulta em `403`.

## Fluxo de cobrança

```text
Assinatura do workspace
        ↓
Fatura pendente ── confirmação idempotente de pagamento
        ↓
Fatura paga ─────→ uma única receita no Financeiro
                          ↓
                 cálculo fiscal didático
                          ↓
                 snapshot do comprovante
```

A fatura é a origem da cobrança. O livro financeiro registra o efeito econômico sem duplicar a cobrança. O documento fiscal guarda alíquota e valores calculados no momento da emissão; mudar a configuração posterior não reescreve documentos anteriores.

O servidor calcula valores monetários em centavos e nunca confia em `brand_id`, roles, imposto ou totais enviados pelo frontend. `PaymentProvider` e `FiscalProvider` são portas para integrações futuras; os adapters atuais são demonstrativos. O comprovante acadêmico não é NFS-e e não possui validade fiscal. Consulte `docs/fiscal-and-pricing.md` para hipóteses, fontes e limites. O fluxo de IA está documentado em `docs/content-studio.md`.

## Decisões simples para apresentação

- Nomes técnicos em inglês; interface e documentação em português.
- CSS Modules mantém o estilo perto de cada tela sem criar classes globais acidentais.
- Context + `useReducer` atende ao estado compartilhado sem adicionar uma biblioteca maior.
- Interfaces de repositório separam regra de negócio e persistência.
- Testes ficam próximos do código testado, facilitando mostrar implementação e evidência lado a lado.
