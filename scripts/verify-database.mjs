import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { databaseFile } from './database-config.mjs'

if (!existsSync(databaseFile)) {
  throw new Error('Banco não encontrado. Execute npm run db:setup primeiro.')
}

const database = new DatabaseSync(databaseFile, { readOnly: true })

try {
  database.exec('PRAGMA foreign_keys = ON;')

  const tables = database
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name;`,
    )
    .all()

  const counts = database
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM brands) AS brands,
        (SELECT COUNT(*) FROM social_platforms) AS platforms,
        (SELECT COUNT(*) FROM post_drafts) AS posts,
        (SELECT COUNT(*) FROM post_hashtags) AS hashtags;`,
    )
    .get()

  const scheduledPosts = database
    .prepare(
      `SELECT
        post_drafts.id,
        brands.name AS brand,
        post_drafts.title,
        social_platforms.name AS platform,
        post_drafts.scheduled_at,
        post_drafts.status
       FROM post_drafts
       JOIN brands ON brands.id = post_drafts.brand_id
       JOIN social_platforms ON social_platforms.id = post_drafts.platform_id
       ORDER BY post_drafts.scheduled_at;`,
    )
    .all()

  const foreignKeyViolations = database
    .prepare('PRAGMA foreign_key_check;')
    .all()

  if (foreignKeyViolations.length > 0) {
    throw new Error('Foram encontradas violações de chave estrangeira.')
  }

  console.log('\nTabelas criadas')
  console.table(tables)
  console.log('Registros da carga inicial')
  console.table(counts)
  console.log('Posts relacionados com marca e plataforma')
  console.table(scheduledPosts)
  console.log('Integridade referencial: OK')
} finally {
  database.close()
}
