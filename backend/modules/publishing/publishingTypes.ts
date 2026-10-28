export interface ClaimedPost {
  id: string
  brandId: string
  platform: string
  caption: string
  hashtags: string[]
  imagePath: string | null
  publishAttempts: number
}

export interface PublishRequest {
  postId: string
  brandId: string
  platform: string
  text: string
  imageUrl: string | null
}

export type PublishResult =
  | {
      ok: true
      mode: 'demo' | 'live'
      externalPostId: string
      externalPostUrl: string | null
    }
  | { ok: false; retryable: boolean; reason: string }

export interface SocialPublisher {
  publish(request: PublishRequest): Promise<PublishResult>
}

export interface PublishingRepository {
  claimDue(limit: number, now: Date): Promise<ClaimedPost[]>
  isPublishingAllowed(brandId: string): Promise<boolean>
  signedImageUrl(imagePath: string): Promise<string | null>
  markPublished(
    postId: string,
    result: Extract<PublishResult, { ok: true }>,
    now: Date,
  ): Promise<void>
  /** Volta a scheduled e guarda publish_error. */
  markForRetry(postId: string, reason: string): Promise<void>
  markFailed(postId: string, reason: string): Promise<void>
}

export interface PublishRunSummary {
  claimed: number
  published: number
  retried: number
  failed: number
}
