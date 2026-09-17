import type {
  ContentGenerationInput,
  ContentProvider,
  GeneratedDraft,
} from './contentTypes.js'

export class ContentService {
  private readonly provider: ContentProvider

  constructor(provider: ContentProvider) {
    this.provider = provider
  }

  async generate(input: ContentGenerationInput): Promise<GeneratedDraft> {
    const generated = await this.provider.generate(input)

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
