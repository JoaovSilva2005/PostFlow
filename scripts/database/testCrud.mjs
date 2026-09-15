import assert from 'node:assert/strict'
import { createDatabaseClient } from './databaseClient.mjs'

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'
const supabase = createDatabaseClient()
let createdPostId = null

async function requireSingle(query, operation) {
  const { data, error } = await query

  if (error) {
    throw new Error(`${operation}: ${error.message}`)
  }

  return data
}

try {
  const brand = await requireSingle(
    supabase.from('brands').select('id').eq('user_id', DEMO_USER_ID).single(),
    'Leitura da marca',
  )
  const platform = await requireSingle(
    supabase
      .from('social_platforms')
      .select('id')
      .eq('name', 'Instagram')
      .single(),
    'Leitura da plataforma',
  )

  const createdPost = await requireSingle(
    supabase
      .from('post_drafts')
      .insert({
        brand_id: brand.id,
        platform_id: platform.id,
        title: 'Teste automatizado de CRUD',
        caption: 'Registro temporário criado pelo teste do PostFlow.',
        visual_text: 'CRUD conectado',
        color: '#4F46E5',
        scheduled_at: '2026-08-28T20:00:00Z',
        status: 'draft',
      })
      .select('id, title, status')
      .single(),
    'CREATE',
  )
  createdPostId = createdPost.id
  assert.equal(createdPost.title, 'Teste automatizado de CRUD')

  const { error: hashtagError } = await supabase
    .from('post_hashtags')
    .insert({ post_id: createdPostId, hashtag: '#TesteCRUD' })
  assert.equal(hashtagError, null)

  const readPost = await requireSingle(
    supabase
      .from('post_drafts')
      .select('id, title, post_hashtags(hashtag)')
      .eq('id', createdPostId)
      .single(),
    'READ',
  )
  assert.equal(readPost.post_hashtags[0].hashtag, '#TesteCRUD')

  const updatedPost = await requireSingle(
    supabase
      .from('post_drafts')
      .update({ status: 'scheduled' })
      .eq('id', createdPostId)
      .select('status')
      .single(),
    'UPDATE',
  )
  assert.equal(updatedPost.status, 'scheduled')

  const { error: deleteError } = await supabase
    .from('post_drafts')
    .delete()
    .eq('id', createdPostId)
  assert.equal(deleteError, null)

  const { data: deletedHashtags, error: cascadeError } = await supabase
    .from('post_hashtags')
    .select('post_id')
    .eq('post_id', createdPostId)
  assert.equal(cascadeError, null)
  assert.equal(deletedHashtags.length, 0)
  createdPostId = null

  console.log('CRUD conectado: CREATE, READ, UPDATE e DELETE aprovados.')
  console.log('Integridade referencial: exclusão em cascata aprovada.')
} finally {
  if (createdPostId) {
    await supabase.from('post_drafts').delete().eq('id', createdPostId)
  }
}
