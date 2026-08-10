# PostFlow

Frontend demonstrável de uma plataforma para planejar conteúdo de redes sociais com apoio de inteligência artificial. O projeto foi desenvolvido para o **Projeto Multidisciplinar VI**.

Nesta versão, o usuário configura a identidade da marca, descreve um post no chat, revisa o conteúdo gerado e adiciona o rascunho a uma agenda mensal, onde pode editá-lo ou excluí-lo.

## Executar o projeto

Requisitos: Node.js 20.19 ou superior e npm.

```bash
git clone https://github.com/JoaovSilva2005/PostFlow.git
cd PostFlow
npm install
npm run dev
```

Abra o endereço informado pelo Vite. No login demonstrativo, use qualquer e-mail válido e uma senha com pelo menos seis caracteres.

## Verificações de qualidade

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Arquitetura

O código usa React, TypeScript, Vite, React Router, CSS Modules, Context com `useReducer`, Vitest e React Testing Library.

```text
src/
├── app/         # rotas, proteção de acesso e estado compartilhado
├── components/  # menu lateral e componentes reutilizáveis
├── domain/      # tipos e conceitos do PostFlow
├── pages/       # uma pasta por tela, com componente, estilo e teste
├── services/    # armazenamento local e serviço de IA simulado
├── styles/      # tokens do Figma, fonte e estilos globais
└── test/        # configuração e utilitários de teste
```

Os nomes de arquivos, componentes e tipos estão em inglês. A interface e a documentação estão em português para manter o código técnico consistente sem prejudicar a apresentação acadêmica.

## O que é simulado

- **Autenticação:** valida apenas o formato dos campos e salva uma sessão local.
- **Inteligência artificial:** `MockAiService` gera deterministicamente um rascunho após um pequeno carregamento.
- **Persistência:** marca, sessão e rascunhos são armazenados no `localStorage` com chaves iniciadas por `postflow:`.
- **Publicação:** não existe integração real com redes sociais neste incremento.

Backend, banco de dados, IA real e publicação automática ficam fora do escopo desta primeira versão.

## Rastreabilidade

| Figma | Rota | Componente | Jira | Teste automatizado |
|---|---|---|---|---|
| Login | `/login` | `LoginPage` | `SCRUM-9` | valida campos e navegação |
| Configuração da marca | `/brand` | `BrandPage` | `SCRUM-12` | salva e recupera a marca |
| Chat e geração | `/chat` | `ChatPage` | `SCRUM-15`, `SCRUM-16` | carregamento, prévia e inclusão na agenda |
| Agenda | `/calendar` | `CalendarPage` | `SCRUM-19`, `SCRUM-20` | data correta, edição, exclusão e menu ativo |

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

As quatro telas principais estão codificadas e o fluxo **Login → Marca → Chat → Prévia → Agenda → Editar rascunho** pode ser demonstrado sem backend. Os testes automatizados cobrem os comportamentos essenciais desta entrega.
