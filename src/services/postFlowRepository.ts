import type { BrandProfile, BrandWorkspace, PostDraft } from '../domain/models'
import {
  CLIENT_SETTABLE_STATUSES,
  type ClientSettableStatus,
} from '../../shared/domain/postPublishing'
import { apiRequest } from './apiClient'

/**
 * Campos de publicação são definidos só pelo servidor (a API é estrita) e o
 * navegador só pode enviar `draft` ou `scheduled` como status.
 */
function toClientPayload(draft: PostDraft) {
  const {
    publishedAt: _publishedAt,
    publishError: _publishError,
    publishMode: _publishMode,
    externalPostUrl: _externalPostUrl,
    status,
    ...payload
  } = draft
  return CLIENT_SETTABLE_STATUSES.includes(status as ClientSettableStatus)
    ? { ...payload, status }
    : payload
}

interface ProjectData {
  brand: BrandProfile | null
  drafts: PostDraft[]
}

export interface PostFlowDataRepository {
  listWorkspaces?(): Promise<BrandWorkspace[]>
  createWorkspace?(brand: BrandProfile): Promise<BrandWorkspace>
  load(workspaceId: string, billingWorkspaceId?: string): Promise<ProjectData>
  saveBrand(
    workspaceId: string,
    brand: BrandProfile,
    billingWorkspaceId?: string,
  ): Promise<BrandProfile>
  createDraft(
    workspaceId: string,
    draft: PostDraft,
    billingWorkspaceId?: string,
  ): Promise<PostDraft>
  createDrafts?(
    workspaceId: string,
    drafts: PostDraft[],
    billingWorkspaceId?: string,
  ): Promise<PostDraft[]>
  updateDraft(
    workspaceId: string,
    draft: PostDraft,
    billingWorkspaceId?: string,
  ): Promise<PostDraft>
  saveDraftImage?(
    workspaceId: string,
    id: string,
    imageUrl: string,
    billingWorkspaceId?: string,
  ): Promise<PostDraft>
  refreshDraftImageUrl?(
    workspaceId: string,
    id: string,
    billingWorkspaceId?: string,
  ): Promise<string | null>
  deleteDraft(
    workspaceId: string,
    id: string,
    billingWorkspaceId?: string,
  ): Promise<void>
}

function workspacePath(workspaceId: string, suffix: string) {
  return `/workspaces/${encodeURIComponent(workspaceId)}/${suffix}`
}

function billingHeaders(billingWorkspaceId?: string): HeadersInit | undefined {
  return billingWorkspaceId
    ? { 'X-Billing-Workspace-Id': billingWorkspaceId }
    : undefined
}

export const ApiPostFlowRepository: PostFlowDataRepository = {
  listWorkspaces: () => apiRequest<BrandWorkspace[]>('/brands'),

  createWorkspace: (brand) =>
    apiRequest<BrandWorkspace>('/brands', {
      method: 'POST',
      body: JSON.stringify(brand),
    }),

  async load(workspaceId, billingWorkspaceId) {
    const headers = billingHeaders(billingWorkspaceId)
    const [brand, drafts] = await Promise.all([
      apiRequest<BrandProfile | null>(workspacePath(workspaceId, 'brand'), {
        headers,
      }),
      apiRequest<PostDraft[]>(workspacePath(workspaceId, 'drafts'), {
        headers,
      }),
    ])
    return { brand, drafts }
  },

  saveBrand: (workspaceId, brand, billingWorkspaceId) =>
    apiRequest<BrandProfile>(workspacePath(workspaceId, 'brand'), {
      method: 'PUT',
      body: JSON.stringify(brand),
      headers: billingHeaders(billingWorkspaceId),
    }),

  createDraft: (workspaceId, draft, billingWorkspaceId) => {
    const { imageAvailable: _imageAvailable, ...payload } =
      toClientPayload(draft)
    return apiRequest<PostDraft>(workspacePath(workspaceId, 'drafts'), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: billingHeaders(billingWorkspaceId),
    })
  },

  createDrafts: async (workspaceId, drafts, billingWorkspaceId) => {
    // The single-generation API returns the legacy draft shape, where
    // format/timezone metadata is optional. Persist one draft through the
    // single-item endpoint instead of the stricter batch endpoint.
    if (drafts.length === 1) {
      return ApiPostFlowRepository.createDraft(
        workspaceId,
        drafts[0],
        billingWorkspaceId,
      ).then((draft) => [draft])
    }

    // The planner batch endpoint is intentionally text-only. The AI chat can
    // generate one image per selected platform, so persist those drafts via
    // the image-aware endpoint rather than silently dropping their image URLs.
    if (drafts.some(({ imageUrl }) => Boolean(imageUrl))) {
      const outcomes = await Promise.allSettled(
        drafts.map((draft) =>
          ApiPostFlowRepository.createDraft(
            workspaceId,
            draft,
            billingWorkspaceId,
          ),
        ),
      )
      const failure = outcomes.find(
        (outcome): outcome is PromiseRejectedResult =>
          outcome.status === 'rejected',
      )
      if (failure) {
        const createdIds = outcomes.flatMap((outcome) =>
          outcome.status === 'fulfilled' ? [outcome.value.id] : [],
        )
        await Promise.allSettled(
          createdIds.map((id) =>
            ApiPostFlowRepository.deleteDraft(
              workspaceId,
              id,
              billingWorkspaceId,
            ),
          ),
        )
        throw failure.reason
      }
      return outcomes.map((outcome) => {
        if (outcome.status !== 'fulfilled') throw outcome.reason
        return outcome.value
      })
    }

    // The planner batch endpoint has a strict text-only contract.
    const textualDrafts = drafts.map(
      ({ imageUrl: _imageUrl, imageAvailable: _imageAvailable, ...draft }) =>
        toClientPayload(draft),
    )
    return apiRequest<PostDraft[]>(workspacePath(workspaceId, 'drafts/batch'), {
      method: 'POST',
      body: JSON.stringify(textualDrafts),
      headers: billingHeaders(billingWorkspaceId),
    })
  },

  updateDraft: (workspaceId, draft, billingWorkspaceId) =>
    (() => {
      const {
        imageUrl: _imageUrl,
        imageAvailable: _imageAvailable,
        ...persistedDraft
      } = toClientPayload(draft)
      return apiRequest<PostDraft>(
        workspacePath(workspaceId, `drafts/${encodeURIComponent(draft.id)}`),
        {
          method: 'PATCH',
          body: JSON.stringify(persistedDraft),
          headers: billingHeaders(billingWorkspaceId),
        },
      )
    })(),

  saveDraftImage: (workspaceId, id, imageUrl, billingWorkspaceId) =>
    apiRequest<PostDraft>(
      workspacePath(workspaceId, `drafts/${encodeURIComponent(id)}/image`),
      {
        method: 'PUT',
        body: JSON.stringify({ imageUrl }),
        headers: billingHeaders(billingWorkspaceId),
      },
    ),

  refreshDraftImageUrl: async (workspaceId, id, billingWorkspaceId) => {
    const result = await apiRequest<{ imageUrl: string | null }>(
      workspacePath(workspaceId, `drafts/${encodeURIComponent(id)}/image-url`),
      { headers: billingHeaders(billingWorkspaceId) },
    )
    return result.imageUrl
  },

  deleteDraft: (workspaceId, id, billingWorkspaceId) =>
    apiRequest<void>(
      workspacePath(workspaceId, `drafts/${encodeURIComponent(id)}`),
      { method: 'DELETE', headers: billingHeaders(billingWorkspaceId) },
    ),
}
