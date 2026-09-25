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

O logout fornece os tokens access e refresh ao SDK instalado, restaura a sessão
com `setSession` e chama `signOut({ scope: 'local' })`. Os cookies HttpOnly são
limpos mesmo quando a revogação remota falha; nessa situação, a API devolve
`503` sanitizado.

O endpoint de saúde é público. A API financeira exige autenticação; operações de escrita também rejeitam o papel `viewer`.

## Clientes Supabase e configuração

O backend mantém dois clientes com responsabilidades diferentes:

- `createSupabaseAuthClient` usa `SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_PUBLISHABLE_KEY`) para login, renovação e validação de sessões;
- `createSupabaseAdminDataClient` usa `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SECRET_KEY`) no backend para dados de tenancy, marcas, conteúdo, billing, financeiro e fiscal.

Em produção, configure um SMTP próprio em **Supabase > Authentication > Emails > SMTP Settings**. O SMTP padrão do Supabase é destinado a testes e possui uma cota pequena; quando ela é atingida, a API responde `429` e o PostFlow orienta o usuário a tentar novamente mais tarde.

O CORS de produção aceita apenas a origem de `APP_URL` e origens HTTPS exatas
configuradas em `APP_ALLOWED_ORIGINS`. Não há liberação por padrão de domínios
de preview. Em desenvolvimento, origens `localhost` e `127.0.0.1` são aceitas.

As chaves privilegiadas não podem ter prefixo `VITE_`, não devem aparecer no frontend e nunca devem ser versionadas. A API falha ao iniciar o acesso a dados sem a chave privilegiada; ela nunca degrada para a chave pública.

## Conteúdo, quotas e workspace

- `modules/content` contém os contratos, serviço, adapter OpenAI e acesso às
  franquias. Geração individual reserva um texto e uma imagem; cada item do lote
  reserva um texto e nenhuma imagem.
- O texto usa `gpt-6-luna` por padrão. A imagem individual usa
  `gpt-image-2.5-flare` por padrão; o cliente pode solicitar somente o nível
  `quality`, que o backend mapeia para `gpt-image-2.5-sunburst`. Os modelos
  ficam configuráveis por `OPENAI_TEXT_MODEL`, `OPENAI_IMAGE_MODEL` e
  `OPENAI_IMAGE_QUALITY_MODEL`; a credencial permanece server-side. A qualidade
  e o tamanho de saída continuam configurados por `OPENAI_IMAGE_QUALITY` e
  `OPENAI_IMAGE_SIZE` para os dois níveis.
- `SupabaseContentQuotaService` usa as RPCs PostgreSQL para reservar e finalizar
  unidades. A RPC bloqueia a linha de `usage_counters` do workspace/período e
  compara limites do plano com consumo e reservas; o processo não depende de
  memória da instância serverless.
- Reservas são consumidas após resposta bem-sucedida e liberadas após falha do
  provedor. Reservas pendentes expiradas são liberadas na leitura da cobrança
  ou na próxima reserva do mesmo workspace/período.
- `modules/workspace` valida limites de legenda, texto visual e caracteres da
  plataforma. Criação/edição individual de rascunho mais hashtags usa RPC
  transacional; a persistência em lote continua usando `create_post_drafts_batch`.
- Ao criar um post com imagem, o backend a armazena no bucket privado
  `post-draft-images`, registra o caminho e devolve uma URL assinada temporária.
- `modules/brand` cria a marca e seu membership `owner` em uma única RPC.
- `modules/tenancy` provisiona o workspace inicial com lock transacional por
  usuário, evitando marcas duplicadas mesmo sem unicidade em `brands.user_id`.

O parser JSON aceita até 8 MiB para comportar o maior lote de 42 itens e a
imagem-base64 opcional da revisão. Payload acima desse teto retorna `413`.
Erros de parse retornam `400`; erros internos são registrados sem corpo,
tokens, senhas, chaves ou mensagens potencialmente sensíveis.

## Módulo financeiro

Dentro de `modules/finance`:

- `financialRoutes.ts` recebe e valida HTTP;
- `financialService.ts` concentra cálculos e regras;
- `financialRepository.ts` define o contrato e acessa o Supabase;
- `resilientFinancialRepository.ts` mantém o modo de demonstração;
- `memoryFinancialRepository.ts` fornece dados temporários;
- `financialTypes.ts` documenta entradas e saídas;
- arquivos `*.test.ts` comprovam o comportamento.
