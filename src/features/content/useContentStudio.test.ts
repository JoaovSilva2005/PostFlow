import { act, renderHook, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useContentStudio } from './useContentStudio'
import type { ContentRequest, GenerationService } from './generationService'
import type { PostDraft } from '../../domain/models'

const request: ContentRequest = {
  prompt: 'Ideia inicial',
  platform: 'Instagram',
  date: '2026-09-18',
  brand: null,
  history: [],
  previousDraft: null,
}
const draft: PostDraft = {
  id: '1',
  title: 'Uma ideia',
  caption: 'Legenda',
  date: request.date,
  platform: request.platform,
  color: '#112233',
  hashtags: [],
  visualText: 'Novidade',
  status: 'draft',
}

describe('Estúdio de criação', () => {
  afterEach(() => vi.useRealTimers())
  it('mantém ajustes em falhas e repete sem duplicar a mensagem', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(draft)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(draft)
    const { result } = renderHook(() =>
      useContentStudio({ mode: 'demo', generate }),
    )
    await act(() => result.current.generate(request))
    act(() => result.current.setDraft({ ...draft, title: 'Meu ajuste manual' }))
    await act(() =>
      result.current.generate({
        ...request,
        prompt: 'Refinar',
        previousDraft: result.current.draft,
      }),
    )
    expect(result.current.draft?.title).toBe('Meu ajuste manual')
    expect(result.current.error).toBeTruthy()
    await act(() => result.current.retry!())
    expect(
      result.current.messages.filter((message) => message.role === 'user'),
    ).toHaveLength(2)
    expect(result.current.error).toBe('')
  })
  it('ignora resposta atrasada depois do cancelamento', async () => {
    let resolve!: (draft: PostDraft) => void
    const service: GenerationService = {
      mode: 'api',
      generate: () =>
        new Promise((done) => {
          resolve = done
        }),
    }
    const { result } = renderHook(() => useContentStudio(service))
    act(() => {
      void result.current.generate(request)
    })
    act(() => result.current.cancel())
    await act(async () => resolve(draft))
    expect(result.current.draft).toBeNull()
    expect(result.current.isGenerating).toBe(false)
  })
  it('encerra por timeout mesmo quando o provedor ignora o sinal', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useContentStudio({ mode: 'api', generate: () => new Promise(() => {}) }),
    )
    act(() => {
      void result.current.generate(request)
    })
    await act(() => vi.advanceTimersByTimeAsync(90001))
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.error).toContain('demorou demais')
  })
  it('evita duas gerações simultâneas', async () => {
    const generate = vi.fn().mockResolvedValue(draft)
    const { result } = renderHook(() =>
      useContentStudio({ mode: 'demo', generate }),
    )
    await act(async () => {
      void result.current.generate(request)
      void result.current.generate(request)
    })
    await waitFor(() => expect(result.current.isGenerating).toBe(false))
    expect(generate).toHaveBeenCalledTimes(1)
  })
  it('mantém as redes concluídas e repete apenas a geração que falhou', async () => {
    let linkedinAttempts = 0
    const generate = vi.fn(async (input: ContentRequest) => {
      if (input.platform === 'LinkedIn' && linkedinAttempts++ === 0)
        throw new Error('Falha temporária')
      return {
        ...draft,
        id: input.platform,
        platform: input.platform,
      }
    })
    const { result } = renderHook(() =>
      useContentStudio({ mode: 'demo', generate }),
    )
    await act(() =>
      result.current.generateMany([
        request,
        { ...request, platform: 'LinkedIn' },
      ]),
    )
    expect(result.current.drafts.map(({ platform }) => platform)).toEqual([
      'Instagram',
    ])
    expect(result.current.error).toContain('LinkedIn')
    await act(() => result.current.retry!())
    expect(result.current.drafts.map(({ platform }) => platform)).toEqual([
      'Instagram',
      'LinkedIn',
    ])
    expect(result.current.error).toBe('')
    expect(generate).toHaveBeenCalledTimes(3)
    expect(
      result.current.messages.filter((message) => message.role === 'user'),
    ).toHaveLength(1)
  })
})
