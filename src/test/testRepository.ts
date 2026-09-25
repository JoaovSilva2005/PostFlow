import type { BrandProfile, BrandWorkspace, PostDraft } from '../domain/models'
import type { PostFlowDataRepository } from '../services/postFlowRepository'

interface TestData {
  brand?: BrandProfile | null
  drafts?: PostDraft[]
}

export interface TestRepository extends PostFlowDataRepository {
  snapshot(): { brand: BrandProfile | null; drafts: PostDraft[] }
}

export function createTestRepository(initial: TestData = {}): TestRepository {
  let brand = initial.brand ?? null
  let drafts = [...(initial.drafts ?? [])]
  let nextId = drafts.length + 1

  return {
    async listWorkspaces(): Promise<BrandWorkspace[]> {
      return []
    },
    async createWorkspace(nextBrand: BrandProfile): Promise<BrandWorkspace> {
      return {
        id: 'test-workspace',
        role: 'owner',
        billingStatus: 'active',
        brand: nextBrand,
      }
    },
    async load() {
      return { brand, drafts: [...drafts] }
    },
    async saveBrand(_workspaceId, nextBrand) {
      brand = { ...nextBrand }
      return brand
    },
    async createDraft(_workspaceId, draft) {
      const createdDraft = { ...draft, id: `database-draft-${nextId++}` }
      drafts = [...drafts, createdDraft]
      return createdDraft
    },
    async updateDraft(_workspaceId, updatedDraft) {
      drafts = drafts.map((draft) =>
        draft.id === updatedDraft.id ? updatedDraft : draft,
      )
      return updatedDraft
    },
    async deleteDraft(_workspaceId, id) {
      drafts = drafts.filter((draft) => draft.id !== id)
    },
    snapshot() {
      return { brand, drafts: [...drafts] }
    },
  }
}
