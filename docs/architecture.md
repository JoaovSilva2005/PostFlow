# Arquitetura do PostFlow

O projeto é um monorepositório simples: frontend, backend e banco de dados ficam no mesmo repositório, mas cada parte possui uma responsabilidade clara.

```text
PostFlow/
├── api/                       # adaptador serverless usado pela Vercel
├── shared/                    # contratos e regras puras entre os runtimes
│   └── domain/                # financeiro, fiscal e catálogo de segmentos
├── backend/                   # API, regras de negócio e acesso ao banco
│   ├── config/                # ambiente e cliente Supabase do servidor
│   ├── modules/auth/          # autenticação, cookies e autorização
│   ├── modules/tenancy/       # workspace atual, memberships e platform roles
│   ├── modules/brand/         # seleção e criação de marcas
│   ├── modules/content/       # geração OpenAI, contratos e franquias
│   ├── modules/workspace/     # marca e CRUD transacional dos rascunhos
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

## Direção das dependências

```text
Frontend (src) ───────┐
                      ├──> shared (contratos e regras puras)
Backend (backend) ────┘

Frontend ───> API Express/BFF ───> módulos backend ───> Supabase/PostgreSQL
                                           └──────────> OpenAI Responses e Images
```

`shared/` não conhece React, Express, Supabase, Node ou variáveis de ambiente.
O backend não importa `src/`. As fachadas em `src/domain` existem apenas para
preservar os imports atuais do frontend enquanto os contratos comuns são
centralizados.

## Geração de conteúdo

O estúdio individual envia ao BFF o nível `standard` ou `quality`, nunca um
identificador de modelo arbitrário. O backend usa GPT-6 Luna para texto e
GPT Image 2.5 Flare para a imagem padrão; `quality` seleciona GPT Image 2.5
Sunburst. Esses modelos são padrões configuráveis no ambiente do backend. A
qualidade e o tamanho da Image Generation API são configurações separadas. O
planejador em lote continua gerando somente texto estruturado e reserva uma
unidade de texto por rascunho, sem imagens.

## Fluxo de uma requisição

```text
Login React → /api/auth → AuthRoutes → Supabase Auth → cookies HttpOnly
Área do cliente → BFF → membership + role + assinatura → RPC/queries PostgreSQL
Geração de conteúdo → reserva de franquia → OpenAI → consumo/liberação da reserva
Área administrativa → /api/admin/* → autenticação + PlatformRole
Financeiro/Fiscal → serviços do backend → PostgreSQL (cobrança e fiscal simulados)
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
| Marca          | `src/features/brand`    | `backend/modules/brand` e `workspace` | `brands` e `brand_members`                      |
| Geração        | `src/features/content`  | `backend/modules/content` + OpenAI    | `usage_counters`, reservas, `post_drafts` e hashtags |
| Agenda         | `src/features/calendar` | `backend/modules/workspace`           | `post_drafts` e `post_hashtags`                     |
| Cobrança       | `src/features/billing`  | `backend/modules/billing`             | `plans`, `subscriptions`, uso e `billing_invoices`  |
| Financeiro     | `src/features/finance`  | `backend/modules/finance` | `financial_transactions`                                       |
| Fiscal         | `src/features/fiscal`   | `backend/modules/fiscal`  | `fiscal_documents` e receitas faturadas                        |

Financeiro, Fiscal e economia do plano são backoffice do PostFlow. Eles não são produtos disponíveis a clientes comuns. A área `Assinatura e cobrança` apresenta somente o plano, consumo, faturas e comprovantes do workspace autenticado.

## Convenção de banco

`database/schema.sql` é o baseline acadêmico; `database/seed.sql` cria personas
demonstrativas e não deve ser usado na instalação SaaS. O SaaS precisa do schema
e de todas as migrações de `database/migrations` seguidas pelas de
`supabase/migrations`, cada diretório em ordem lexicográfica. As linhagens foram
mantidas separadas porque migrações antigas podem já ter sido aplicadas
manualmente; não se deve mover ou renomear esses arquivos nem presumir que o
histórico remoto coincide com o repositório.

O manifesto `scripts/database/migration-inventory.json` lista os arquivos das
duas trilhas. `npm run db:migrations:check` detecta lacunas, extras e referências
quebradas sem conectar ao banco. Novas migrações são criadas com
`npx supabase migration new nome`, adicionadas ao manifesto e testadas primeiro
em uma base local descartável. `supabase db reset` isoladamente não aplica a
trilha histórica de `database/migrations`. Em projetos existentes, reconcilie o
histórico do Supabase com o schema real e use homologação antes de sincronizar
registros ou aplicar migrações.

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

O workspace inicial recebe o usuário como `owner` em `brand_members`. A RPC
`ensure_default_workspace` grava usuário, perfil, marca e membership na mesma
transação e usa um advisory lock por usuário para impedir duplicatas após a
remoção da unicidade de `brands.user_id`. A criação de marcas adicionais usa
`create_brand_with_owner`, que também grava marca e membership atomicamente.
Contas anteriores sem metadados continuam usando valores de fallback.

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

### Franquias de IA

O backend lê `text_limit` e `image_limit` do plano ligado à assinatura do
workspace. Uma geração individual reserva uma unidade de texto e uma de imagem;
cada item do lote reserva uma unidade de texto e nenhuma imagem, pois o lote
atual não produz imagens. A RPC bloqueia a linha de uso do período e inclui
consumo e reservas concorrentes na comparação, portanto a regra funciona entre
instâncias serverless. Resposta bem-sucedida consome a reserva; falha do
provedor a libera. Reservas abandonadas por encerramento abrupto expiram após
uma hora e são liberadas pela cobrança ou quando a próxima reserva do mesmo
período é solicitada.

A cobrança apresenta unidades consumidas e reservadas do período corrente. O
backend limita a legenda a 5.000 caracteres, o texto visual a 160 e aplica o
limite da plataforma ao conjunto legenda + hashtags. A API Express aceita até
8 MiB por corpo JSON e responde `413` acima desse teto; o lote aceita no máximo
42 itens.

Em produção, CORS aceita apenas a origem exata de `APP_URL` e as origens HTTPS
exatas de `APP_ALLOWED_ORIGINS`. Previews da Vercel não são liberados por
padrão; `localhost` e `127.0.0.1` ficam disponíveis apenas fora de produção.

## Decisões simples para apresentação

- Nomes técnicos em inglês; interface e documentação em português.
- CSS Modules mantém o estilo perto de cada tela sem criar classes globais acidentais.
- Context + `useReducer` atende ao estado compartilhado sem adicionar uma biblioteca maior.
- Interfaces de repositório separam regra de negócio e persistência.
- Testes ficam próximos do código testado, facilitando mostrar implementação e evidência lado a lado.
