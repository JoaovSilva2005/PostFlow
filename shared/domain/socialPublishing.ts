export const SOCIAL_PROVIDERS = [
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
] as const
/** Tipo de conta gravado pelos adaptadores de demonstração. */
export const DEMO_ACCOUNT_TYPE = 'demo'
export type SocialProviderId = (typeof SOCIAL_PROVIDERS)[number]
export type PublicationStatus =
  | 'queued'
  | 'preparing'
  | 'processing'
  | 'publishing'
  | 'published'
  | 'retry_wait'
  | 'failed'
  | 'needs_reconnect'
  | 'cancelled'
  | 'unknown'

export interface TikTokCreatorInfo {
  creatorUsername: string
  creatorNickname: string
  creatorAvatarUrl?: string
  privacyLevelOptions: string[]
  commentDisabled: boolean
  duetDisabled: boolean
  stitchDisabled: boolean
  maxVideoPostDurationSec?: number
}
export interface TikTokPublishOptions {
  privacyLevel: string
  disableComment: boolean
  isAiGenerated: boolean
  brandContentToggle: boolean
  brandOrganicToggle: boolean
}
export interface SocialConnectionDTO {
  id: string
  provider: SocialProviderId
  externalAccountId: string
  displayName: string
  accountType: string
  status: 'connected' | 'needs_reconnect' | 'disconnected'
  expiresAt: string | null
  createdAt: string
}
export interface PendingConnectionDTO {
  id: string
  provider: SocialProviderId
  accounts: Array<{
    externalAccountId: string
    displayName: string
    accountType: string
  }>
}
export interface PublicationDTO {
  id: string
  draftId: string
  connectionId: string
  provider: SocialProviderId
  title: string
  status: PublicationStatus
  scheduledAt: string
  remotePostId: string | null
  remoteUrl: string | null
  error: string | null
  attempts: number
  cancellable?: boolean
  simulated: boolean
  createdAt: string
}
export interface SocialProviderDTO {
  id: SocialProviderId
  label: string
  configured: boolean
  missingConfiguration: string[]
  formats: ['static']
  setupUrl: string
}
export interface SocialOverview {
  demoMode: boolean
  providers: SocialProviderDTO[]
  connections: SocialConnectionDTO[]
  pending: PendingConnectionDTO[]
  publications: PublicationDTO[]
}
export interface CreatePublicationInput {
  draftId: string
  connectionId: string
  scheduledAt?: string
  consent: true
  expectedDraft: {
    title: string
    caption: string
    hashtags: string[]
    imageUrl: string
  }
  tiktok?: TikTokPublishOptions
}
