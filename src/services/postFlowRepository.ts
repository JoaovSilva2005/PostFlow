import type { BrandProfile, PostDraft } from '../domain/models'
import { apiRequest } from './apiClient'

interface ProjectData {
  brand: BrandProfile | null
  drafts: PostDraft[]
}

export interface PostFlowDataRepository {
  load(workspaceId: string): Promise<ProjectData>
  saveBrand(workspaceId: string, brand: BrandProfile): Promise<BrandProfile>
  createDraft(workspaceId: string, draft: PostDraft): Promise<PostDraft>
  updateDraft(workspaceId: string, draft: PostDraft): Promise<PostDraft>
  deleteDraft(workspaceId: string, id: string): Promise<void>
}

function workspacePath(workspaceId: string, suffix: string) {
  return `/workspaces/${encodeURIComponent(workspaceId)}/${suffix}`
}

export const ApiPostFlowRepository: PostFlowDataRepository = {
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

  createDraft: (workspaceId, draft) =>
    apiRequest<PostDraft>(workspacePath(workspaceId, 'drafts'), {
      method: 'POST',
      body: JSON.stringify(draft),
    }),

  updateDraft: (workspaceId, draft) =>
    apiRequest<PostDraft>(
      workspacePath(workspaceId, `drafts/${encodeURIComponent(draft.id)}`),
      { method: 'PATCH', body: JSON.stringify(draft) },
    ),

  deleteDraft: (workspaceId, id) =>
    apiRequest<void>(
      workspacePath(workspaceId, `drafts/${encodeURIComponent(id)}`),
      { method: 'DELETE' },
    ),
}
