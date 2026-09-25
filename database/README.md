# Banco de dados do PostFlow

O PostFlow usa Supabase Auth e PostgreSQL. O navegador acessa dados de negócio
pela API Express/BFF; o backend valida sessão, membership, papel e plano antes
de consultar o banco com cliente server-side. Esse cliente usa `service_role`,
que ignora RLS, por isso a autorização no BFF é obrigatória.

## Dois caminhos distintos

### Schema acadêmico demonstrativo

[`schema.sql`](schema.sql) cria a estrutura base de apresentação. Para uma
demonstração acadêmica isolada, execute `schema.sql` e depois [`seed.sql`](seed.sql).
Esse caminho não inclui tenancy SaaS, memberships, planos, assinaturas, uso,
cobrança, fiscal imutável ou as RPCs usadas atualmente pela aplicação.

O seed contém personas e registros de exemplo. Não o use em uma base com dados
reais ou no caminho SaaS.

### Instalação limpa da aplicação SaaS

Em um projeto local ou descartável vazio, aplique:

1. [`schema.sql`](schema.sql), como baseline das tabelas comuns;
2. todos os arquivos de [`migrations/`](migrations/) em ordem lexicográfica;
3. todos os arquivos de [`../supabase/migrations/`](../supabase/migrations/) em ordem lexicográfica.

As migrações em `database/migrations` criam e endurecem tenancy, memberships,
perfis, planos, assinaturas, contadores, faturas, fiscal e funções de cobrança.
As migrações em `supabase/migrations` completam permissões do BFF, snapshots
fiscais, constraints de cadastro, planejamento em lote, briefing da marca,
paleta de cores, múltiplas marcas e as RPCs transacionais atuais, incluindo
franquias atômicas de IA.

O inventário exato dos arquivos fica em
[`scripts/database/migration-inventory.json`](../scripts/database/migration-inventory.json).
Valide nomes, referências, lacunas e arquivos não inventariados com:

```bash
npm run db:migrations:check
```

O comando é estático e não conecta ao Supabase. O Supabase CLI aplica somente
`supabase/migrations`; portanto `supabase db reset` sozinho não cria uma
instalação SaaS completa deste repositório. Não execute `seed.sql` no caminho
SaaS.

## Migrações novas e bases existentes

Não mova nem renomeie migrações históricas: arquivos em qualquer diretório
podem já ter sido aplicados manualmente ou pelo CLI. Para uma nova alteração:

1. crie o arquivo com `npx supabase migration new nome_da_migracao`;
2. escreva SQL transacional e idempotente quando possível, com
   `search_path` seguro e permissões explícitas para funções privilegiadas;
3. registre o arquivo em `migration-inventory.json` e rode
   `npm run db:migrations:check`;
4. aplique e teste primeiro em Supabase local descartável ou homologação;
5. para uma base existente, confira o histórico registrado e o schema real
   antes de aplicar ou reparar qualquer registro de migração.

Parte do histórico anterior fica em `database/migrations`, fora da linhagem
gerenciada pelo Supabase CLI. Um projeto remoto pode ter recebido esses SQLs
manualmente e, por isso, seu histórico de migração pode não refletir os arquivos
do repositório. Antes de `db push` ou `migration repair`, compare
`supabase_migrations.schema_migrations` com objetos e definições reais, faça
backup e valide em homologação. Este repositório não confirma que qualquer
banco remoto esteja atualizado.

## Fluxos e integridade

- `brands` são workspaces; `brand_members` é a fonte de autorização.
- `plans` define `text_limit` e `image_limit`; `subscriptions` guarda o período
  vigente; `usage_counters` registra consumo e reservas do período.
- `content_generation_reservations` registra reservas pendentes, consumidas ou
  liberadas. RPCs bloqueiam a linha do contador antes de comparar limites; a
  cobrança e novas reservas liberam reservas vencidas após uma hora.
- `post_drafts` e `post_hashtags` são criados/editados dentro da mesma RPC.
- `create_brand_with_owner` grava marca e membership numa transação. A RPC
  `ensure_default_workspace` usa advisory lock por usuário para serializar o
  provisionamento inicial depois que `brands.user_id` deixou de ser único.
- Funções usadas pelo BFF têm `search_path` vazio, execução revogada de
  `public`/`anon`/`authenticated` e grant explícito a `service_role`.
- Pagamento e emissão fiscal continuam demonstrativos; os comprovantes são
  acadêmicos, sem validade legal, e não representam uma integração de cobrança
  real.

## Validação de dados

```bash
npm test
npm run db:verify
npm run db:test-crud
```

`npm test` inclui verificações estáticas de schema e inventário, sem aplicar
migrações. `db:verify` consulta a URL configurada no ambiente. `db:test-crud`
cria, altera e exclui um registro temporário, então execute somente contra uma
base local descartável. Nenhum desses comandos demonstra, por si só, o estado de
um projeto remoto de produção.
