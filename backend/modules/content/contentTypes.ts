export const CONTENT_PLATFORMS = ['Instagram', 'LinkedIn', 'Facebook'] as const

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number]

export interface ContentGenerationInput {
  prompt: string
  platform: ContentPlatform
  date: string
  brand: {
    name: string
    segment: string
    toneOfVoice: string
    primaryColor: string
  } | null
  history: { role: 'user' | 'assistant'; content: string }[]
  previousDraft: GeneratedDraft | null
}

export interface GeneratedDraft {
  id: string
  title: string
  caption: string
  hashtags: string[]
  platform: ContentPlatform
  date: string
  status: 'draft'
  visualText: string
  color: string
}

export interface ContentProvider {
  generate(
    input: ContentGenerationInput,
  ): Promise<
    Omit<GeneratedDraft, 'id' | 'date' | 'platform' | 'status' | 'color'>
  >
}
