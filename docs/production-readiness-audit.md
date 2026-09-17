# Auditoria para dados reais

Data: 2026-09-17

## Resultado

O PostFlow possui uma boa base demonstrável, mas o banco atual ainda é de
demonstração. A aplicação não deve receber dados reais de clientes antes da
migração de tenancy e RLS descrita abaixo.

## Bloqueadores encontrados

1. `DEMO_USER_ID` e `DEMO_BRAND_ID` fazem usuários diferentes compartilharem
   a mesma marca e os mesmos lançamentos.
2. As políticas atuais concedem acesso ao tenant acadêmico para `anon` e
   `authenticated`.
3. Marca e posts são consultados diretamente pelo navegador sem a sessão
   Supabase; autenticar na API não autentica esse cliente.
4. O fallback financeiro em memória aceitava gravações efêmeras após erro do
   banco. Agora ele só pode ser habilitado explicitamente fora de produção.
5. O fiscal ainda é uma projeção financeira, não um documento fiscal legal,
   imutável e numerado.

## Mudanças entregues nesta etapa

- `POST /api/content/generate` autenticado, validado e protegido por perfil;
- adapter OpenAI isolado atrás de `ContentProvider`;
- chave da IA somente no servidor, timeout e saída estruturada validada;
- modo API como padrão e demo apenas quando solicitado;
- produção falha de forma fechada quando o Supabase falha;
- ADRs, migração de tenancy preparada e fitness functions.

## Sequência segura para ativar dados reais

1. Fazer backup do Supabase e testar a migração em um projeto de homologação.
2. Aplicar `database/migrations/20260917_production_tenancy.sql`.
3. Associar a marca existente ao UUID real do proprietário em
   `brand_members`; validar com dois usuários diferentes.
4. Migrar marca/posts do acesso direto do navegador para endpoints BFF que
   criam um cliente Supabase com o JWT da requisição.
5. Remover definitivamente as políticas `demo_*` e o seed acadêmico do banco
   de produção.
6. Só então cadastrar dados reais; ativar logs, alertas e backups.

## Configuração da IA

Na Vercel, cadastrar somente no ambiente de servidor:

```env
OPENAI_API_KEY=...
OPENAI_TEXT_MODEL=gpt-5.6-luna
VITE_AI_MODE=api
POSTFLOW_ALLOW_DEMO_FALLBACK=false
```

Nunca criar `VITE_OPENAI_API_KEY`: variáveis `VITE_` são públicas no bundle.
O endpoint gera título, legenda, hashtags e texto visual. Imagem deve ser uma
ação separada e opcional para controlar custo e latência.

## Critério de liberação

- usuário A não lê nem altera dados do usuário B, pela API ou REST;
- usuário anônimo não acessa dados de negócio;
- erro do banco retorna erro e não confirma uma gravação temporária;
- nenhuma chave secreta aparece no frontend ou no Git;
- geração de IA exige sessão, respeita limite e não registra prompts completos;
- migrações, testes, typecheck, lint e build passam no CI.
