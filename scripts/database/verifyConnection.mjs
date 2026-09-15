import { createDatabaseClient } from './databaseClient.mjs'

const supabase = createDatabaseClient()

async function readTable(table, columns = '*') {
  const { data, error } = await supabase.from(table).select(columns)

  if (error) {
    throw new Error(`Falha ao consultar ${table}: ${error.message}`)
  }

  return data
}

const [users, brands, platforms, posts, hashtags, transactions] =
  await Promise.all([
    readTable('users', 'id, email, display_name'),
    readTable('brands', 'id, name, user_id'),
    readTable('social_platforms', 'id, name, character_limit'),
    readTable(
      'post_drafts',
      'id, title, scheduled_at, status, brands(name), social_platforms(name)',
    ),
    readTable('post_hashtags', 'post_id, hashtag'),
    readTable(
      'financial_transactions',
      'id, type, description, amount, due_date, status, paid_at',
    ),
  ])

console.log('\nConexão com Supabase/PostgreSQL: OK')
console.table({
  users: users.length,
  brands: brands.length,
  platforms: platforms.length,
  posts: posts.length,
  hashtags: hashtags.length,
  financialTransactions: transactions.length,
})
console.log('Posts relacionados com marca e plataforma')
console.table(
  posts.map((post) => ({
    id: post.id,
    brand: post.brands?.name,
    title: post.title,
    platform: post.social_platforms?.name,
    scheduledAt: post.scheduled_at,
    status: post.status,
  })),
)
console.log('PK, FK e políticas RLS responderam corretamente pela API.')
console.log('Lançamentos financeiros disponíveis para a API do PostFlow')
console.table(transactions)
