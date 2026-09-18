# PostFlow

Plataforma SaaS para criar, revisar e organizar conteúdo de redes sociais com apoio de inteligência artificial.

O PostFlow reúne autenticação, configuração da marca, geração de textos, agenda editorial, assinatura do cliente e um backoffice financeiro e fiscal. O projeto foi desenvolvido para o **Projeto Multidisciplinar VI**.

[Acessar aplicação publicada](https://post-flow-ochre.vercel.app)

## Funcionalidades atuais

### Área do cliente

- cadastro, confirmação de e-mail, login e recuperação de senha;
- separação dos dados por workspace e níveis de acesso;
- configuração da identidade da marca;
- geração de título, legenda, hashtags e texto visual por IA;
- revisão do conteúdo antes de salvar;
- agenda com criação, edição e exclusão de rascunhos;
- consulta de plano, consumo, faturas e comprovantes;
- contratação e pagamento demonstrativos para apresentação acadêmica.

### Backoffice

- controle de receitas, despesas, saldo e pendências;
- acompanhamento fiscal das receitas;
- emissão de comprovante fiscal simulado, sem validade legal;
- configuração e análise econômica do plano;
- acesso protegido por papéis internos da plataforma.

## Acesso e permissões

| Área               | Rotas                                             | Regra de acesso                                 |
| ------------------ | ------------------------------------------------- | ----------------------------------------------- |
| Autenticação       | `/login`                                          | Pública                                         |
| Assinatura         | `/billing`                                        | Usuário autenticado                             |
| Marca, IA e agenda | `/brand`, `/chat`, `/calendar`                    | Membro do workspace com plano ativo ou em teste |
| Administração      | `/admin/finance`, `/admin/fiscal`, `/admin/plans` | Membro interno autorizado                       |

Contas sem plano são direcionadas para a página de assinatura. Os papéis do workspace (`owner`, `admin`, `editor`, `viewer`) são independentes dos papéis internos da plataforma (`platform_owner`, `finance_admin`, `support`).

## Tecnologias

| Camada                  | Tecnologias principais                                     |
| ----------------------- | ---------------------------------------------------------- |
| Frontend                | React 19, TypeScript 6, Vite 8, React Router e CSS Modules |
| Backend                 | Node.js 22, Express 5 e Zod 4                              |
| Banco e autenticação    | Supabase Auth e PostgreSQL                                 |
| Inteligência artificial | OpenAI Responses API                                       |
| Testes                  | Vitest, React Testing Library, Supertest e Playwright      |
| Hospedagem              | Vercel                                                     |

## Executar localmente

### Requisitos

- Node.js 22;
- npm;
- projeto configurado no Supabase.

### Instalação

```bash
git clone https://github.com/JoaovSilva2005/PostFlow.git
cd PostFlow
npm install
```

Copie `.env.example` para `.env`, preencha as variáveis e execute:

```bash
npm run db:verify
npm run dev
```

O comando inicia:

- frontend: `http://localhost:5173`;
- API: `http://localhost:3001`.

## Variáveis de ambiente

| Variável                                             | Uso                                                 |
| ---------------------------------------------------- | --------------------------------------------------- |
| `VITE_SUPABASE_URL`                                  | URL pública do projeto Supabase                     |
| `VITE_SUPABASE_PUBLISHABLE_KEY`                      | Chave publicável usada na autenticação              |
| `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY` | Acesso administrativo usado somente pelo backend    |
| `VITE_API_URL`                                       | URL local da API; use `http://localhost:3001/api`   |
| `OPENAI_API_KEY`                                     | Credencial server-side para geração de conteúdo     |
| `OPENAI_TEXT_MODEL`                                  | Modelo compatível com a Responses API               |
| `APP_URL`                                            | Origem autorizada e retorno da recuperação de senha |

Nunca use uma chave administrativa do Supabase ou uma chave de IA em variável iniciada com `VITE_`. Em produção, configure também um SMTP próprio no Supabase para evitar o limite reduzido do serviço de e-mail de teste.

Para uma demonstração local sem IA real, use `VITE_AI_MODE=demo`. O fallback de dados em memória existe somente para desenvolvimento e exige `POSTFLOW_ALLOW_DEMO_FALLBACK=true`.

## Banco de dados

Em uma instalação nova:

1. execute [`database/schema.sql`](database/schema.sql) no SQL Editor do Supabase;
2. execute [`database/seed.sql`](database/seed.sql);
3. configure as variáveis de ambiente;
4. valide a conexão e o CRUD.

```bash
npm run db:verify
npm run db:test-crud
```

As alterações incrementais aplicadas ao projeto hospedado ficam em [`supabase/migrations`](supabase/migrations). Não coloque senhas ou chaves nos arquivos de seed.

## Scripts de qualidade

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Para a verificação visual responsiva:

```bash
npx playwright install chromium
npm run test:responsive
```

## Estrutura do projeto

```text
api/             # entrada serverless da API na Vercel
backend/         # API, autenticação, autorização e regras de negócio
database/        # schema, seed e documentação do banco
docs/            # arquitetura, auditoria e manuais
scripts/         # verificações do banco, API e responsividade
src/
├── app/         # rotas, sessão e proteção de acesso
├── components/  # componentes reutilizáveis
├── domain/      # tipos e regras do domínio
├── features/    # telas e serviços organizados por funcionalidade
├── services/    # cliente HTTP e repositórios
└── styles/      # tokens e estilos globais
supabase/        # migrations aplicadas ao Supabase hospedado
```

O frontend acessa os dados pela API Express. A API valida a sessão, o workspace, o plano e as permissões antes de utilizar a chave administrativa do Supabase no servidor.

## Publicação na Vercel

O frontend e a API são publicados no mesmo projeto. A configuração em [`vercel.json`](vercel.json) direciona `/api/*` para a função Express e mantém as rotas do React acessíveis por URL direta.

Na Vercel:

1. importe o repositório;
2. mantenha a raiz do projeto como `Root Directory`;
3. cadastre as variáveis de produção;
4. não defina `VITE_API_URL`, ou use somente `/api`;
5. cadastre `${APP_URL}/login` nas URLs de redirecionamento do Supabase Auth.

Depois do deploy, valide:

- `/api/health` para disponibilidade da API;
- `/api/health/ready` para conexão com o banco;
- login, contratação, geração de conteúdo e agenda;
- restrição das rotas administrativas.

## Limitações atuais

- a IA gera conteúdo textual; geração de imagem ainda não está integrada;
- pagamento e emissão fiscal usam adapters demonstrativos e não movimentam dinheiro real;
- o comprovante fiscal é acadêmico e não substitui NFS-e;
- publicação automática em redes sociais ainda não foi implementada.

## Documentação

- [Arquitetura e autorização](docs/architecture.md)
- [Estúdio de conteúdo e contrato da IA](docs/content-studio.md)
- [Fiscal e precificação](docs/fiscal-and-pricing.md)
- [Manual do usuário](docs/user-manual.md)
- [Auditoria para produção](docs/production-readiness-audit.md)
- [Documentação do banco](database/README.md)

## Gestão acadêmica

- [Backlog no Jira](https://joaovsilva3530.atlassian.net/issues/?jql=project%20%3D%20SCRUM%20ORDER%20BY%20key%20ASC)
- [Documentação no Confluence](https://joaovsilva3530.atlassian.net/wiki/spaces/DDS/pages/2162689/PostFlow+Vis+o+Inicial+do+Projeto)
