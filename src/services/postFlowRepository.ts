import type { BrandProfile, BrandWorkspace, PostDraft } from '../domain/models'
import { apiRequest } from './apiClient'

interface ProjectData {
  brand: BrandProfile | null
  drafts: PostDraft[]
}

export interface PostFlowDataRepository {
  listWorkspaces?(): Promise<BrandWorkspace[]>
  createWorkspace?(brand: BrandProfile): Promise<BrandWorkspace>
  load(workspaceId: string): Promise<ProjectData>
  saveBrand(workspaceId: string, brand: BrandProfile): Promise<BrandProfile>
  createDraft(workspaceId: string, draft: PostDraft): Promise<PostDraft>
  createDrafts?(workspaceId: string, drafts: PostDraft[]): Promise<PostDraft[]>
  updateDraft(workspaceId: string, draft: PostDraft): Promise<PostDraft>
  saveDraftImage?(
    workspaceId: string,
    id: string,
    imageUrl: string,
  ): Promise<PostDraft>
  refreshDraftImageUrl?(workspaceId: string, id: string): Promise<string | null>
  deleteDraft(workspaceId: string, id: string): Promise<void>
}

function workspacePath(workspaceId: string, suffix: string) {
  return `/workspaces/${encodeURIComponent(workspaceId)}/${suffix}`
}

export const ApiPostFlowRepository: PostFlowDataRepository = {
  listWorkspaces: () => apiRequest<BrandWorkspace[]>('/brands'),

  createWorkspace: (brand) =>
    apiRequest<BrandWorkspace>('/brands', {
      method: 'POST',
      body: JSON.stringify(brand),
    }),

  async load(workspaceId) {
    const [brand, drafts] = await Promise.all([
      apiRequest<BrandProfile | null>(workspacePath(workspaceId, 'brand')),
      apiRequest<PostDraft[]>(workspacePath(workspaceId, 'drafts')),
    ])
    return { brand, drafts }
  },

  saveBrand: (workspaceId, brand) =>
    apiRequest<BrandProfile>(workspacePath(workspaceId, 'brand'), {
      method: 'PUT',
      body: JSON.stringify(brand),
    }),

  createDraft: (workspaceId, draft) => {
    const { imageAvailable: _imageAvailable, ...payload } = draft
    return apiRequest<PostDraft>(workspacePath(workspaceId, 'drafts'), {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  createDrafts: async (workspaceId, drafts) => {
    // The single-generation API returns the legacy draft shape, where
    // format/timezone metadata is optional. Persist one draft through the
    // single-item endpoint instead of the stricter batch endpoint.
    if (drafts.length === 1) {
      return ApiPostFlowRepository.createDraft(workspaceId, drafts[0]).then(
        (draft) => [draft],
      )
    }

    // The planner batch endpoint is intentionally text-only. The AI chat can
    // generate one image per selected platform, so persist those drafts via
    // the image-aware endpoint rather than silently dropping their image URLs.
    if (drafts.some(({ imageUrl }) => Boolean(imageUrl))) {
      const outcomes = await Promise.allSettled(
        drafts.map((draft) =>
          ApiPostFlowRepository.createDraft(workspaceId, draft),
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
            ApiPostFlowRepository.deleteDraft(workspaceId, id),
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
        draft,
    )
    return apiRequest<PostDraft[]>(workspacePath(workspaceId, 'drafts/batch'), {
      method: 'POST',
      body: JSON.stringify(textualDrafts),
    })
  },

  updateDraft: (workspaceId, draft) =>
    (() => {
      const {
        imageUrl: _imageUrl,
        imageAvailable: _imageAvailable,
        ...persistedDraft
      } = draft
      return apiRequest<PostDraft>(
        workspacePath(workspaceId, `drafts/${encodeURIComponent(draft.id)}`),
        { method: 'PATCH', body: JSON.stringify(persistedDraft) },
      )
    })(),

  saveDraftImage: (workspaceId, id, imageUrl) =>
    apiRequest<PostDraft>(
      workspacePath(workspaceId, `drafts/${encodeURIComponent(id)}/image`),
      { method: 'PUT', body: JSON.stringify({ imageUrl }) },
    ),

  refreshDraftImageUrl: async (workspaceId, id) => {
    const result = await apiRequest<{ imageUrl: string | null }>(
      workspacePath(workspaceId, `drafts/${encodeURIComponent(id)}/image-url`),
    )
    return result.imageUrl
  },

  deleteDraft: (workspaceId, id) =>
    apiRequest<void>(
      workspacePath(workspaceId, `drafts/${encodeURIComponent(id)}`),
      { method: 'DELETE' },
    ),
}
