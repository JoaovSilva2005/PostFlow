import {
  PUBLISH_BATCH_SIZE,
  PUBLISH_MAX_ATTEMPTS,
} from '../../../shared/domain/postPublishing.js'
import type {
  ClaimedPost,
  PublishResult,
  PublishRunSummary,
  PublishingRepository,
  SocialPublisher,
} from './publishingTypes.js'

const INACTIVE_SUBSCRIPTION_REASON =
  'Assinatura inativa: o post não foi publicado.'
const ATTEMPTS_EXCEEDED_REASON =
  'Limite de tentativas atingido: o post não foi publicado.'
const PUBLISHER_THROW_REASON = 'Falha temporária ao publicar.'

type Outcome = 'published' | 'retried' | 'failed'

function buildText(post: ClaimedPost): string {
  return post.hashtags.length > 0
    ? `${post.caption}\n${post.hashtags.join(' ')}`
    : post.caption
}

export class PublishingService {
  private readonly repository: PublishingRepository
  private readonly publisher: SocialPublisher
  private readonly clock: () => Date

  constructor(
    repository: PublishingRepository,
    publisher: SocialPublisher,
    clock: () => Date = () => new Date(),
  ) {
    this.repository = repository
    this.publisher = publisher
    this.clock = clock
  }

  async publishDue(): Promise<PublishRunSummary> {
    const posts = await this.repository.claimDue(
      PUBLISH_BATCH_SIZE,
      this.clock(),
    )
    const summary: PublishRunSummary = {
      claimed: posts.length,
      published: 0,
      retried: 0,
      failed: 0,
    }
    for (const post of posts) {
      try {
        const outcome = await this.processPost(post)
        summary[outcome] += 1
      } catch (error) {
        console.error('Falha ao processar post agendado.', post.id, error)
      }
    }
    return summary
  }

  private async processPost(post: ClaimedPost): Promise<Outcome> {
    if (post.publishAttempts > PUBLISH_MAX_ATTEMPTS) {
      await this.repository.markFailed(post.id, ATTEMPTS_EXCEEDED_REASON)
      return 'failed'
    }
    if (!(await this.repository.isPublishingAllowed(post.brandId))) {
      await this.repository.markFailed(post.id, INACTIVE_SUBSCRIPTION_REASON)
      return 'failed'
    }

    const imageUrl = post.imagePath
      ? await this.repository.signedImageUrl(post.imagePath)
      : null

    let result: PublishResult
    try {
      result = await this.publisher.publish({
        postId: post.id,
        brandId: post.brandId,
        platform: post.platform,
        text: buildText(post),
        imageUrl,
      })
    } catch {
      result = { ok: false, retryable: true, reason: PUBLISHER_THROW_REASON }
    }

    if (result.ok) {
      await this.repository.markPublished(post.id, result, this.clock())
      return 'published'
    }
    if (result.retryable && post.publishAttempts < PUBLISH_MAX_ATTEMPTS) {
      await this.repository.markForRetry(post.id, result.reason)
      return 'retried'
    }
    await this.repository.markFailed(post.id, result.reason)
    return 'failed'
  }
}
