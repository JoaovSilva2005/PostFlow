import type { GenerationRequest, PostDraft } from '../domain/models'

export interface AiService {
  generate(request: GenerationRequest): Promise<PostDraft>
}

function createId() {
  return `post-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const MockAiService: AiService = {
  async generate(request) {
    await new Promise((resolve) => window.setTimeout(resolve, 650))
    const subject = request.prompt.trim() || 'novidades da marca'

    return {
      id: createId(),
      title: 'Sexta com café especial',
      caption: `Transforme sua pausa em um momento especial. Hoje preparamos um conteúdo sobre ${subject.toLowerCase()} para aproximar sua marca das pessoas.`,
      hashtags: ['#PostFlow', '#ConteúdoCriativo', '#SuaMarca'],
      platform: request.platform,
      date: '2026-08-14',
      status: 'draft',
      visualText: 'Uma pausa\nque inspira.',
      color: '#4F46E5',
    }
  },
}
