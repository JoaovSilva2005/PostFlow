import type { PostDraft } from '../../domain/models'
import type {
  BatchContentRequest,
  GenerationService,
  Platform,
} from '../content/generationService'

export interface ImageProgress {
  completed: number
  total: number
}

// A task lives for one sidebar configuration. Retry only unfinished work;
// successful provider calls must not be repeated after a later failure.
export function createCalendarGenerationTask(
  request: BatchContentRequest,
  service: GenerationService,
) {
  let copies: PostDraft[] | undefined
  const imagesByDate = new Map<string, string>()

  return async (
    signal: AbortSignal,
    onImages: (progress: ImageProgress) => void,
  ): Promise<PostDraft[]> => {
    signal.throwIfAborted()
    if (!service.generateBatch) throw new Error('Geração em lote indisponível.')
    copies ??= await service.generateBatch(request, signal)
    signal.throwIfAborted()
    const draftsByDate = new Map<string, PostDraft>()
    for (const draft of copies) {
      if (!draftsByDate.has(draft.date)) draftsByDate.set(draft.date, draft)
    }

    if (service.generateImage) {
      const generateImage = service.generateImage.bind(service)
      const pending = [...draftsByDate.values()].filter(
        ({ date }) => !imagesByDate.has(date),
      )
      const progress = () =>
        onImages({ completed: imagesByDate.size, total: draftsByDate.size })
      progress()
      let nextIndex = 0
      let failed = false
      let failure: unknown
      const worker = async () => {
        while (!failed && !signal.aborted) {
          const draft = pending[nextIndex++]
          if (!draft) return
          try {
            const imageUrl = await generateImage(
              {
                workspaceId: request.workspaceId,
                prompt: request.prompt,
                platform: draft.platform as Platform,
                date: draft.date,
                brand: request.brand,
                history: [],
                previousDraft: draft,
                imageTier: 'standard',
                format: request.format,
                formatData: draft.formatData,
                persona: request.persona,
              },
              signal,
            )
            if (!imageUrl) throw new Error('A IA não retornou uma imagem.')
            imagesByDate.set(draft.date, imageUrl)
            if (!signal.aborted) progress()
          } catch (error) {
            failed = true
            failure = error
          }
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(3, pending.length) }, worker),
      )
      signal.throwIfAborted()
      if (failed) throw failure
    } else if (service.mode === 'api') {
      throw new Error('Geração de imagem indisponível neste momento.')
    }

    return copies.map((draft) => {
      const imageUrl = imagesByDate.get(draft.date)
      return imageUrl ? { ...draft, imageUrl } : { ...draft }
    })
  }
}
