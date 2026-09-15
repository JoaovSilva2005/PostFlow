# PostFlow

Aplicação demonstrável para planejar conteúdo de redes sociais com apoio de inteligência artificial. O projeto foi desenvolvido para o **Projeto Multidisciplinar VI** e possui frontend React conectado a um banco PostgreSQL hospedado no Supabase.

Nesta versão, o usuário configura a identidade da marca, descreve um post no chat, revisa o conteúdo gerado e adiciona o rascunho a uma agenda mensal. O Épico 3 acrescenta uma API REST e o módulo financeiro para cadastrar receitas e despesas, controlar pagamentos e calcular o saldo atual.

## Executar o projeto

Requisitos: Node.js 22.14 ou superior, npm e um projeto no Supabase.

```bash
git clone https://github.com/JoaovSilva2005/PostFlow.git
cd PostFlow
npm install
npm run db:verify
npm run dev
```

Antes de executar, copie `.env.example` para `.env` e informe `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. A preparação completa está em [`database/README.md`](database/README.md).

`npm run dev` inicia a API em `http://localhost:3001` e o frontend no endereço informado pelo Vite. No login demonstrativo, use qualquer e-mail válido e uma senha com pelo menos seis caracteres.

## Publicar gratuitamente na Vercel

O frontend Vite e a API Express são publicados juntos no mesmo projeto. O arquivo `api/index.ts` adapta a API para uma Vercel Function, enquanto `vercel.json` prioriza `/api/*` e mantém as rotas do React Router acessíveis por link direto.

1. Envie o repositório para o GitHub e acesse [vercel.com/new](https://vercel.com/new).
2. Importe `JoaovSilva2005/PostFlow` e mantenha a raiz do repositório como **Root Directory**.
3. A Vercel usará automaticamente `npm run build` e publicará a pasta `dist`.
4. Em **Settings > Environment Variables**, cadastre para Production, Preview e Development:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
```

`VITE_API_URL` deve ficar ausente na Vercel. Nesse caso, o frontend usa `/api` no mesmo domínio. Se preferir cadastrá-la, use somente `/api`. `API_PORT` também é desnecessária no deploy serverless.

Antes de publicar, execute `database/schema.sql` e `database/seed.sql` no SQL Editor do Supabase. Depois do deploy, valide:

- `/login`: aplicação carregada e navegação funcionando;
- `/finance`: indicadores e lançamentos consultados pelo Supabase;
- `/api/health`: resposta JSON com `status: "ok"` e `storage: "supabase"`.

O `.env` e a pasta local `.vercel` são ignorados pelo Git. Nunca cadastre uma chave `service_role` em variável iniciada com `VITE_`; o projeto utiliza somente a chave publicável protegida pelas políticas RLS.

## API financeira

| Método   | Endpoint                               | Responsabilidade                   |
| -------- | -------------------------------------- | ---------------------------------- |
| `GET`    | `/api/health`                          | Verificar se a API está disponível |
| `GET`    | `/api/finance/transactions`            | Listar entradas e saídas           |
| `GET`    | `/api/finance/summary`                 | Calcular saldo e pendências        |
| `POST`   | `/api/finance/transactions`            | Criar um lançamento                |
| `PATCH`  | `/api/finance/transactions/:id`        | Editar um lançamento               |
| `PATCH`  | `/api/finance/transactions/:id/status` | Alterar Pago/Pendente              |
| `DELETE` | `/api/finance/transactions/:id`        | Excluir um lançamento              |

Regra do saldo: `receitas pagas - despesas pagas`. Valores pendentes são exibidos separadamente e não alteram o saldo atual.

Se o Supabase estiver temporariamente indisponível, a API ativa uma massa em memória para manter a demonstração funcional e a tela identifica esse estado como **API demonstração**. Os dados desse modo duram somente enquanto o servidor estiver aberto.

## Executar o banco de dados

No **SQL Editor** do Supabase, execute nesta ordem:

1. [`database/schema.sql`](database/schema.sql);
2. [`database/seed.sql`](database/seed.sql).

Depois, valide a conexão e o CRUD real:

```bash
npm run db:verify
npm run db:test-crud
```

## Verificações de qualidade

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Arquitetura

O código usa React, TypeScript, Vite, React Router, CSS Modules, Context com `useReducer`, Node.js, Express, Zod, Supabase/PostgreSQL, Vitest e React Testing Library.

```text
api/             # adaptador serverless da Vercel
backend/
├── config/      # variáveis de ambiente e cliente Supabase da API
├── modules/     # funcionalidades da API agrupadas por domínio
├── shared/      # recursos reutilizáveis do backend
└── test/        # apoios reutilizáveis dos testes
src/
├── app/         # rotas, proteção de acesso e estado compartilhado
├── components/  # menu lateral e componentes reutilizáveis
├── domain/      # tipos e conceitos do PostFlow
├── features/    # telas, estilos, serviços específicos e testes por função
├── services/    # conexão, persistência e sessão compartilhadas
├── styles/      # tokens do Figma, fonte e estilos globais
└── test/        # configuração e utilitários de teste
database/        # schema, migrações, carga inicial e documentação do DER
scripts/         # validações da API e do banco agrupadas por finalidade
```

A explicação completa, incluindo o fluxo **tela → API → regra → banco**, está em [`docs/architecture.md`](docs/architecture.md). As pastas [`src`](src/README.md), [`backend`](backend/README.md) e [`database`](database/README.md) também possuem guias próprios.

Os nomes de arquivos, componentes e tipos estão em inglês. A interface e a documentação estão em português para manter o código técnico consistente sem prejudicar a apresentação acadêmica.

## O que é simulado

- **Autenticação:** valida apenas o formato dos campos e mantém uma sessão demonstrativa no `localStorage`.
- **Inteligência artificial:** `MockAiService` gera deterministicamente um rascunho após um pequeno carregamento.
- **Persistência:** marcas, posts, hashtags e lançamentos financeiros são armazenados no Supabase/PostgreSQL.
- **Publicação:** não existe integração real com redes sociais neste incremento.

O fluxo de conteúdo ainda utiliza a Data API do Supabase. O módulo financeiro passa pelo backend Express, deixando validações e cálculos fora da interface. A autenticação real, a IA real e a publicação automática ficam para as próximas Sprints.

## Rastreabilidade

| Figma                 | Rota             | Componente                       | Jira       | Teste automatizado                          |
| --------------------- | ---------------- | -------------------------------- | ---------- | ------------------------------------------- |
| Login                 | `/login`         | `LoginPage`                      | `SCRUM-9`  | valida campos e navegação                   |
| Configuração da marca | `/brand`         | `BrandPage`                      | `SCRUM-12` | salva e recupera a marca                    |
| Entrada do chat       | `/chat`          | `ChatPage`                       | `SCRUM-15` | valida pedido e exibe carregamento          |
| Geração e prévia      | `/chat`          | `PostPreview` + `MockAiService`  | `SCRUM-16` | gera a prévia e inclui o rascunho na agenda |
| Agenda mensal         | `/calendar`      | `CalendarPage` + `calendarUtils` | `SCRUM-19` | apresenta cada rascunho na data correta     |
| Edição e exclusão     | `/calendar`      | `EditDraftDialog`                | `SCRUM-20` | altera ou exclui somente o item selecionado |
| Banco de dados        | fluxo todo       | `postFlowRepository.ts`          | `SCRUM-39` | conexão, CRUD, seed e integridade           |
| Estrutura financeira  | `/finance`       | `financial_transactions`         | `SCRUM-40` | contrato SQL, PK, FK, RLS e seed            |
| API financeira        | `/api/finance`   | `financialRoutes.ts`             | `SCRUM-41` | CRUD HTTP, validação e cálculo              |
| Painel financeiro     | `/finance`       | `FinancePage`                    | `SCRUM-42` | indicadores, formulário e histórico         |
| Documentação e testes | fluxo financeiro | README + testes                  | `SCRUM-43` | qualidade e rastreabilidade                 |

### Ordem sugerida para apresentar o código

1. `src/app/App.tsx`: mostra as rotas das quatro telas.
2. `src/features/auth/LoginPage.tsx`: validação e início do fluxo.
3. `src/features/brand/BrandPage.tsx`: configuração da identidade da marca.
4. `src/features/content/ChatPage.tsx`: pedido do usuário e chamada da IA simulada.
5. `src/features/content/mockAiService.ts`: geração simulada do conteúdo.
6. `src/features/content/PostPreview.tsx`: prévia e inclusão na agenda.
7. `src/features/calendar/CalendarPage.tsx`: calendário e rascunhos por data.
8. `src/features/calendar/EditDraftDialog.tsx`: edição e exclusão do rascunho.
9. `src/services/supabaseClient.ts`: conexão por variáveis de ambiente.
10. `src/services/postFlowRepository.ts`: operações de CRUD.
11. `database/schema.sql`: tabelas, chaves, RLS, restrições e índices.
12. `database/seed.sql`: dados iniciais usados na demonstração.
13. `scripts/database/testCrud.mjs`: evidência automatizada do CRUD real.
14. `backend/modules/finance/financialRoutes.ts`: entradas e saídas da API.
15. `backend/modules/finance/financialService.ts`: cálculo do saldo e regra de status.
16. `backend/modules/finance/financialRepository.ts`: persistência no Supabase.
17. `src/features/finance/FinancePage.tsx`: tela ligada à API.
18. `backend/modules/finance/financialRoutes.test.ts`: teste de CRUD HTTP.

## Telas codificadas

### Login

![Tela de login do PostFlow](docs/screenshots/login.png)

### Configuração da marca

![Tela de configuração da marca](docs/screenshots/brand.png)

### Chat e geração de posts

![Tela de chat com prévia gerada](docs/screenshots/chat.png)

### Agenda de conteúdo

![Tela da agenda mensal](docs/screenshots/calendar.png)

### Módulo financeiro

Acesse `/finance` depois do login para demonstrar os indicadores, o cadastro de uma entrada ou saída, a mudança de status e a atualização imediata do saldo.

## Links do projeto

- [Aplicação publicada na Vercel](https://post-flow-ochre.vercel.app)
- [Protótipo no Figma](https://www.figma.com/design/lYt49rDTT6Hf568TiP9zu9)
- [Backlog no Jira](https://joaovsilva3530.atlassian.net/issues/?jql=project%20%3D%20SCRUM%20ORDER%20BY%20key%20ASC)
- [Documentação no Confluence](https://joaovsilva3530.atlassian.net/wiki/spaces/DDS/pages/2162689/PostFlow+Vis+o+Inicial+do+Projeto)

## Estado do incremento

As telas principais e o módulo financeiro estão codificados. O fluxo **Login → Financeiro → Cadastrar lançamento → Alterar status → Recalcular saldo** passa pelo backend e pelo Supabase. O banco possui seis tabelas PostgreSQL, massa de testes, PKs, FKs, RLS e CRUD verificável pela aplicação e pelos testes automatizados.
