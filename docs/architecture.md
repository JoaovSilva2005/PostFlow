# Arquitetura do PostFlow

O projeto é um monorepositório simples: frontend, backend e banco de dados ficam no mesmo repositório, mas cada parte possui uma responsabilidade clara.

```text
PostFlow/
├── api/                       # adaptador serverless usado pela Vercel
├── backend/                   # API, regras de negócio e acesso ao banco
│   ├── config/                # ambiente e cliente Supabase do servidor
│   ├── modules/auth/          # autenticação, cookies e autorização
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
Tela financeira → financialApi → middleware de autenticação
                → FinancialService → Repository → Supabase/PostgreSQL
Tela fiscal     → fiscalApi ────────┘
```

- A **tela** coleta os dados e apresenta o resultado.
- A **API** define as entradas e saídas HTTP.
- O **serviço** valida as regras e faz os cálculos.
- O **repositório** isola o acesso ao Supabase.
- O **banco** garante PKs, FKs, restrições e políticas RLS.

Essa separação permite trocar a interface ou a persistência sem reescrever as regras de negócio.

## Como localizar uma funcionalidade

Cada pasta em `src/features` reúne a tela, o estilo, o teste e os auxiliares específicos daquela funcionalidade:

| Funcionalidade | Frontend                | Backend                   | Banco                                                 |
| -------------- | ----------------------- | ------------------------- | ----------------------------------------------------- |
| Login          | `src/features/auth`     | `backend/modules/auth`    | Supabase Auth                                         |
| Marca          | `src/features/brand`    | Data API do Supabase      | `brands`                                              |
| Geração        | `src/features/content`  | IA simulada               | `post_drafts` e `post_hashtags`                       |
| Agenda         | `src/features/calendar` | Data API do Supabase      | `post_drafts`                                         |
| Financeiro     | `src/features/finance`  | `backend/modules/finance` | `financial_transactions`                              |
| Fiscal         | `src/features/fiscal`   | `backend/modules/fiscal`  | mesma `financial_transactions`, sem duplicar receitas |

Financeiro e Fiscal recebem a mesma instância de `FinancialService`. Assim, leitura, escrita e eventual modo demonstrativo permanecem coerentes entre as duas telas. Os totais financeiros são calculados em centavos e a data de pagamento só muda quando ocorre uma transição real entre pendente e pago.

Regras puras em `src/domain/fiscal.ts` são compartilhadas entre API e simulação da tela; o servidor sempre recalcula impostos, sem confiar em valores enviados pelo cliente. O comprovante representa o registro atual e não tem validade fiscal. Consulte `docs/fiscal-and-pricing.md` para hipóteses, fontes e limites. O fluxo de IA está documentado em `docs/content-studio.md`.

## Decisões simples para apresentação

- Nomes técnicos em inglês; interface e documentação em português.
- CSS Modules mantém o estilo perto de cada tela sem criar classes globais acidentais.
- Context + `useReducer` atende ao estado compartilhado sem adicionar uma biblioteca maior.
- Interfaces de repositório separam regra de negócio e persistência.
- Testes ficam próximos do código testado, facilitando mostrar implementação e evidência lado a lado.
