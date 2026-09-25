import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PostDraft } from '../domain/models'
import { ApiPostFlowRepository } from './postFlowRepository'

describe('ApiPostFlowRepository', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('envia a imagem ao endpoint para salvá-la no storage privado', async () => {
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
    expect(body).toHaveProperty('imageUrl', 'data:image/webp;base64,aW1hZ2U=')
    expect(body).toMatchObject({
      title: 'Post de teste',
      caption: 'Legenda de teste.',
    })
  })

  it('persiste um único rascunho pelo endpoint individual', async () => {
    const draft: PostDraft = {
      id: 'draft-1',
      title: 'Post de teste',
      caption: 'Legenda de teste.',
      hashtags: ['#Teste'],
      platform: 'Instagram',
      date: '2026-09-20',
      status: 'draft',
      visualText: 'Uma ideia',
      color: '#123456',
    }
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: draft })))
    vi.stubGlobal('fetch', fetch)

    const saved = await ApiPostFlowRepository.createDrafts!('workspace-1', [
      draft,
    ])

    expect(String(fetch.mock.calls[0]?.[0])).toContain(
      '/workspaces/workspace-1/drafts',
    )
    expect(String(fetch.mock.calls[0]?.[0])).not.toContain('/drafts/batch')
    expect(saved).toEqual([draft])
  })

  it('persiste cada imagem gerada em lote pelo endpoint individual', async () => {
    const drafts: PostDraft[] = ['Instagram', 'LinkedIn'].map(
      (platform, index) => ({
        id: `draft-${index + 1}`,
        title: `Post para ${platform}`,
        caption: 'Legenda de teste.',
        hashtags: [],
        platform,
        date: '2026-09-20',
        status: 'draft',
        visualText: 'Uma ideia',
        color: '#123456',
        imageUrl: 'data:image/webp;base64,aW1hZ2U=',
      }),
    )
    const fetch = vi.fn().mockImplementation((_url, options) => {
      const body = JSON.parse(String(options?.body)) as PostDraft
      return Promise.resolve(
        new Response(
          JSON.stringify({ data: { ...body, imageAvailable: true } }),
        ),
      )
    })
    vi.stubGlobal('fetch', fetch)

    const saved = await ApiPostFlowRepository.createDrafts!(
      'workspace-1',
      drafts,
    )

    expect(fetch).toHaveBeenCalledTimes(2)
    for (const [url, options] of fetch.mock.calls) {
      expect(String(url)).toContain('/workspaces/workspace-1/drafts')
      expect(String(url)).not.toContain('/drafts/batch')
      expect(JSON.parse(String(options?.body))).toHaveProperty(
        'imageUrl',
        'data:image/webp;base64,aW1hZ2U=',
      )
    }
    expect(saved).toHaveLength(2)
    expect(saved.every((draft) => draft.imageAvailable)).toBe(true)
  })

  it('mantém a criação em lote sem imagens, conforme o contrato do planner', async () => {
    const draft: PostDraft = {
      id: 'draft-1',
      title: 'Post de teste',
      caption: 'Legenda de teste.',
      hashtags: [],
      platform: 'Instagram',
      date: '2026-09-20',
      status: 'draft',
      visualText: 'Uma ideia',
      color: '#123456',
    }
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: [draft, { ...draft, id: 'draft-2' }] }),
        ),
      )
    vi.stubGlobal('fetch', fetch)

    await ApiPostFlowRepository.createDrafts!('workspace-1', [
      draft,
      { ...draft, id: 'draft-2' },
    ])

    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)) as Array<
      Record<string, unknown>
    >
    expect(body).toHaveLength(2)
    expect(body[0]).not.toHaveProperty('imageUrl')
    expect(body[1]).not.toHaveProperty('imageUrl')
  })
})
