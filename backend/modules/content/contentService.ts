import type {
  BatchContentGenerationInput,
  ContentGenerationInput,
  ContentProvider,
  GeneratedBatchCopy,
  GeneratedDraft,
} from './contentTypes.js'
import { HttpError } from '../../shared/HttpError.js'

type AbortableContentProvider = {
  generate: (
    input: ContentGenerationInput,
    signal?: AbortSignal,
  ) => ReturnType<ContentProvider['generate']>
}

type BatchContentProvider = {
  generateBatch: NonNullable<ContentProvider['generateBatch']>
}

export class ContentService {
  private readonly provider: ContentProvider

  constructor(provider: ContentProvider) {
    this.provider = provider
  }

  async generate(
    input: ContentGenerationInput,
    signal?: AbortSignal,
  ): Promise<GeneratedDraft> {
    const provider = this.provider as AbortableContentProvider
    const generated = await provider.generate.call(this.provider, input, signal)

    return {
      id: input.previousDraft?.id ?? crypto.randomUUID(),
      ...generated,
      platform: input.platform,
      date: input.date,
      status: 'draft',
      color: input.brand?.primaryColor ?? '#4F46E5',
    }
  }

  async generateBatch(
    input: BatchContentGenerationInput,
    signal?: AbortSignal,
  ): Promise<GeneratedDraft[]> {
    const provider = this.provider as ContentProvider &
      Partial<BatchContentProvider>
    if (!provider.generateBatch) {
      throw new HttpError(
        503,
        'Geração em lote não está disponível neste provedor.',
      )
    }

    const generated: GeneratedBatchCopy[] = await provider.generateBatch.call(
      this.provider,
      input,
      signal,
    )
    const byKey = new Map(generated.map((item) => [item.key, item]))
    if (
      generated.length !== input.items.length ||
      byKey.size !== input.items.length ||
      input.items.some((item) => !byKey.has(item.key))
    ) {
      throw new HttpError(
        502,
        'O provedor não retornou todas as variações do lote.',
      )
    }

    return input.items.map((item) => {
      const copy = byKey.get(item.key)!
      if (copy.formatData.kind !== input.format) {
        throw new HttpError(
          502,
          'O provedor retornou um formato de conteúdo incompatível.',
        )
      }
      return {
        id: crypto.randomUUID(),
        title: copy.title,
        caption: copy.caption,
        hashtags: copy.hashtags,
        visualText: copy.visualText,
        platform: item.platform,
        date: item.date,
        status: 'draft',
        color: input.brand?.primaryColor ?? '#4F46E5',
        format: input.format,
        formatData: copy.formatData,
        persona: input.persona,
        time: input.time,
        timezone: input.timezone,
      }
    })
  }
}
