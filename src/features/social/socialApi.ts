import { apiRequest } from '../../services/apiClient'
import type {
  CreatePublicationInput,
  PublicationDTO,
  SocialConnectionDTO,
  SocialOverview,
  SocialProviderId,
  TikTokCreatorInfo,
} from '../../../shared/domain/socialPublishing'
export type {
  SocialOverview,
  SocialProviderId,
} from '../../../shared/domain/socialPublishing'

const base = (workspaceId: string) =>
  `/workspaces/${encodeURIComponent(workspaceId)}/social`

export const socialApi = {
  overview: (workspaceId: string, signal?: AbortSignal) =>
    apiRequest<SocialOverview>(`${base(workspaceId)}/overview`, { signal }),
  beginOAuth: (workspaceId: string, provider: SocialProviderId) =>
    apiRequest<{ authorizationUrl: string }>(
      `${base(workspaceId)}/oauth/${provider}`,
      { method: 'POST' },
    ),
  completeConnection: (
    workspaceId: string,
    input: { sessionId: string; externalAccountId: string },
  ) =>
    apiRequest<SocialConnectionDTO>(`${base(workspaceId)}/connections`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  disconnect: (workspaceId: string, connectionId: string) =>
    apiRequest<void>(
      `${base(workspaceId)}/connections/${encodeURIComponent(connectionId)}`,
      { method: 'DELETE' },
    ),
  creatorInfo: (workspaceId: string, connectionId: string) =>
    apiRequest<TikTokCreatorInfo>(
      `${base(workspaceId)}/connections/${encodeURIComponent(connectionId)}/creator-info`,
    ),
  publish: (workspaceId: string, input: CreatePublicationInput) =>
    apiRequest<PublicationDTO>(`${base(workspaceId)}/publications`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  cancel: (workspaceId: string, publicationId: string) =>
    apiRequest<PublicationDTO>(
      `${base(workspaceId)}/publications/${encodeURIComponent(publicationId)}/cancel`,
      { method: 'POST' },
    ),
}
