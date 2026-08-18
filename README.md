# PostFlow

Aplicação demonstrável para planejar conteúdo de redes sociais com apoio de inteligência artificial. O projeto foi desenvolvido para o **Projeto Multidisciplinar VI** e atualmente possui frontend e a primeira versão do banco de dados relacional.

Nesta versão, o usuário configura a identidade da marca, descreve um post no chat, revisa o conteúdo gerado e adiciona o rascunho a uma agenda mensal, onde pode editá-lo ou excluí-lo.

## Executar o projeto

Requisitos: Node.js 22.14 ou superior e npm.

```bash
git clone https://github.com/JoaovSilva2005/PostFlow.git
cd PostFlow
npm install
npm run dev
```

Abra o endereço informado pelo Vite. No login demonstrativo, use qualquer e-mail válido e uma senha com pelo menos seis caracteres.

## Executar o banco de dados

O banco da Entrega 3 utiliza SQLite e pode ser criado sem instalar um servidor adicional:

```bash
npm run db:setup
npm run db:verify
```

O primeiro comando cria as tabelas e carrega os dados de teste. O segundo apresenta as tabelas, as quantidades, os relacionamentos e a verificação de integridade. A modelagem completa e o DER estão em [`database/README.md`](database/README.md).

## Verificações de qualidade

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Arquitetura

O código usa React, TypeScript, Vite, React Router, CSS Modules, Context com `useReducer`, SQLite, Vitest e React Testing Library.

```text
src/
├── app/         # rotas, proteção de acesso e estado compartilhado
├── components/  # menu lateral e componentes reutilizáveis
├── domain/      # tipos e conceitos do PostFlow
├── pages/       # uma pasta por tela, com componente, estilo e teste
├── services/    # armazenamento local e serviço de IA simulado
├── styles/      # tokens do Figma, fonte e estilos globais
└── test/        # configuração e utilitários de teste
database/        # schema SQL, carga inicial e documentação do DER
scripts/         # criação, verificação e testes do banco de dados
```

Os nomes de arquivos, componentes e tipos estão em inglês. A interface e a documentação estão em português para manter o código técnico consistente sem prejudicar a apresentação acadêmica.

## O que é simulado

- **Autenticação:** valida apenas o formato dos campos e salva uma sessão local.
- **Inteligência artificial:** `MockAiService` gera deterministicamente um rascunho após um pequeno carregamento.
- **Persistência do frontend:** marca, sessão e rascunhos ainda são armazenados no `localStorage` com chaves iniciadas por `postflow:`.
- **Publicação:** não existe integração real com redes sociais neste incremento.

O banco relacional está implementado e testado, mas ainda não é consumido pelo frontend. A API, a autenticação real, a IA real e a publicação automática ficam para as próximas Sprints.

## Rastreabilidade

| Figma                 | Rota        | Componente                       | Jira       | Teste automatizado                          |
| --------------------- | ----------- | -------------------------------- | ---------- | ------------------------------------------- |
| Login                 | `/login`    | `LoginPage`                      | `SCRUM-9`  | valida campos e navegação                   |
| Configuração da marca | `/brand`    | `BrandPage`                      | `SCRUM-12` | salva e recupera a marca                    |
| Entrada do chat       | `/chat`     | `ChatPage`                       | `SCRUM-15` | valida pedido e exibe carregamento          |
| Geração e prévia      | `/chat`     | `PostPreview` + `MockAiService`  | `SCRUM-16` | gera a prévia e inclui o rascunho na agenda |
| Agenda mensal         | `/calendar` | `CalendarPage` + `calendarUtils` | `SCRUM-19` | apresenta cada rascunho na data correta     |
| Edição e exclusão     | `/calendar` | `EditDraftDialog`                | `SCRUM-20` | altera ou exclui somente o item selecionado |
| Banco de dados        | —           | `schema.sql` + `seed.sql`        | `SCRUM-38` | estrutura, carga e integridade referencial  |

### Ordem sugerida para apresentar o código

1. `src/app/App.tsx`: mostra as rotas das quatro telas.
2. `src/pages/LoginPage/LoginPage.tsx`: validação e início do fluxo.
3. `src/pages/BrandPage/BrandPage.tsx`: configuração da identidade da marca.
4. `src/pages/ChatPage/ChatPage.tsx`: pedido do usuário e chamada da IA simulada.
5. `src/services/mockAiService.ts`: geração simulada do conteúdo.
6. `src/pages/ChatPage/PostPreview.tsx`: prévia e inclusão na agenda.
7. `src/pages/CalendarPage/CalendarPage.tsx`: calendário e rascunhos por data.
8. `src/pages/CalendarPage/EditDraftDialog.tsx`: edição e exclusão do rascunho.
9. `database/schema.sql`: tabelas, chaves, restrições e índices.
10. `database/seed.sql`: dados iniciais usados na demonstração.
11. `scripts/verify-database.mjs`: consulta de evidência da Entrega 3.

## Telas codificadas

### Login

![Tela de login do PostFlow](docs/screenshots/login.png)

### Configuração da marca

![Tela de configuração da marca](docs/screenshots/brand.png)

### Chat e geração de posts

![Tela de chat com prévia gerada](docs/screenshots/chat.png)

### Agenda de conteúdo

![Tela da agenda mensal](docs/screenshots/calendar.png)

## Links do projeto

- [Protótipo no Figma](https://www.figma.com/design/lYt49rDTT6Hf568TiP9zu9)
- [Backlog no Jira](https://joaovsilva3530.atlassian.net/issues/?jql=project%20%3D%20SCRUM%20ORDER%20BY%20key%20ASC)
- [Documentação no Confluence](https://joaovsilva3530.atlassian.net/wiki/spaces/DDS/pages/2162689/PostFlow+Vis+o+Inicial+do+Projeto)

## Estado do incremento

As quatro telas principais estão codificadas e o fluxo **Login → Marca → Chat → Prévia → Agenda → Editar rascunho** pode ser demonstrado sem backend. A Entrega 3 acrescenta cinco tabelas relacionais, carga inicial de dados e verificação automatizada de integridade. Os testes cobrem o frontend e o banco de dados.
