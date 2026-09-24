import type {
  ContentFormat,
  ContentFormatData,
} from '../../shared/domain/contentFormats'
import type {
  AuthUser,
  BillingAccessStatus,
  PlatformRole,
  WorkspaceAccess,
} from './auth'

export type PostStatus = 'draft' | 'scheduled' | 'published'

export interface BrandProfile {
  name: string
  segment: string
  toneOfVoice: string
  primaryColor: string
  colorPalette?: string[]
  /** Contexto amplo da marca usado para orientar a geração de conteúdo. */
  description?: string
  targetAudience?: string
  productsOrServices?: string
  differentials?: string
  contentGoals?: string
  keywords?: string
  avoidTopics?: string
  defaultCta?: string
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
  /** Imagem gerada para a revisão atual; a agenda persiste o conteúdo textual. */
  imageUrl?: string
  /** Metadata from the batch planner; absent in older drafts. */
  format?: ContentFormat
  formatData?: ContentFormatData
  persona?: string
  time?: string
  timezone?: string
}

export interface AppState {
  authError: string | null
  authStatus: 'checking' | 'authenticated' | 'anonymous'
  authUser: AuthUser | null
  currentWorkspace: WorkspaceAccess | null
  platformRole: PlatformRole
  billingStatus: BillingAccessStatus
  isAuthenticated: boolean
  brand: BrandProfile | null
  drafts: PostDraft[]
  databaseStatus: 'connecting' | 'connected' | 'error'
  databaseError: string | null
}
