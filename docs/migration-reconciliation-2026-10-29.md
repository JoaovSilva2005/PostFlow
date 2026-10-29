# Reconciliação de migrações — 29/10/2026

Projeto consultado por leitura: `evijkmzbdbtnukigukxt`. Nenhum SQL foi reaplicado,
nenhum registro foi apagado e nenhum timestamp foi renomeado nesta revisão.

O manifesto `scripts/database/remote-history-2026-10-29.json` relaciona 19 SQLs
locais às versões registradas no remoto, com SHA-256 de ambos. Quinze são iguais
depois de normalizar CRLF/LF e espaços nas extremidades. Os quatro restantes
(`allow_multiple_brands`, `security_minimum_api_table_privileges`,
`account_billing_and_brand_limit`, `ai_usage_cost_accounting`) foram comparados
e diferem somente em comentários, espaços e envelopes `BEGIN/COMMIT`.
Isso confirma a equivalência do SQL registrado; não substitui uma inspeção atual
dos objetos para descobrir alterações feitas depois dessas migrações.

A operação remota `20261029010803_enable_social_publishing_scheduler_extensions`
habilitou infraestrutura de cron. O procedimento está em
`database/operations/social-publishing-cron.sql`, fora da linhagem de schema.
Três arquivos locais não possuem entrada remota separada: módulo financeiro e
grants de serviço financeiro/social. A ausência de entrada não prova ausência de
objetos ou grants: inspecione-os antes de qualquer aplicação. A consulta adicional
para comprovar esses grants não pôde ser executada por limite da revisão automática.

## Base existente

1. Obtenha backup/snapshot recuperável e registre sua identificação.
2. Exporte `version`, `name`, `statements` de
   `supabase_migrations.schema_migrations` por acesso administrativo autorizado.
3. Compare o SQL completo com os caminhos do manifesto e inspecione tabelas,
   constraints, funções (`pg_get_functiondef`), grants e cron envolvidos.
4. Não rode `supabase db push` indiscriminadamente: ele verá timestamps locais
   diferentes como migrações pendentes, mesmo quando o SQL já foi aplicado.
5. Teste a reconciliação em clone/homologação. Só faça `migration repair` após
   decidir e revisar uma correspondência exata; esta entrega não executa repair.
6. Se houver diferença funcional real, crie migração incremental pelo CLI e
   valide backup/restauração antes de produção. Nunca altere o SQL histórico.

## Instalação vazia

Siga `database/README.md`: schema baseline, `database/migrations` e depois
`supabase/migrations`. Use projeto descartável e não execute seed acadêmico no
caminho SaaS. O cron é configuração operacional posterior, com Vault e segredos
no servidor. O arquivo de inventário local e o snapshot remoto são verificações
estáticas; nenhum deles aplica migrações nem comprova instalação em Postgres real.

## Verificação

`npm run db:migrations:check` verifica nomes, referências e inventário, e também
a integridade do snapshot. Não requer segredos nem conexão. Os workflows de CI
executam tipos, lint, testes (incluindo schema/inventário) e build com chaves fictícias.
