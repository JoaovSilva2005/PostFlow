import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const schema = readFileSync('database/schema.sql', 'utf8')
const seed = readFileSync('database/seed.sql', 'utf8')
const contentPlannerMigration = readFileSync(
  'supabase/migrations/20260923210143_postflow_batched_content_planner.sql',
  'utf8',
)

const expectedTables = [
  'users',
  'brands',
  'social_platforms',
  'post_drafts',
  'post_hashtags',
  'financial_transactions',
]

for (const table of expectedTables) {
  assert.match(
    schema,
    new RegExp(`create table if not exists public\\.${table}`),
  )
}

assert.match(schema, /primary key/g)
assert.match(schema, /foreign key \(user_id\)/)
assert.match(schema, /foreign key \(brand_id\)/)
assert.match(schema, /foreign key \(platform_id\)/)
assert.match(schema, /foreign key \(post_id\)/)
assert.match(schema, /financial_transactions_brand_id_fkey/)
assert.match(schema, /type in \('income', 'expense'\)/)
assert.match(schema, /status in \('pending', 'paid'\)/)
assert.match(schema, /financial_transactions_amount_check check \(amount > 0\)/)
assert.match(schema, /enable row level security/g)
assert.match(
  schema,
  /revoke all on table public\.financial_transactions from anon, authenticated/,
)
assert.doesNotMatch(
  schema,
  /grant[\s\S]{0,80}on table public\.financial_transactions to anon, authenticated/,
)
assert.match(
  schema,
  /grant select, insert, update, delete\s+on table public\.financial_transactions to service_role/,
)
assert.match(seed, /insert into public\.users/)
assert.match(seed, /insert into public\.post_drafts/)
assert.match(seed, /insert into public\.post_hashtags/)
assert.match(seed, /insert into public\.financial_transactions/)
assert.match(schema, /content_format text not null default 'static'/)
assert.match(schema, /audience_persona text not null default ''/)
assert.match(
  schema,
  /schedule_timezone text not null default 'America\/Sao_Paulo'/,
)
assert.match(schema, /format_data jsonb/)
assert.match(
  schema,
  /color_palette jsonb not null default '\["#4F46E5"\]'::jsonb/,
)
assert.match(schema, /brands_color_palette_check check/)
for (const column of [
  'description',
  'target_audience',
  'products_or_services',
  'differentials',
  'content_goals',
  'keywords',
  'avoid_topics',
  'default_cta',
]) {
  assert.match(schema, new RegExp(`${column} text not null default ''`))
}
assert.match(
  contentPlannerMigration,
  /create or replace function public\.create_post_drafts_batch/,
)
assert.match(contentPlannerMigration, /jsonb_array_length\(p_drafts\) > 42/)
assert.match(contentPlannerMigration, /security definer/)
assert.match(
  contentPlannerMigration,
  /revoke all on function public\.create_post_drafts_batch\(uuid, jsonb\)\s+from public, anon, authenticated/,
)
assert.match(
  contentPlannerMigration,
  /grant execute on function public\.create_post_drafts_batch\(uuid, jsonb\)\s+to service_role/,
)

console.log(
  'Contrato PostgreSQL: estrutura, PK, FK, RLS, seed e lote de conteúdo validados.',
)
