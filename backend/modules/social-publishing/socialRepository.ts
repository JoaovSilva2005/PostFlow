import type { SupabaseClient } from '@supabase/supabase-js'
import { HttpError } from '../../shared/HttpError.js'
import type {
  ConnectionRecord,
  OAuthSessionRecord,
  PublicationRecord,
  SocialRepository,
} from './socialTypes.js'

function connection(row: any): ConnectionRecord {
  return {
    id: row.id,
    workspaceId: row.brand_id,
    userId: row.user_id,
    provider: row.provider,
    externalAccountId: row.external_account_id,
    displayName: row.display_name,
    accountType: row.account_type,
    encryptedTokens: row.encrypted_tokens,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}
function session(row: any): OAuthSessionRecord {
  return {
    id: row.id,
    workspaceId: row.brand_id,
    userId: row.user_id,
    provider: row.provider,
    stateHash: row.state_hash,
    encryptedVerifier: row.encrypted_verifier,
    encryptedAccounts: row.encrypted_accounts,
    redirectUri: row.redirect_uri,
    expiresAt: row.expires_at,
    status: row.status,
  }
}
function publication(row: any): PublicationRecord {
  return {
    id: row.id,
    workspaceId: row.brand_id,
    userId: row.user_id,
    draftId: row.draft_id,
    connectionId: row.connection_id,
    provider: row.provider,
    title: row.title,
    snapshot: row.snapshot,
    status: row.status,
    scheduledAt: row.scheduled_at,
    nextAttemptAt: row.next_attempt_at,
    operation: row.operation,
    remotePostId: row.remote_post_id,
    remoteUrl: row.remote_url,
    error: row.error,
    attempts: row.attempts,
    leaseToken: row.lease_token,
    leaseExpiresAt: row.lease_expires_at,
    createdAt: row.created_at,
  }
}
function check(error: unknown) {
  if (error)
    throw new HttpError(
      503,
      'Não foi possível acessar as integrações sociais. Tente novamente.',
    )
}
export class SupabaseSocialRepository implements SocialRepository {
  private db: SupabaseClient
  constructor(db: SupabaseClient) {
    this.db = db
  }
  async listConnections(workspaceId: string) {
    const { data, error } = await this.db
      .from('social_connections')
      .select('*')
      .eq('brand_id', workspaceId)
      .order('created_at')
    check(error)
    return (data ?? []).map(connection)
  }
  async getConnection(workspaceId: string, id: string) {
    const { data, error } = await this.db
      .from('social_connections')
      .select('*')
      .eq('brand_id', workspaceId)
      .eq('id', id)
      .maybeSingle()
    check(error)
    return data ? connection(data) : null
  }
  async saveConnection(record: ConnectionRecord) {
    const existing = (await this.listConnections(record.workspaceId)).find(
      (c) =>
        c.provider === record.provider &&
        c.externalAccountId === record.externalAccountId,
    )
    const { data, error } = await this.db
      .from('social_connections')
      .upsert(
        {
          id: existing?.id ?? record.id,
          brand_id: record.workspaceId,
          user_id: record.userId,
          provider: record.provider,
          external_account_id: record.externalAccountId,
          display_name: record.displayName,
          account_type: record.accountType,
          encrypted_tokens: record.encryptedTokens,
          status: record.status,
          expires_at: record.expiresAt,
          created_at: existing?.createdAt ?? record.createdAt,
        },
        { onConflict: 'brand_id,provider,external_account_id' },
      )
      .select('*')
      .single()
    check(error)
    const saved = connection(data)
    const { error: resumeError } = await this.db
      .from('social_publications')
      .update({
        status: 'retry_wait',
        next_attempt_at: new Date().toISOString(),
        error: null,
      })
      .eq('brand_id', record.workspaceId)
      .eq('connection_id', saved.id)
      .eq('status', 'needs_reconnect')
      .is('lease_token', null)
    check(resumeError)
    return saved
  }
  async updateConnection(
    workspaceId: string,
    id: string,
    patch: Partial<ConnectionRecord>,
  ) {
    const values: Record<string, unknown> = {}
    if (patch.status !== undefined) values.status = patch.status
    if (patch.encryptedTokens !== undefined)
      values.encrypted_tokens = patch.encryptedTokens
    if (patch.expiresAt !== undefined) values.expires_at = patch.expiresAt
    const { error } = await this.db
      .from('social_connections')
      .update(values)
      .eq('brand_id', workspaceId)
      .eq('id', id)
    check(error)
  }
  async disconnect(workspaceId: string, id: string) {
    const { error } = await this.db.rpc('disconnect_social_connection', {
      p_brand: workspaceId,
      p_connection: id,
    })
    check(error)
  }
  async claimRefresh(workspaceId: string, id: string) {
    const { data, error } = await this.db.rpc('claim_social_refresh', {
      p_brand: workspaceId,
      p_connection: id,
    })
    check(error)
    return typeof data === 'string' ? data : null
  }
  async finishRefresh(
    workspaceId: string,
    id: string,
    lease: string,
    patch: { encryptedTokens: string; expiresAt: string | null } | null,
  ) {
    const { data, error } = await this.db
      .from('social_connections')
      .update({
        refresh_lease_token: null,
        refresh_lease_expires_at: null,
        ...(patch
          ? {
              encrypted_tokens: patch.encryptedTokens,
              expires_at: patch.expiresAt,
            }
          : {}),
      })
      .eq('brand_id', workspaceId)
      .eq('id', id)
      .eq('refresh_lease_token', lease)
      .eq('status', 'connected')
      .gt('refresh_lease_expires_at', new Date().toISOString())
      .select('id')
      .maybeSingle()
    check(error)
    return Boolean(data)
  }
  async createOAuthSession(record: OAuthSessionRecord) {
    const { error } = await this.db
      .from('social_oauth_sessions')
      .insert({
        id: record.id,
        brand_id: record.workspaceId,
        user_id: record.userId,
        provider: record.provider,
        state_hash: record.stateHash,
        encrypted_verifier: record.encryptedVerifier,
        encrypted_accounts: null,
        redirect_uri: record.redirectUri,
        expires_at: record.expiresAt,
        status: record.status,
      })
    check(error)
  }
  async consumeOAuthSession(
    stateHash: string,
    userId: string,
    provider: OAuthSessionRecord['provider'],
  ) {
    const { data, error } = await this.db.rpc('consume_social_oauth', {
      p_hash: stateHash,
      p_user: userId,
      p_provider: provider,
    })
    check(error)
    return data?.[0] ? session(data[0]) : null
  }
  async completeOAuthSession(id: string, encryptedAccounts: string | null) {
    const { error } = await this.db
      .from('social_oauth_sessions')
      .update({
        status: encryptedAccounts ? 'ready' : 'failed',
        encrypted_accounts: encryptedAccounts,
      })
      .eq('id', id)
      .eq('status', 'exchanging')
    check(error)
  }
  async getReadySession(workspaceId: string, userId: string, id: string) {
    const { data, error } = await this.db
      .from('social_oauth_sessions')
      .select('*')
      .eq('id', id)
      .eq('brand_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'ready')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    check(error)
    return data ? session(data) : null
  }
  async listReadySessions(workspaceId: string, userId: string) {
    const { error: cleanupError } = await this.db
      .from('social_oauth_sessions')
      .delete()
      .eq('brand_id', workspaceId)
      .eq('user_id', userId)
      .lt('expires_at', new Date().toISOString())
    check(cleanupError)
    const { data, error } = await this.db
      .from('social_oauth_sessions')
      .select('*')
      .eq('brand_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'ready')
      .gt('expires_at', new Date().toISOString())
      .limit(10)
    check(error)
    return (data ?? []).map(session)
  }
  async countOAuthSessions(workspaceId: string, userId: string) {
    const { count, error } = await this.db
      .from('social_oauth_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', workspaceId)
      .eq('user_id', userId)
      .in('status', ['pending', 'exchanging', 'ready'])
      .gt('expires_at', new Date().toISOString())
    check(error)
    return count ?? 0
  }
  async getDraft(workspaceId: string, id: string) {
    const { data, error } = await this.db
      .from('post_drafts')
      .select('*,social_platforms(name),post_hashtags(hashtag)')
      .eq('brand_id', workspaceId)
      .eq('id', id)
      .maybeSingle()
    check(error)
    return data
      ? {
          id: data.id,
          workspaceId: data.brand_id,
          provider: data.social_platforms?.name ?? '',
          title: data.title,
          caption: data.caption,
          hashtags: (data.post_hashtags ?? []).map((t: any) => t.hashtag),
          format: data.content_format ?? 'static',
          imagePath: data.image_path,
          timezone: data.schedule_timezone ?? 'America/Sao_Paulo',
        }
      : null
  }
  async listPublications(workspaceId: string) {
    const { data, error } = await this.db
      .from('social_publications')
      .select('*')
      .eq('brand_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)
    check(error)
    return (data ?? []).map(publication)
  }
  async getPublication(id: string) {
    const { data, error } = await this.db
      .from('social_publications')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    check(error)
    return data ? publication(data) : null
  }
  async enqueue(record: PublicationRecord) {
    const { data, error } = await this.db
      .from('social_publications')
      .insert({
        id: record.id,
        brand_id: record.workspaceId,
        user_id: record.userId,
        draft_id: record.draftId,
        connection_id: record.connectionId,
        provider: record.provider,
        title: record.title,
        snapshot: record.snapshot,
        status: record.status,
        scheduled_at: record.scheduledAt,
        next_attempt_at: record.nextAttemptAt,
        created_at: record.createdAt,
      })
      .select('*')
      .single()
    if (error?.code === '23505') {
      const existing = (await this.listPublications(record.workspaceId)).find(
        (p) =>
          p.draftId === record.draftId &&
          p.connectionId === record.connectionId &&
          !['failed', 'cancelled'].includes(p.status),
      )
      if (existing?.snapshot.approvalHash === record.snapshot.approvalHash)
        return existing
      if (existing)
        throw new HttpError(
          409,
          'Já existe uma versão diferente deste post para esta conta. Confira ou cancele o agendamento anterior.',
        )
    }
    check(error)
    return publication(data)
  }
  async cancel(workspaceId: string, id: string) {
    const { data, error } = await this.db
      .from('social_publications')
      .update({ status: 'cancelled', error: null })
      .eq('brand_id', workspaceId)
      .eq('id', id)
      .in('status', [
        'queued',
        'retry_wait',
        'processing',
        'preparing',
        'needs_reconnect',
      ])
      .is('lease_token', null)
      .or(
        'operation.is.null,operation->>_dispatched.is.null,operation->>_dispatched.eq.false',
      )
      .select('*')
      .maybeSingle()
    check(error)
    return data ? publication(data) : null
  }
  async claimDue(limit: number) {
    const { data, error } = await this.db.rpc('claim_social_publications', {
      p_limit: limit,
    })
    check(error)
    return (data ?? []).map(publication)
  }
  async updateClaim(
    id: string,
    leaseToken: string,
    patch: Partial<PublicationRecord>,
  ) {
    const values: Record<string, unknown> = {
      lease_expires_at: new Date(Date.now() + 120_000).toISOString(),
    }
    const columns = {
      status: 'status',
      operation: 'operation',
      remotePostId: 'remote_post_id',
      remoteUrl: 'remote_url',
      error: 'error',
      nextAttemptAt: 'next_attempt_at',
    } as const
    for (const [key, column] of Object.entries(columns))
      if (patch[key as keyof PublicationRecord] !== undefined)
        values[column] = patch[key as keyof PublicationRecord]
    const { data, error } = await this.db
      .from('social_publications')
      .update(values)
      .eq('id', id)
      .eq('lease_token', leaseToken)
      .gt('lease_expires_at', new Date().toISOString())
      .select('id')
      .maybeSingle()
    check(error)
    return Boolean(data)
  }
  async releaseClaim(id: string, leaseToken: string) {
    const { error } = await this.db
      .from('social_publications')
      .update({ lease_token: null, lease_expires_at: null })
      .eq('id', id)
      .eq('lease_token', leaseToken)
    check(error)
  }
  private imageLocation(path: string) {
    const prefix = 'social-publication-images/'
    return path.startsWith(prefix)
      ? { bucket: 'social-publication-images', path: path.slice(prefix.length) }
      : { bucket: 'post-draft-images', path }
  }
  async loadImage(path: string) {
    const file = this.imageLocation(path)
    const { data, error } = await this.db.storage
      .from(file.bucket)
      .download(file.path)
    check(error)
    if (!data || data.size > 5 * 1024 * 1024)
      throw new HttpError(400, 'Imagem ausente ou maior que 5 MiB.')
    return new Uint8Array(await data.arrayBuffer())
  }
  async saveImage(workspaceId: string, jobId: string, bytes: Uint8Array) {
    const path = `${workspaceId}/${jobId}/image.jpg`
    const { error } = await this.db.storage
      .from('social-publication-images')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
    check(error)
    return `social-publication-images/${path}`
  }
  async removeImage(path: string) {
    const file = this.imageLocation(path)
    if (file.bucket !== 'social-publication-images') return
    const { error } = await this.db.storage
      .from(file.bucket)
      .remove([file.path])
    check(error)
  }
}
