export type PostStatus = 'draft' | 'scheduled' | 'published'

export interface BrandProfile {
  name: string
  segment: string
  toneOfVoice: string
  primaryColor: string
}

export interface GenerationRequest {
  prompt: string
  platform: string
}

export interface PostDraft {
  id: string
  title: string
  caption: string
  hashtags: string[]
  platform: string
  date: string
  status: PostStatus
  visualText: string
  color: string
}

export interface AppState {
  isAuthenticated: boolean
  brand: BrandProfile | null
  drafts: PostDraft[]
  databaseStatus: 'connecting' | 'connected' | 'error'
  databaseError: string | null
}
