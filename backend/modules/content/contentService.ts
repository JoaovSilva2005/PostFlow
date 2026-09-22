import type {
  ContentGenerationInput,
  ContentProvider,
  GeneratedDraft,
} from './contentTypes.js'

type AbortableContentProvider = {
  generate: (
    input: ContentGenerationInput,
    signal?: AbortSignal,
  ) => ReturnType<ContentProvider['generate']>
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
}
