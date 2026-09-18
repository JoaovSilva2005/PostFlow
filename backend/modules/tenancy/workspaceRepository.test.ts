// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { SupabaseWorkspaceAccessRepository } from './workspaceRepository.js'

describe('SupabaseWorkspaceAccessRepository', () => {
  it('usa nome e segmento do cadastro ao criar o workspace inicial', async () => {
    const writes = new Map<string, Array<Record<string, unknown>>>()

    const client = {
      from(table: string) {
        const chain = {
          select() {
            return chain
          },
          eq() {
            return chain
          },
          order() {
            return chain
          },
          limit() {
            return chain
          },
          async maybeSingle() {
            return { data: null, error: null }
          },
          async upsert(value: Record<string, unknown>) {
            writes.set(table, [...(writes.get(table) ?? []), value])
            return { error: null }
          },
          insert(value: Record<string, unknown>) {
            writes.set(table, [...(writes.get(table) ?? []), value])
            return chain
          },
          async single() {
            return { data: { id: 'brand-1' }, error: null }
          },
        }
        return chain
      },
    } as unknown as SupabaseClient

    const repository = new SupabaseWorkspaceAccessRepository(client)
    const membership = await repository.ensureDefaultWorkspace({
      id: 'user-1',
      email: 'maria@postflow.com',
      displayName: 'Maria Silva',
      brandName: 'Studio Maria',
      segment: 'Serviços profissionais',
    })

    expect(writes.get('users')?.[0]).toMatchObject({
      id: 'user-1',
      display_name: 'Maria Silva',
    })
    expect(writes.get('profiles')?.[0]).toMatchObject({
      id: 'user-1',
      display_name: 'Maria Silva',
    })
    expect(writes.get('brands')?.[0]).toMatchObject({
      user_id: 'user-1',
      name: 'Studio Maria',
      segment: 'Serviços profissionais',
    })
    expect(writes.get('brand_members')?.[0]).toEqual({
      brand_id: 'brand-1',
      user_id: 'user-1',
      role: 'owner',
    })
    expect(membership).toEqual({
      workspaceId: 'brand-1',
      userId: 'user-1',
      role: 'owner',
    })
  })
})
