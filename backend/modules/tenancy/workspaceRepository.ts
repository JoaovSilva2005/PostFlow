import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PlatformRole,
  BillingAccessStatus,
  WorkspaceAccessRepository,
  WorkspaceMembership,
  WorkspaceIdentity,
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

  async ensureDefaultWorkspace(user: WorkspaceIdentity) {
    const existing = await this.getDefaultWorkspace(user.id)
    if (existing) return existing

    const displayName =
      user.displayName.trim() || user.email.split('@')[0] || 'Usuário PostFlow'

    const { error: legacyUserError } = await this.supabase.from('users').upsert(
      {
        id: user.id,
        email: user.email,
        display_name: displayName,
      },
      { onConflict: 'id' },
    )
    if (legacyUserError) {
      throw new Error(`Falha ao preparar usuário: ${legacyUserError.message}`)
    }

    const { error: profileError } = await this.supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: displayName }, { onConflict: 'id' })
    if (profileError) {
      throw new Error(`Falha ao preparar perfil: ${profileError.message}`)
    }

    const { data: currentBrand, error: currentBrandError } = await this.supabase
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (currentBrandError) {
      throw new Error(
        `Falha ao consultar marca inicial: ${currentBrandError.message}`,
      )
    }

    let brandId = currentBrand?.id as string | undefined
    if (!brandId) {
      const workspaceName = `Workspace de ${displayName}`.slice(0, 120)
      const { data: createdBrand, error: createBrandError } =
        await this.supabase
          .from('brands')
          .insert({
            user_id: user.id,
            name: workspaceName,
            segment: 'A definir',
            tone_of_voice: 'Profissional e próximo',
            primary_color: '#4F46E5',
          })
          .select('id')
          .single()
      if (createBrandError || !createdBrand) {
        throw new Error(
          `Falha ao criar workspace: ${createBrandError?.message ?? 'marca não retornada'}`,
        )
      }
      brandId = createdBrand.id
    }

    if (!brandId) {
      throw new Error('Falha ao preparar o identificador do workspace.')
    }

    const membership: WorkspaceMembership = {
      workspaceId: brandId,
      userId: user.id,
      role: 'owner',
    }
    const { error: membershipError } = await this.supabase
      .from('brand_members')
      .upsert(
        {
          brand_id: membership.workspaceId,
          user_id: membership.userId,
          role: membership.role,
        },
        { onConflict: 'brand_id,user_id' },
      )
    if (membershipError) {
      throw new Error(`Falha ao vincular workspace: ${membershipError.message}`)
    }

    return membership
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

  async getBillingStatus(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('status')
      .eq('brand_id', workspaceId)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error)
      throw new Error(`Falha ao consultar assinatura: ${error.message}`)
    return (data?.status as BillingAccessStatus | undefined) ?? 'none'
  }
}

/** Apenas para dependências injetadas em testes; não é usado em produção. */
export class InMemoryWorkspaceAccessRepository implements WorkspaceAccessRepository {
  private workspaceId: string | null
  private readonly workspaceRole: WorkspaceRole
  private readonly platformRole: PlatformRole | null
  private readonly billingStatus: BillingAccessStatus
  constructor(
    workspaceId: string | null = 'test-workspace',
    workspaceRole: WorkspaceRole = 'editor',
    platformRole: PlatformRole | null = null,
    billingStatus: BillingAccessStatus = 'active',
  ) {
    this.workspaceId = workspaceId
    this.workspaceRole = workspaceRole
    this.platformRole = platformRole
    this.billingStatus = billingStatus
  }

  async getMembership(userId: string, workspaceId: string) {
    return workspaceId === this.workspaceId
      ? { workspaceId, userId, role: this.workspaceRole }
      : null
  }

  async getDefaultWorkspace(userId: string) {
    return this.workspaceId
      ? { workspaceId: this.workspaceId, userId, role: this.workspaceRole }
      : null
  }

  async ensureDefaultWorkspace(user: WorkspaceIdentity) {
    this.workspaceId ??= `workspace-${user.id}`
    return {
      workspaceId: this.workspaceId,
      userId: user.id,
      role: this.workspaceRole,
    }
  }

  async getPlatformRole() {
    return this.platformRole
  }

  async getBillingStatus() {
    return this.billingStatus
  }
}
