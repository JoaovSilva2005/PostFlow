import type {
  SocialProviderId,
  SocialConnectionDTO,
  PendingConnectionDTO,
  PublicationDTO,
  PublicationStatus,
  TikTokCreatorInfo,
  TikTokPublishOptions,
} from '../../../shared/domain/socialPublishing.js'
export type { TikTokCreatorInfo, TikTokPublishOptions }

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  scopes?: string[]
}
export interface ProviderAccount {
  externalAccountId: string
  displayName: string
  accountType: string
  tokens: OAuthTokens
}
export interface ProviderPublishInput {
  format?: string
  externalAccountId: string
  tokens: OAuthTokens
  caption: string
  title: string
  imageUrl: string
  imageBytes: Uint8Array
  options?: TikTokPublishOptions
  operation?: Record<string, unknown>
}
export interface PreparedPublication {
  operation: Record<string, unknown>
  ready: boolean
}
export interface ProviderResult {
  status: 'published' | 'processing' | 'failed' | 'unknown'
  remotePostId?: string
  remoteUrl?: string
  operation?: Record<string, unknown>
  message?: string
}
export interface SocialProvider {
  id: SocialProviderId
  configured: boolean
  scopes: string[]
  authorizationUrl(input: {
    state: string
    redirectUri: string
    codeChallenge: string
  }): string
  exchangeCode(input: {
    code: string
    redirectUri: string
    codeVerifier: string
  }): Promise<OAuthTokens>
  accounts(tokens: OAuthTokens): Promise<ProviderAccount[]>
  refresh?(tokens: OAuthTokens): Promise<OAuthTokens>
  creatorInfo?(
    tokens: OAuthTokens,
    externalAccountId: string,
  ): Promise<TikTokCreatorInfo>
  prepare(input: ProviderPublishInput): Promise<PreparedPublication>
  publish(
    input: ProviderPublishInput,
    operation: Record<string, unknown>,
  ): Promise<ProviderResult>
  reconcile(
    input: ProviderPublishInput,
    operation: Record<string, unknown>,
  ): Promise<ProviderResult>
}
export class ProviderError extends Error {
  readonly kind: 'auth' | 'rate_limit' | 'validation' | 'temporary' | 'unknown'
  constructor(message: string, kind: ProviderError['kind']) {
    super(message)
    this.name = 'ProviderError'
    this.kind = kind
  }
}
export interface ConnectionRecord extends SocialConnectionDTO {
  workspaceId: string
  encryptedTokens: string
  userId: string
}
export interface OAuthSessionRecord {
  id: string
  workspaceId: string
  userId: string
  provider: SocialProviderId
  stateHash: string
  encryptedVerifier: string
  encryptedAccounts: string | null
  redirectUri: string
  expiresAt: string
  status: 'pending' | 'exchanging' | 'ready' | 'failed'
}
export interface PublicationSnapshot {
  approvalHash: string
  title: string
  caption: string
  imagePath: string
  timezone: string
  options?: TikTokPublishOptions
}
export interface PublicationRecord extends Omit<PublicationDTO, 'simulated'> {
  workspaceId: string
  userId: string
  snapshot: PublicationSnapshot
  operation: Record<string, unknown> | null
  leaseToken: string | null
  leaseExpiresAt: string | null
  nextAttemptAt: string
}
export interface DraftForPublication {
  id: string
  workspaceId: string
  provider: string
  title: string
  caption: string
  hashtags: string[]
  format: string
  imagePath: string | null
  timezone: string
}
export interface SocialRepository {
  listConnections(workspaceId: string): Promise<ConnectionRecord[]>
  getConnection(
    workspaceId: string,
    id: string,
  ): Promise<ConnectionRecord | null>
  saveConnection(record: ConnectionRecord): Promise<ConnectionRecord>
  updateConnection(
    workspaceId: string,
    id: string,
    patch: Partial<
      Pick<ConnectionRecord, 'status' | 'encryptedTokens' | 'expiresAt'>
    >,
  ): Promise<void>
  claimRefresh(workspaceId: string, id: string): Promise<string | null>
  finishRefresh(
    workspaceId: string,
    id: string,
    lease: string,
    patch: { encryptedTokens: string; expiresAt: string | null } | null,
  ): Promise<boolean>
  disconnect(workspaceId: string, id: string): Promise<void>
  createOAuthSession(record: OAuthSessionRecord): Promise<void>
  consumeOAuthSession(
    stateHash: string,
    userId: string,
    provider: SocialProviderId,
  ): Promise<OAuthSessionRecord | null>
  completeOAuthSession(
    id: string,
    encryptedAccounts: string | null,
  ): Promise<void>
  getReadySession(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<OAuthSessionRecord | null>
  listReadySessions(
    workspaceId: string,
    userId: string,
  ): Promise<OAuthSessionRecord[]>
  countOAuthSessions(workspaceId: string, userId: string): Promise<number>
  getDraft(workspaceId: string, id: string): Promise<DraftForPublication | null>
  listPublications(workspaceId: string): Promise<PublicationRecord[]>
  getPublication(id: string): Promise<PublicationRecord | null>
  enqueue(record: PublicationRecord): Promise<PublicationRecord>
  cancel(workspaceId: string, id: string): Promise<PublicationRecord | null>
  claimDue(limit: number): Promise<PublicationRecord[]>
  updateClaim(
    id: string,
    leaseToken: string,
    patch: Partial<
      Pick<
        PublicationRecord,
        | 'status'
        | 'operation'
        | 'remotePostId'
        | 'remoteUrl'
        | 'error'
        | 'nextAttemptAt'
      >
    >,
  ): Promise<boolean>
  releaseClaim(id: string, leaseToken: string): Promise<void>
  loadImage(path: string): Promise<Uint8Array>
  saveImage(
    workspaceId: string,
    jobId: string,
    bytes: Uint8Array,
  ): Promise<string>
  removeImage(path: string): Promise<void>
}
export type PublicConnection = SocialConnectionDTO
export type PublicPending = PendingConnectionDTO
export type PublicPublication = PublicationDTO
export type JobStatus = PublicationStatus
