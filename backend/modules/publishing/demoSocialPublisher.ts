import type {
  PublishRequest,
  PublishResult,
  SocialPublisher,
} from './publishingTypes.js'

/** Conector de demonstração: não faz nenhuma chamada de rede. */
export class DemoSocialPublisher implements SocialPublisher {
  async publish(request: PublishRequest): Promise<PublishResult> {
    return {
      ok: true,
      mode: 'demo',
      externalPostId: `demo-${request.postId}`,
      externalPostUrl: null,
    }
  }
}
