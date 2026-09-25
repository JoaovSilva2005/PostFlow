// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseWorkspaceAccessRepository } from './workspaceRepository.js'

describe('SupabaseWorkspaceAccessRepository', () => {
  it('provisiona em uma RPC transacional usando o nome e segmento cadastrados', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { workspace_id: 'brand-1', user_id: 'user-1', role: 'owner' },
      error: null,
    })
    const client = { rpc } as unknown as SupabaseClient

    const repository = new SupabaseWorkspaceAccessRepository(client)
    const membership = await repository.ensureDefaultWorkspace({
      id: 'user-1',
      email: 'maria@postflow.com',
      displayName: 'Maria Silva',
      brandName: 'Studio Maria',
      segment: 'Serviços profissionais',
    })

    expect(rpc).toHaveBeenCalledWith('ensure_default_workspace', {
      p_user_id: 'user-1',
      p_email: 'maria@postflow.com',
      p_display_name: 'Maria Silva',
      p_brand_name: 'Studio Maria',
      p_segment: 'Serviços profissionais',
    })
    expect(membership).toEqual({
      workspaceId: 'brand-1',
      userId: 'user-1',
      role: 'owner',
    })
  })

  it('retorna o mesmo workspace para chamadas concorrentes do mesmo usuário', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { workspace_id: 'brand-1', user_id: 'user-1', role: 'owner' },
      error: null,
    })
    const repository = new SupabaseWorkspaceAccessRepository(
      { rpc } as unknown as SupabaseClient,
    )
    const user = {
      id: 'user-1',
      email: 'maria@postflow.com',
      displayName: 'Maria Silva',
      brandName: 'Studio Maria',
      segment: 'Serviços profissionais',
    }

    const results = await Promise.all(
      Array.from({ length: 8 }, () => repository.ensureDefaultWorkspace(user)),
    )

    expect(results.map((result) => result.workspaceId)).toEqual(
      Array(8).fill('brand-1'),
    )
    expect(rpc).toHaveBeenCalledTimes(8)
    expect(rpc).toHaveBeenCalledWith(
      'ensure_default_workspace',
      expect.objectContaining({ p_user_id: 'user-1' }),
    )
  })
})
