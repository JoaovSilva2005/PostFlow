import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readSqlFile, schemaFile, seedFile } from './database-config.mjs'

function readTotal(database, table) {
  return database.prepare(`SELECT COUNT(*) AS total FROM ${table};`).get().total
}

function createTestDatabase() {
  const database = new DatabaseSync(':memory:')
  database.exec('PRAGMA foreign_keys = ON;')
  database.exec(readSqlFile(schemaFile))
  database.exec(readSqlFile(seedFile))
  return database
}

const database = createTestDatabase()

try {
  const tables = database
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name;`,
    )
    .all()
    .map(({ name }) => name)

  assert.deepEqual(tables, [
    'brands',
    'post_drafts',
    'post_hashtags',
    'social_platforms',
    'users',
  ])

  assert.deepEqual(
    {
      users: readTotal(database, 'users'),
      brands: readTotal(database, 'brands'),
      platforms: readTotal(database, 'social_platforms'),
      posts: readTotal(database, 'post_drafts'),
      hashtags: readTotal(database, 'post_hashtags'),
    },
    { users: 2, brands: 2, platforms: 3, posts: 3, hashtags: 7 },
  )

  const post = database
    .prepare(
      `SELECT
        users.email,
        brands.name AS brand,
        post_drafts.title,
        social_platforms.name AS platform
       FROM post_drafts
       JOIN brands ON brands.id = post_drafts.brand_id
       JOIN users ON users.id = brands.user_id
       JOIN social_platforms ON social_platforms.id = post_drafts.platform_id
       WHERE post_drafts.id = 1;`,
    )
    .get()

  assert.deepEqual(
    { ...post },
    {
      email: 'contato@cafeaurora.com',
      brand: 'Café Aurora',
      title: 'Sexta com café especial',
      platform: 'Instagram',
    },
  )
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check;').all(), [])

  database.prepare('DELETE FROM users WHERE id = 2;').run()
  assert.deepEqual(
    {
      brands: readTotal(database, 'brands'),
      posts: readTotal(database, 'post_drafts'),
      hashtags: readTotal(database, 'post_hashtags'),
    },
    { brands: 1, posts: 1, hashtags: 2 },
  )

  console.log('Testes do banco: 4 verificações aprovadas.')
} finally {
  database.close()
}
