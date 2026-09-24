import type {
  ContentFormat,
  ContentFormatData,
} from '../../../shared/domain/contentFormats.js'
import { SOCIAL_PLATFORMS } from '../../../shared/domain/socialPlatforms.js'

export const CONTENT_PLATFORMS = SOCIAL_PLATFORMS

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number]

export interface BrandContext {
  name: string
  segment: string
  toneOfVoice: string
  primaryColor: string
  description?: string
  targetAudience?: string
  productsOrServices?: string
  differentials?: string
  contentGoals?: string
  keywords?: string
  avoidTopics?: string
  defaultCta?: string
}

export interface ContentGenerationInput {
  prompt: string
  platform: ContentPlatform
  date: string
  brand: BrandContext | null
  history: { role: 'user' | 'assistant'; content: string }[]
  previousDraft: GeneratedDraft | null
  format?: ContentFormat
  formatData?: ContentFormatData
  persona?: string
  time?: string
  timezone?: string
}

export interface ContentGenerationItem {
  key: string
  platform: ContentPlatform
  date: string
}

export interface BatchContentGenerationInput {
  prompt: string
  platforms: ContentPlatform[]
  dates: string[]
  time: string
  timezone: string
  format: ContentFormat
  persona: string
  brand: ContentGenerationInput['brand']
  items: ContentGenerationItem[]
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
  imageUrl?: string
  format?: ContentFormat
  formatData?: ContentFormatData
  persona?: string
  time?: string
  timezone?: string
}

export interface GeneratedBatchCopy {
  key: string
  title: string
  caption: string
  hashtags: string[]
  visualText: string
  formatData: ContentFormatData
}

export interface ContentProvider {
  generate(
    input: ContentGenerationInput,
  ): Promise<
    Omit<GeneratedDraft, 'id' | 'date' | 'platform' | 'status' | 'color'>
  >
  generateBatch?(
    input: BatchContentGenerationInput,
    signal?: AbortSignal,
  ): Promise<GeneratedBatchCopy[]>
}
