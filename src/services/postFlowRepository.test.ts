import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiPostFlowRepository } from './postFlowRepository'

describe('ApiPostFlowRepository', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('não persiste a imagem base64 junto do rascunho textual', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'draft-1',
            title: 'Post de teste',
            caption: 'Legenda de teste.',
            hashtags: ['#Teste'],
            platform: 'Instagram',
            date: '2026-09-20',
            status: 'draft',
            visualText: 'Uma ideia',
            color: '#123456',
          },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetch)

    await ApiPostFlowRepository.createDraft('workspace-1', {
      id: 'draft-1',
      title: 'Post de teste',
      caption: 'Legenda de teste.',
      hashtags: ['#Teste'],
      platform: 'Instagram',
      date: '2026-09-20',
      status: 'draft',
      visualText: 'Uma ideia',
      color: '#123456',
      imageUrl: 'data:image/webp;base64,aW1hZ2U=',
    })

    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >
    expect(body).not.toHaveProperty('imageUrl')
    expect(body).toMatchObject({
      title: 'Post de teste',
      caption: 'Legenda de teste.',
    })
  })
})
