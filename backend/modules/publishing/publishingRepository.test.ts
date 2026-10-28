import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkspaceAccessRepository } from '../tenancy/workspaceTypes.js'
import { SupabasePublishingRepository } from './publishingRepository.js'

function query(rows: unknown[], calls: string[], table: string) {
  const builder = {
    select: () => builder,
    in: () => builder,
    order: (column: string) => {
      calls.push(`${table}.order(${column})`)
      return builder
    },
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: rows, error: null }),
  }
  return builder
}

describe('SupabasePublishingRepository.claimDue', () => {
  it('mapeia o nome da plataforma e ordena as hashtags', async () => {
    const calls: string[] = []
    const supabase = {
      rpc: async () => ({
        data: [
          {
            id: 'p1',
            brand_id: 'b1',
            platform_id: 'uuid-ig',
            caption: 'Legenda',
            image_path: null,
            publish_attempts: 1,
          },
        ],
        error: null,
      }),
      from: (table: string) =>
        table === 'social_platforms'
          ? query([{ id: 'uuid-ig', name: 'Instagram' }], calls, table)
          : query(
              [
                { post_id: 'p1', hashtag: '#a' },
                { post_id: 'p1', hashtag: '#b' },
              ],
              calls,
              table,
            ),
    } as unknown as SupabaseClient
    const repository = new SupabasePublishingRepository(
      supabase,
      {} as WorkspaceAccessRepository,
    )

    const posts = await repository.claimDue(10, new Date('2026-10-28T12:00:00Z'))

    expect(posts).toEqual([
      {
        id: 'p1',
        brandId: 'b1',
        platform: 'Instagram',
        caption: 'Legenda',
        hashtags: ['#a', '#b'],
        imagePath: null,
        publishAttempts: 1,
      },
    ])
    expect(calls).toContain('post_hashtags.order(hashtag)')
  })
})

describe('SupabasePublishingRepository.isPublishingAllowed', () => {
  function build(platformRole: string | null) {
    const builder = {
      select: () => builder,
      eq: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: { user_id: 'owner-1' }, error: null }),
    }
    const supabase = { from: () => builder } as unknown as SupabaseClient
    const roleLookups: string[] = []
    const access = {
      getBillingStatus: async () => 'canceled',
      getActiveBillingWorkspaceId: async () => null,
      getPlatformRole: async (userId: string) => {
        roleLookups.push(userId)
        return platformRole
      },
    } as unknown as WorkspaceAccessRepository
    return {
      repository: new SupabasePublishingRepository(supabase, access),
      roleLookups,
    }
  }

  it('libera dono platform_owner sem assinatura (mesmo bypass das rotas)', async () => {
    const { repository, roleLookups } = build('platform_owner')
    await expect(repository.isPublishingAllowed('b1')).resolves.toBe(true)
    expect(roleLookups).toEqual(['owner-1'])
  })

  it('bloqueia dono comum sem assinatura', async () => {
    const { repository } = build(null)
    await expect(repository.isPublishingAllowed('b1')).resolves.toBe(false)
  })
})
