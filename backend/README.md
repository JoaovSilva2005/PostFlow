# Backend

O backend é uma API Express escrita em TypeScript. A entrada local está em `index.ts`; a Vercel reutiliza a mesma aplicação por meio de `api/index.ts`.

## Organização

| Pasta ou arquivo | Responsabilidade                                                      |
| ---------------- | --------------------------------------------------------------------- |
| `app.ts`         | monta middlewares, rotas e tratamento de erros                        |
| `index.ts`       | inicia o servidor no desenvolvimento local                            |
| `config`         | lê o ambiente e cria clientes Supabase separados por responsabilidade |
| `modules`        | agrupa cada domínio da API                                            |
| `shared`         | recursos comuns aos módulos                                           |
| `test`           | implementações auxiliares usadas nos testes                           |

## Módulo de autenticação

Dentro de `modules/auth`:

- `authRoutes.ts` valida login, cadastro, recuperação, renovação e logout;
- `authService.ts` aplica mensagens seguras e regras de autenticação;
- `supabaseAuthProvider.ts` integra a API ao Supabase Auth;
- `authCookies.ts` mantém tokens fora do JavaScript do navegador;
- `authMiddleware.ts` protege rotas e autoriza papéis;
- `authTypes.ts` define `owner`, `admin`, `editor` e `viewer`.

O endpoint de saúde é público. A API financeira exige autenticação; operações de escrita também rejeitam o papel `viewer`.

## Clientes Supabase e configuração

O backend mantém dois clientes com responsabilidades diferentes:

- `createSupabaseAuthClient` usa `SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_PUBLISHABLE_KEY`) para login, renovação e validação de sessões;
- `createSupabaseAdminDataClient` usa `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SECRET_KEY`) exclusivamente no repositório financeiro, que também abastece as consultas fiscais.

Em produção, configure um SMTP próprio em **Supabase > Authentication > Emails > SMTP Settings**. O SMTP padrão do Supabase é destinado a testes e possui uma cota pequena; quando ela é atingida, a API responde `429` e o PostFlow orienta o usuário a tentar novamente mais tarde.

As chaves privilegiadas não podem ter prefixo `VITE_`, não devem aparecer no frontend e nunca devem ser versionadas. A API falha ao iniciar o acesso a dados sem a chave privilegiada; ela nunca degrada para a chave pública.

## Módulo financeiro

Dentro de `modules/finance`:

- `financialRoutes.ts` recebe e valida HTTP;
- `financialService.ts` concentra cálculos e regras;
- `financialRepository.ts` define o contrato e acessa o Supabase;
- `resilientFinancialRepository.ts` mantém o modo de demonstração;
- `memoryFinancialRepository.ts` fornece dados temporários;
- `financialTypes.ts` documenta entradas e saídas;
- arquivos `*.test.ts` comprovam o comportamento.
