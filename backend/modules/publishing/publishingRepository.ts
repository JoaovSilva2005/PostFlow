import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkspaceAccessRepository } from '../tenancy/workspaceTypes.js'
import type {
  ClaimedPost,
  PublishResult,
  PublishingRepository,
} from './publishingTypes.js'

const DRAFT_IMAGE_BUCKET = 'post-draft-images'
const SIGNED_IMAGE_URL_TTL_SECONDS = 60 * 60
const MAX_ERROR_LENGTH = 500

function truncateReason(reason: string): string {
  return reason.length > MAX_ERROR_LENGTH
    ? reason.slice(0, MAX_ERROR_LENGTH)
    : reason
}

interface ClaimedRow {
  id: string
  brand_id: string
  platform_id: string
  caption: string | null
  image_path: string | null
  publish_attempts: number | null
}

export class SupabasePublishingRepository implements PublishingRepository {
  private readonly supabase: SupabaseClient
  private readonly workspaceAccess: WorkspaceAccessRepository

  constructor(
    supabase: SupabaseClient,
    workspaceAccess: WorkspaceAccessRepository,
  ) {
    this.supabase = supabase
    this.workspaceAccess = workspaceAccess
  }

  async claimDue(limit: number, now: Date): Promise<ClaimedPost[]> {
    const { data, error } = await this.supabase.rpc('claim_due_post_drafts', {
      p_limit: limit,
      p_now: now.toISOString(),
    })
    if (error) {
      throw new Error(
        `Falha ao reservar posts para publicação: ${error.message}`,
      )
    }
    const rows = (data ?? []) as ClaimedRow[]
    if (rows.length === 0) return []

    const { data: tagRows, error: tagError } = await this.supabase
      .from('post_hashtags')
      .select('post_id, hashtag')
      .in(
        'post_id',
        rows.map((row) => row.id),
      )
    if (tagError) {
      throw new Error(
        `Falha ao consultar hashtags dos posts: ${tagError.message}`,
      )
    }
    const tagsByPost = new Map<string, string[]>()
    for (const tag of (tagRows ?? []) as {
      post_id: string
      hashtag: string
    }[]) {
      const list = tagsByPost.get(tag.post_id) ?? []
      list.push(tag.hashtag)
      tagsByPost.set(tag.post_id, list)
    }

    return rows.map((row) => ({
      id: row.id,
      brandId: row.brand_id,
      platform: row.platform_id,
      caption: row.caption ?? '',
      hashtags: tagsByPost.get(row.id) ?? [],
      imagePath: row.image_path,
      publishAttempts: row.publish_attempts ?? 0,
    }))
  }

  async isPublishingAllowed(brandId: string): Promise<boolean> {
    const status = await this.workspaceAccess.getBillingStatus(brandId)
    if (status === 'active' || status === 'trialing') return true

    const { data, error } = await this.supabase
      .from('brand_members')
      .select('user_id')
      .eq('brand_id', brandId)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle()
    if (error) {
      throw new Error(`Falha ao consultar o dono da marca: ${error.message}`)
    }
    if (!data?.user_id) return false
    const workspaceId = await this.workspaceAccess.getActiveBillingWorkspaceId(
      data.user_id as string,
    )
    return workspaceId !== null
  }

  async signedImageUrl(imagePath: string): Promise<string | null> {
    const { data, error } = await this.supabase.storage
      .from(DRAFT_IMAGE_BUCKET)
      .createSignedUrl(imagePath, SIGNED_IMAGE_URL_TTL_SECONDS)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  }

  async markPublished(
    postId: string,
    result: Extract<PublishResult, { ok: true }>,
    now: Date,
  ): Promise<void> {
    await this.updatePublishing(postId, {
      status: 'published',
      published_at: now.toISOString(),
      publish_mode: result.mode,
      external_post_id: result.externalPostId,
      external_post_url: result.externalPostUrl,
      publish_error: null,
      publishing_started_at: null,
    })
  }

  async markForRetry(postId: string, reason: string): Promise<void> {
    await this.updatePublishing(postId, {
      status: 'scheduled',
      publish_error: truncateReason(reason),
      publishing_started_at: null,
    })
  }

  async markFailed(postId: string, reason: string): Promise<void> {
    await this.updatePublishing(postId, {
      status: 'failed',
      publish_error: truncateReason(reason),
      publishing_started_at: null,
    })
  }

  private async updatePublishing(
    postId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('post_drafts')
      .update(values)
      .eq('id', postId)
      .eq('status', 'publishing')
    if (error) {
      throw new Error(`Falha ao atualizar o status do post: ${error.message}`)
    }
  }
}
