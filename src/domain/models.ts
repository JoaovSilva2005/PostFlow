export type PostStatus = 'draft' | 'scheduled' | 'published'

export interface BrandProfile {
  name: string
  segment: string
  toneOfVoice: string
  primaryColor: string
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
import type {
  AuthUser,
  BillingAccessStatus,
  PlatformRole,
  WorkspaceAccess,
} from './auth'
