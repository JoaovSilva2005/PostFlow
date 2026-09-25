// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260925024139_transactional_workspace_and_content_quotas.sql',
  ),
  'utf8',
)

describe('migração transacional do workspace e das franquias', () => {
  it('restringe todas as RPCs ao service_role e fixa search_path', () => {
    const functions: Array<[string, string, 'invoker' | 'definer']> = [
      ['reserve_content_generation_usage', 'uuid, integer, integer', 'invoker'],
      ['release_expired_content_generation_reservations', 'uuid, date', 'invoker'],
      ['settle_content_generation_usage', 'uuid, boolean', 'invoker'],
      ['create_post_draft_with_hashtags', 'uuid, jsonb', 'invoker'],
      ['update_post_draft_with_hashtags', 'uuid, uuid, jsonb, text[]', 'invoker'],
      ['create_post_drafts_batch', 'uuid, jsonb', 'definer'],
      ['create_brand_with_owner', 'uuid, jsonb', 'invoker'],
      ['ensure_default_workspace', 'uuid, text, text, text, text', 'invoker'],
    ]

    for (const [name, argumentsList, security] of functions) {
      const start = migration.indexOf(
        `create or replace function public.${name}`,
      )
      const end = migration.indexOf('$$;', start) + 3
      const functionBody = migration.slice(start, end)
      const signature = `${name}(${argumentsList})`

      expect(start, `Função ausente: ${name}`).toBeGreaterThanOrEqual(0)
      expect(functionBody).toMatch(new RegExp(`security ${security}`, 'i'))
      expect(functionBody).toMatch(/set search_path = ''/i)
      expect(migration).toContain(
        `revoke all on function public.${signature}`,
      )
      expect(migration).toContain(
        `grant execute on function public.${signature}`,
      )
    }
    expect(migration).toContain('from public, anon, authenticated;')
    expect(migration).toContain('to service_role;')
  })

  it('serializa reservas por contador e inclui unidades em andamento no limite', () => {
    expect(migration).toMatch(/period_start = v_period_start\s+for update/i)
    expect(migration).toContain(
      'v_counter.text_used + v_counter.text_reserved + p_text_units > v_text_limit',
    )
    expect(migration).toContain(
      'v_counter.image_used + v_counter.image_reserved + p_image_units > v_image_limit',
    )
    expect(migration).toContain("reservation.expires_at <= now()")
    expect(migration).toContain("case when p_succeeded then 'consumed' else 'released' end")
  })

  it('mantém drafts/hashtags e marca/membership dentro da mesma função SQL', () => {
    expect(migration).toMatch(
      /function public\.create_post_draft_with_hashtags[\s\S]*?insert into public\.post_drafts[\s\S]*?insert into public\.post_hashtags[\s\S]*?\$\$;/i,
    )
    expect(migration).toMatch(
      /function public\.update_post_draft_with_hashtags[\s\S]*?update public\.post_drafts[\s\S]*?delete from public\.post_hashtags[\s\S]*?insert into public\.post_hashtags[\s\S]*?\$\$;/i,
    )
    expect(migration).toMatch(
      /function public\.create_brand_with_owner[\s\S]*?insert into public\.brands[\s\S]*?insert into public\.brand_members[\s\S]*?\$\$;/i,
    )
    expect(migration).toMatch(
      /function public\.create_post_drafts_batch[\s\S]*?insert into public\.post_drafts[\s\S]*?insert into public\.post_hashtags[\s\S]*?\$\$;/i,
    )
    expect(migration).toContain('pg_advisory_xact_lock')
  })
})
