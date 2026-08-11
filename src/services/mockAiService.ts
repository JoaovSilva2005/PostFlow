import type { GenerationRequest, PostDraft } from '../domain/models'

export interface AiService {
  generate(request: GenerationRequest): Promise<PostDraft>
}

const SIMULATED_DELAY_MS = 650
const SUGGESTED_POST_DATE = '2026-08-14'
const DEFAULT_POST_COLOR = '#4F46E5'

function createDraftId(): string {
  return `post-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createDraft(request: GenerationRequest): PostDraft {
  const subject = request.prompt.trim() || 'novidades da marca'

  return {
    id: createDraftId(),
    title: 'Sexta com café especial',
    caption: `Transforme sua pausa em um momento especial. Hoje preparamos um conteúdo sobre ${subject.toLowerCase()} para aproximar sua marca das pessoas.`,
    hashtags: ['#PostFlow', '#ConteúdoCriativo', '#SuaMarca'],
    platform: request.platform,
    date: SUGGESTED_POST_DATE,
    status: 'draft',
    visualText: 'Uma pausa\nque inspira.',
    color: DEFAULT_POST_COLOR,
  }
}

export const MockAiService: AiService = {
  async generate(request) {
    await new Promise((resolve) =>
      window.setTimeout(resolve, SIMULATED_DELAY_MS),
    )
    return createDraft(request)
  },
}
