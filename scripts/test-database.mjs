import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const schema = readFileSync('database/schema.sql', 'utf8')
const seed = readFileSync('database/seed.sql', 'utf8')

const expectedTables = [
  'users',
  'brands',
  'social_platforms',
  'post_drafts',
  'post_hashtags',
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
assert.match(schema, /enable row level security/g)
assert.match(seed, /insert into public\.users/)
assert.match(seed, /insert into public\.post_drafts/)
assert.match(seed, /insert into public\.post_hashtags/)

console.log('Contrato PostgreSQL: estrutura, PK, FK, RLS e seed validados.')
