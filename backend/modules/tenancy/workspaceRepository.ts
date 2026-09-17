import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PlatformRole,
  WorkspaceAccessRepository,
  WorkspaceMembership,
  WorkspaceRole,
} from './workspaceTypes.js'

export class SupabaseWorkspaceAccessRepository implements WorkspaceAccessRepository {
  private readonly supabase: SupabaseClient
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async getMembership(userId: string, workspaceId: string) {
    const { data, error } = await this.supabase
      .from('brand_members')
      .select('brand_id, user_id, role')
      .eq('brand_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(`Falha ao consultar workspace: ${error.message}`)
    if (!data) return null
    return {
      workspaceId: data.brand_id,
      userId: data.user_id,
      role: data.role as WorkspaceRole,
    } satisfies WorkspaceMembership
  }

  async getDefaultWorkspace(userId: string) {
    const { data, error } = await this.supabase
      .from('brand_members')
      .select('brand_id, user_id, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`Falha ao consultar workspace: ${error.message}`)
    return data
      ? {
          workspaceId: data.brand_id,
          userId: data.user_id,
          role: data.role as WorkspaceRole,
        }
      : null
  }

  async getPlatformRole(userId: string) {
    const { data, error } = await this.supabase
      .from('platform_members')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
    if (error)
      throw new Error(
        `Falha ao consultar papel de plataforma: ${error.message}`,
      )
    return (data?.role as PlatformRole | undefined) ?? null
  }
}

/** Apenas para dependências injetadas em testes; não é usado em produção. */
export class InMemoryWorkspaceAccessRepository implements WorkspaceAccessRepository {
  private readonly workspaceId: string
  private readonly workspaceRole: WorkspaceRole
  private readonly platformRole: PlatformRole | null
  constructor(
    workspaceId = 'test-workspace',
    workspaceRole: WorkspaceRole = 'editor',
    platformRole: PlatformRole | null = null,
  ) {
    this.workspaceId = workspaceId
    this.workspaceRole = workspaceRole
    this.platformRole = platformRole
  }

  async getMembership(userId: string, workspaceId: string) {
    return workspaceId === this.workspaceId
      ? { workspaceId, userId, role: this.workspaceRole }
      : null
  }

  async getDefaultWorkspace(userId: string) {
    return { workspaceId: this.workspaceId, userId, role: this.workspaceRole }
  }

  async getPlatformRole() {
    return this.platformRole
  }
}
