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

export interface BrandWorkspace extends WorkspaceAccess {
  brand: BrandProfile
  billingStatus: BillingAccessStatus
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
  /** URL temporária assinada para a imagem privada salva com o rascunho. */
  imageUrl?: string
  /** Informa se o backend tem uma imagem salva, mesmo quando a URL expirou. */
  imageAvailable?: boolean
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
  availableWorkspaces: BrandWorkspace[]
  platformRole: PlatformRole
  billingStatus: BillingAccessStatus
  isAuthenticated: boolean
  brand: BrandProfile | null
  drafts: PostDraft[]
  databaseStatus: 'connecting' | 'connected' | 'error'
  databaseError: string | null
}
