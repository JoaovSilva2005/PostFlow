import { describe, expect, it, vi } from 'vitest'
import { PublishingService } from './publishingService.js'
import type {
  ClaimedPost,
  PublishRequest,
  PublishResult,
  PublishingRepository,
  SocialPublisher,
} from './publishingTypes.js'

const NOW = new Date('2026-10-28T12:00:00Z')

function post(overrides: Partial<ClaimedPost> = {}): ClaimedPost {
  return {
    id: 'p1',
    brandId: 'b1',
    platform: 'instagram',
    caption: 'Legenda',
    hashtags: ['#a', '#b'],
    imagePath: null,
    publishAttempts: 1,
    ...overrides,
  }
}

function setup(
  posts: ClaimedPost[],
  publish: (r: PublishRequest) => Promise<PublishResult> = async (r) => ({
    ok: true,
    mode: 'demo',
    externalPostId: `demo-${r.postId}`,
    externalPostUrl: null,
  }),
  allowed = true,
) {
  const repository = {
    claimDue: vi.fn(async () => posts),
    isPublishingAllowed: vi.fn(async () => allowed),
    signedImageUrl: vi.fn(async () => 'https://img/x'),
    markPublished: vi.fn(async () => {}),
    markForRetry: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
  } satisfies PublishingRepository
  const publisher = { publish: vi.fn(publish) } satisfies SocialPublisher
  const service = new PublishingService(repository, publisher, () => NOW)
  return { repository, publisher, service }
}

describe('PublishingService', () => {
  it('publishDue chama claimDue com (10, agora) e publica cada post uma vez', async () => {
    const { repository, publisher, service } = setup([
      post(),
      post({ id: 'p2', hashtags: [] }),
    ])
    const summary = await service.publishDue()
    expect(repository.claimDue).toHaveBeenCalledWith(10, NOW)
    expect(summary).toEqual({ claimed: 2, published: 2, retried: 0, failed: 0 })
    expect(publisher.publish).toHaveBeenCalledTimes(2)
    expect(publisher.publish.mock.calls[0][0].text).toBe('Legenda\n#a #b')
    expect(publisher.publish.mock.calls[1][0].text).toBe('Legenda')
    expect(repository.markPublished).toHaveBeenCalledTimes(2)
  })

  it('assinatura inativa marca failed sem chamar o publisher', async () => {
    const { repository, publisher, service } = setup([post()], undefined, false)
    const summary = await service.publishDue()
    expect(publisher.publish).not.toHaveBeenCalled()
    expect(repository.markFailed).toHaveBeenCalledWith(
      'p1',
      'Assinatura inativa: o post não foi publicado.',
    )
    expect(summary.failed).toBe(1)
  })

  it('falha retryable na tentativa 1 chama markForRetry', async () => {
    const { repository, service } = setup([post()], async () => ({
      ok: false,
      retryable: true,
      reason: 'timeout',
    }))
    const summary = await service.publishDue()
    expect(repository.markForRetry).toHaveBeenCalledWith('p1', 'timeout')
    expect(repository.markFailed).not.toHaveBeenCalled()
    expect(summary.retried).toBe(1)
  })

  it('falha retryable na tentativa 3 chama markFailed', async () => {
    const { repository, service } = setup(
      [post({ publishAttempts: 3 })],
      async () => ({ ok: false, retryable: true, reason: 'timeout' }),
    )
    const summary = await service.publishDue()
    expect(repository.markFailed).toHaveBeenCalledWith('p1', 'timeout')
    expect(repository.markForRetry).not.toHaveBeenCalled()
    expect(summary.failed).toBe(1)
  })

  it('falha não retryable chama markFailed na hora', async () => {
    const { repository, service } = setup([post()], async () => ({
      ok: false,
      retryable: false,
      reason: 'rejeitado',
    }))
    await service.publishDue()
    expect(repository.markFailed).toHaveBeenCalledWith('p1', 'rejeitado')
    expect(repository.markForRetry).not.toHaveBeenCalled()
  })

  it('exceção em um post não impede o próximo', async () => {
    let calls = 0
    const { repository, service } = setup(
      [post(), post({ id: 'p2' })],
      async (r) => {
        calls += 1
        if (calls === 1) throw new Error('boom')
        return {
          ok: true,
          mode: 'demo',
          externalPostId: `demo-${r.postId}`,
          externalPostUrl: null,
        }
      },
    )
    const summary = await service.publishDue()
    expect(repository.markForRetry).toHaveBeenCalledWith(
      'p1',
      'Falha temporária ao publicar.',
    )
    expect(repository.markPublished).toHaveBeenCalledTimes(1)
    expect(summary).toEqual({ claimed: 2, published: 1, retried: 1, failed: 0 })
  })

  it('erro do repositório em um post não para o lote', async () => {
    const { repository, service } = setup([post(), post({ id: 'p2' })])
    repository.isPublishingAllowed.mockRejectedValueOnce(new Error('db'))
    const summary = await service.publishDue()
    expect(repository.markPublished).toHaveBeenCalledTimes(1)
    expect(summary.claimed).toBe(2)
    expect(summary.published).toBe(1)
  })

  it('claimDue vazio devolve zeros sem chamar o publisher', async () => {
    const { publisher, service } = setup([])
    expect(await service.publishDue()).toEqual({
      claimed: 0,
      published: 0,
      retried: 0,
      failed: 0,
    })
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it('erro de claimDue propaga', async () => {
    const { repository, service } = setup([])
    repository.claimDue.mockRejectedValueOnce(new Error('rpc'))
    await expect(service.publishDue()).rejects.toThrow('rpc')
  })

  it('tentativas acima do limite marcam failed sem chamar o publisher', async () => {
    const { repository, publisher, service } = setup([
      post({ publishAttempts: 4 }),
    ])
    const summary = await service.publishDue()
    expect(publisher.publish).not.toHaveBeenCalled()
    expect(repository.markFailed).toHaveBeenCalledWith(
      'p1',
      'Limite de tentativas atingido: o post não foi publicado.',
    )
    expect(summary.failed).toBe(1)
  })
})
