// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { POST_STATUSES } from '../../../shared/domain/postPublishing.js'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20261029120000_post_publishing_scheduler.sql',
  ),
  'utf8',
)

describe('migração do agendador de publicação', () => {
  it('adiciona as colunas de publicação em post_drafts', () => {
    for (const column of [
      'published_at timestamptz',
      'publishing_started_at timestamptz',
      'publish_attempts integer not null default 0',
      'publish_error text',
      'publish_mode text',
      'external_post_id text',
      'external_post_url text',
      'approved_at timestamptz',
    ]) {
      expect(migration).toContain(`add column if not exists ${column}`)
    }
    expect(migration).toMatch(/publish_mode in \('demo', 'live'\)/)
    expect(migration).toMatch(/char_length\(publish_error\) <= 500/)
  })

  it('aceita os 5 status do domínio no check de status', () => {
    expect(migration).toContain(
      'drop constraint if exists post_drafts_status_check',
    )
    const check = migration.match(
      /add constraint post_drafts_status_check check \(\s*status in \(([^)]*)\)/,
    )
    expect(check).not.toBeNull()
    const statuses = [...check![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])
    expect(statuses).toEqual([...POST_STATUSES])
  })

  it('claim_due_post_drafts é atômica e respeita os prazos', () => {
    const start = migration.indexOf(
      'create or replace function public.claim_due_post_drafts',
    )
    const end = migration.indexOf('$$;', start) + 3
    const body = migration.slice(start, end)

    expect(start).toBeGreaterThanOrEqual(0)
    expect(body).toMatch(/\(p_limit integer, p_now timestamptz\)/)
    expect(body).toMatch(/returns setof public\.post_drafts/)
    expect(body).toMatch(/security invoker/i)
    expect(body).toMatch(/set search_path = ''/i)
    expect(body).toContain('for update skip locked')
    expect(body).toContain("interval '15 minutes'")
    expect(body).toContain("interval '2 hours'")
    expect(body).toContain('publish_attempts = post.publish_attempts + 1')
    expect(body).toContain(
      'Horário perdido: o post não foi publicado até 2 horas após o horário agendado.',
    )
  })

  it('restringe a RPC ao service_role', () => {
    expect(migration).toMatch(
      /revoke all on function public\.claim_due_post_drafts\(integer, timestamptz\)\s+from public, anon, authenticated/,
    )
    expect(migration).toMatch(
      /grant execute on function public\.claim_due_post_drafts\(integer, timestamptz\)\s+to service_role/,
    )
  })

  it('volta os agendados antigos para rascunho', () => {
    expect(migration).toMatch(
      /update public\.post_drafts\s+set status = 'draft'\s+where status = 'scheduled'/,
    )
  })

  it('update_post_draft_with_hashtags aplica approved_at, publish_error e publish_attempts', () => {
    const start = migration.indexOf(
      'create or replace function public.update_post_draft_with_hashtags',
    )
    const end = migration.indexOf('$$;', start) + 3
    const body = migration.slice(start, end)

    expect(start).toBeGreaterThanOrEqual(0)
    expect(body).toMatch(
      /\(\s*p_brand_id uuid,\s*p_post_id uuid,\s*p_patch jsonb,\s*p_hashtags text\[\] default null\s*\) returns jsonb/,
    )
    expect(body).toMatch(/security invoker/i)
    expect(body).toMatch(/set search_path = ''/i)
    expect(body).toContain("p_patch ? 'approved_at'")
    expect(body).toContain("p_patch ? 'publish_error'")
    expect(body).toContain("p_patch ? 'publish_attempts'")
    expect(migration).toMatch(
      /revoke all on function public\.update_post_draft_with_hashtags\(uuid, uuid, jsonb, text\[\]\)\s+from public, anon, authenticated/,
    )
    expect(migration).toMatch(
      /grant execute on function public\.update_post_draft_with_hashtags\(uuid, uuid, jsonb, text\[\]\)\s+to service_role/,
    )
  })
})
